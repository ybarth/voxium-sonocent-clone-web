import type { Chunk, Section } from '../types';
import { getFlatSectionOrder } from './sectionTree';
import { timeStretchRegion } from './timeStretch';

/**
 * PlaybackEngine manages Web Audio API playback of chunks.
 * It handles play, pause, stop, seeking, and cursor tracking.
 *
 * Speed changes use WSOLA time-stretching to preserve pitch
 * (no chipmunk effect) at any rate from 0.25x to 5x.
 */
export class PlaybackEngine {
  private audioContext: AudioContext;
  private gainNode: GainNode;
  private sourceNode: AudioBufferSourceNode | null = null;
  private isPlaying = false;
  private startedAt = 0; // AudioContext time when playback started
  private pausedAt = 0; // Offset into current chunk (in *original* time) when paused

  private currentChunkIndex = 0;
  private orderedChunks: Chunk[] = [];
  private audioBuffers: Map<string, AudioBuffer> = new Map();

  private onCursorUpdate: ((chunkId: string, position: number, time: number) => void) | null = null;
  private onChunkChange: ((chunkId: string) => void) | null = null;
  private onChunkEndCb: ((chunkId: string) => void) | null = null;
  private onBoundaryCb: ((exitingId: string, enteringId: string) => void) | null = null;
  private onPlaybackEnd: (() => void) | null = null;
  private animFrameId: number | null = null;

  private playbackRate = 1.0;

  // Loop support
  private loopEnabled = false;
  private loopStartIndex = 0;
  private loopEndIndex = -1; // -1 means end of orderedChunks

  /**
   * The effective rate for the currently playing chunk, derived from
   * the actual stretched buffer duration. This ensures cursor position
   * stays perfectly in sync with what the audio hardware is playing,
   * even if WSOLA rounding causes a tiny duration difference.
   */
  private effectiveRate = 1.0;

