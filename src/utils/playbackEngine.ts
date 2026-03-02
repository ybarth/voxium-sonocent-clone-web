import type { Chunk, Section } from '../types';
import { getFlatSectionOrder } from './sectionTree';

/**
 * PlaybackEngine manages Web Audio API playback of chunks.
 * It handles play, pause, stop, seeking, and cursor tracking.
 */
export class PlaybackEngine {
  private audioContext: AudioContext;
  private gainNode: GainNode;
  private sourceNode: AudioBufferSourceNode | null = null;
  private isPlaying = false;
  private startedAt = 0; // AudioContext time when playback started
  private pausedAt = 0; // Offset into current chunk when paused

  private currentChunkIndex = 0;
  private orderedChunks: Chunk[] = [];
  private audioBuffers: Map<string, AudioBuffer> = new Map();

  private onCursorUpdate: ((chunkId: string, position: number, time: number) => void) | null = null;
  private onChunkChange: ((chunkId: string) => void) | null = null;
  private onPlaybackEnd: (() => void) | null = null;
  private animFrameId: number | null = null;

  private playbackRate = 1.0;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.gainNode = audioContext.createGain();
    this.gainNode.connect(audioContext.destination);
  }

  setBuffers(buffers: Map<string, AudioBuffer>) {
    this.audioBuffers = buffers;
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
  }

  setVolume(volume: number) {
    this.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
  }

  setPlaybackRate(rate: number) {
    this.playbackRate = rate;
    if (this.sourceNode) {
      this.sourceNode.playbackRate.setValueAtTime(
        rate,
        this.audioContext.currentTime
      );
    }
  }

  onCursor(cb: (chunkId: string, position: number, time: number) => void) {
    this.onCursorUpdate = cb;
  }

  onChunk(cb: (chunkId: string) => void) {
    this.onChunkChange = cb;
  }

  onEnd(cb: () => void) {
    this.onPlaybackEnd = cb;
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

    this.playCurrentChunk();
  }

  pause() {
    if (!this.isPlaying) return;

    const elapsed =
      (this.audioContext.currentTime - this.startedAt) * this.playbackRate;
    this.pausedAt += elapsed;
    this.stopSource();
  }

  stop() {
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

  private getCurrentChunkDuration(): number {
    const chunk = this.orderedChunks[this.currentChunkIndex];
    if (!chunk) return 0;
    return chunk.endTime - chunk.startTime;
  }

  private playCurrentChunk() {
    const chunk = this.orderedChunks[this.currentChunkIndex];
    if (!chunk) {
      this.stopSource();
      this.onPlaybackEnd?.();
      return;
    }

    const buffer = this.audioBuffers.get(chunk.audioBufferId);
    if (!buffer) return;

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = buffer;
    this.sourceNode.playbackRate.setValueAtTime(
      this.playbackRate,
      this.audioContext.currentTime
    );
    this.sourceNode.connect(this.gainNode);

    const chunkDuration = chunk.endTime - chunk.startTime;
    const offset = chunk.startTime + this.pausedAt;
    const duration = chunkDuration - this.pausedAt;

    if (duration <= 0) {
      this.advanceToNextChunk();
      return;
    }

    this.sourceNode.start(0, offset, duration);
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
    this.pausedAt = 0;
    this.currentChunkIndex++;

    if (this.currentChunkIndex >= this.orderedChunks.length) {
      this.stopSource();
      this.currentChunkIndex = 0;
      this.onPlaybackEnd?.();
      return;
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

  private startCursorTracking() {
    const track = () => {
      if (!this.isPlaying) return;

      const chunk = this.orderedChunks[this.currentChunkIndex];
      if (!chunk) return;

      const elapsed =
        (this.audioContext.currentTime - this.startedAt) * this.playbackRate;
      const currentOffset = this.pausedAt + elapsed;
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
  }
}