  /** Cache of WSOLA-stretched buffers keyed by "chunkId:rate" */
  private stretchedCache = new Map<string, AudioBuffer>();

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.gainNode = audioContext.createGain();
    this.gainNode.connect(audioContext.destination);
  }

  setBuffers(buffers: Map<string, AudioBuffer>) {
    this.audioBuffers = buffers;
    this.stretchedCache.clear();
  }

  setChunks(chunks: Chunk[], sections: Section[]) {
    const activeSections = sections.filter(s => (s.status ?? 'active') === 'active');
    const flatOrder = getFlatSectionOrder(activeSections);
    const sectionPosition = new Map(flatOrder.map((s, i) => [s.id, i]));
    const activeSectionIds = new Set(flatOrder.map(s => s.id));
    this.orderedChunks = [...chunks]
      .filter((c) => !c.isDeleted && activeSectionIds.has(c.sectionId))
      .sort((a, b) => {
        const sA = sectionPosition.get(a.sectionId) ?? 0;
        const sB = sectionPosition.get(b.sectionId) ?? 0;
        if (sA !== sB) return sA - sB;
        return a.orderIndex - b.orderIndex;
      });
    this.stretchedCache.clear();
  }

  setVolume(volume: number) {
    this.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
  }

  setPlaybackRate(rate: number) {
    if (rate === this.playbackRate) return;

    const wasPlaying = this.isPlaying;

    if (wasPlaying) {
      // Capture the current position in original time before stopping
      const realElapsed = this.audioContext.currentTime - this.startedAt;
      this.pausedAt += realElapsed * this.effectiveRate;
      this.stopSource();
    }

    this.playbackRate = rate;
    this.stretchedCache.clear();

    if (wasPlaying) {
      this.playCurrentChunk();
    }
  }

  onCursor(cb: (chunkId: string, position: number, time: number) => void) {
    this.onCursorUpdate = cb;
  }

  onChunk(cb: (chunkId: string) => void) {
    this.onChunkChange = cb;
  }

  onChunkEnd(cb: (chunkId: string) => void) {
    this.onChunkEndCb = cb;
  }

  onBoundary(cb: (exitingId: string, enteringId: string) => void) {
    this.onBoundaryCb = cb;
  }

  onEnd(cb: () => void) {
    this.onPlaybackEnd = cb;
  }

  setLoop(enabled: boolean, startIdx?: number, endIdx?: number) {
    this.loopEnabled = enabled;
    this.loopStartIndex = startIdx ?? 0;
    this.loopEndIndex = endIdx ?? (this.orderedChunks.length - 1);
  }

  seekToChunk(chunkId: string, offsetInChunk = 0) {
    const idx = this.orderedChunks.findIndex((c) => c.id === chunkId);
    if (idx === -1) return;

    const wasPlaying = this.isPlaying;
    if (wasPlaying) this.stopSource();

    this.currentChunkIndex = idx;
    this.pausedAt = offsetInChunk;

    if (wasPlaying) {
      this.playCurrentChunk();
    } else {
      this.onChunkChange?.(chunkId);
      this.onCursorUpdate?.(chunkId, offsetInChunk / this.getCurrentChunkDuration(), 0);
    }
  }

  play() {
    if (this.isPlaying) return;
    if (this.orderedChunks.length === 0) return;

    // Resume audio context if suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    // If loop is on and we haven't started yet, begin at loopStartIndex
    if (this.loopEnabled && this.currentChunkIndex === 0 && this.pausedAt === 0) {
      this.currentChunkIndex = this.loopStartIndex;
    }

    this.playCurrentChunk();
  }

  pause() {
    if (!this.isPlaying) return;

    const realElapsed = this.audioContext.currentTime - this.startedAt;
    this.pausedAt += realElapsed * this.effectiveRate;
    this.stopSource();
  }

  stop() {
    // Fire chunk end for the chunk we're stopping on
    const exitingChunk = this.orderedChunks[this.currentChunkIndex];
    if (exitingChunk && this.isPlaying) {
      this.onChunkEndCb?.(exitingChunk.id);
    }
    this.stopSource();
    this.pausedAt = 0;
    this.currentChunkIndex = 0;
    this.onPlaybackEnd?.();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  get playing() {
    return this.isPlaying;
  }

  get currentChunkId(): string | null {
    return this.orderedChunks[this.currentChunkIndex]?.id ?? null;
  }

  /** Expose the gain node for TTS audio ducking */
  get mainGainNode(): GainNode {
    return this.gainNode;
  }

  private getCurrentChunkDuration(): number {
    const chunk = this.orderedChunks[this.currentChunkIndex];
    if (!chunk) return 0;
    return chunk.endTime - chunk.startTime;
  }

  /**
   * Get (or create & cache) a WSOLA time-stretched buffer for a chunk.
   */
  private getStretchedBuffer(chunk: Chunk): AudioBuffer {
    const key = `${chunk.id}:${this.playbackRate}`;
    const cached = this.stretchedCache.get(key);
    if (cached) return cached;

    const original = this.audioBuffers.get(chunk.audioBufferId);
    if (!original) throw new Error(`Missing audio buffer ${chunk.audioBufferId}`);

    const stretched = timeStretchRegion(
      original,
      chunk.startTime,
      chunk.endTime,
      this.playbackRate,
      this.audioContext,
    );

    this.stretchedCache.set(key, stretched);
    return stretched;
  }

  private playCurrentChunk() {
    const chunk = this.orderedChunks[this.currentChunkIndex];
    if (!chunk) {
      this.stopSource();
      this.onPlaybackEnd?.();
      return;
    }

    const originalBuffer = this.audioBuffers.get(chunk.audioBufferId);
    if (!originalBuffer) return;

    const chunkDuration = chunk.endTime - chunk.startTime;

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.connect(this.gainNode);

    if (this.playbackRate !== 1.0) {
      // ---------- Pitch-preserving time-stretched playback ----------
      const stretched = this.getStretchedBuffer(chunk);
      this.sourceNode.buffer = stretched;
      // Play the pre-stretched buffer at native speed (1x)
      this.sourceNode.playbackRate.setValueAtTime(1.0, this.audioContext.currentTime);

      // Compute the effective rate from the actual stretched duration so
      // cursor tracking stays perfectly in sync with hardware playback.
      this.effectiveRate = stretched.duration > 0
        ? chunkDuration / stretched.duration
        : this.playbackRate;

      // Map pausedAt (original time) to position in the stretched buffer
      const stretchedOffset = this.pausedAt / this.effectiveRate;
      const stretchedRemaining = stretched.duration - stretchedOffset;

      if (stretchedRemaining <= 0) {
        this.advanceToNextChunk();
        return;
      }

      this.sourceNode.start(0, stretchedOffset, stretchedRemaining);
    } else {
      // ---------- Normal 1x playback (no stretching needed) ----------
      this.effectiveRate = 1.0;
      this.sourceNode.buffer = originalBuffer;
      this.sourceNode.playbackRate.setValueAtTime(1.0, this.audioContext.currentTime);

      const offset = chunk.startTime + this.pausedAt;
      const duration = chunkDuration - this.pausedAt;

      if (duration <= 0) {
        this.advanceToNextChunk();
        return;
      }

      this.sourceNode.start(0, offset, duration);
    }

    this.startedAt = this.audioContext.currentTime;
    this.isPlaying = true;

    this.onChunkChange?.(chunk.id);

    this.sourceNode.onended = () => {
      if (this.isPlaying) {
        this.advanceToNextChunk();
      }
    };

    this.startCursorTracking();
  }

  private advanceToNextChunk() {
    // Fire chunk end for the chunk we're leaving
    const exitingChunk = this.orderedChunks[this.currentChunkIndex];
    if (exitingChunk) {
      this.onChunkEndCb?.(exitingChunk.id);
    }

    this.pausedAt = 0;
    this.currentChunkIndex++;

    const loopEnd = this.loopEnabled
      ? Math.min(this.loopEndIndex, this.orderedChunks.length - 1)
      : this.orderedChunks.length - 1;

    if (this.currentChunkIndex > loopEnd) {
      if (this.loopEnabled) {
        // Wrap to loop start
        this.currentChunkIndex = this.loopStartIndex;
      } else {
        this.stopSource();
        this.currentChunkIndex = 0;
        this.onPlaybackEnd?.();
        return;
      }
    }

    // Fire boundary event when transitioning between chunks
    const enteringChunk = this.orderedChunks[this.currentChunkIndex];
    if (exitingChunk && enteringChunk) {
      this.onBoundaryCb?.(exitingChunk.id, enteringChunk.id);
    }

    this.playCurrentChunk();
  }

  private stopSource() {
    this.isPlaying = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.sourceNode) {
      this.sourceNode.onended = null;
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // Already stopped
      }
      this.sourceNode = null;
    }
  }

  /**
   * Cursor tracking.
   *
   * Uses effectiveRate (derived from the actual stretched buffer duration)
   * so the cursor stays perfectly in sync with hardware playback.
   * For 1x playback effectiveRate === 1.0 and this reduces to direct time.
   */
  private startCursorTracking() {
    const track = () => {
      if (!this.isPlaying) return;

      const chunk = this.orderedChunks[this.currentChunkIndex];
      if (!chunk) return;

      const realElapsed = this.audioContext.currentTime - this.startedAt;
      const originalElapsed = realElapsed * this.effectiveRate;
      const currentOffset = this.pausedAt + originalElapsed;
      const chunkDuration = chunk.endTime - chunk.startTime;
      const position = Math.min(currentOffset / chunkDuration, 1);
      const globalTime = chunk.startTime + currentOffset;

      this.onCursorUpdate?.(chunk.id, position, globalTime);
      this.animFrameId = requestAnimationFrame(track);
    };
    this.animFrameId = requestAnimationFrame(track);
  }

  destroy() {
    this.stopSource();
    this.gainNode.disconnect();
    this.stretchedCache.clear();
  }
}
