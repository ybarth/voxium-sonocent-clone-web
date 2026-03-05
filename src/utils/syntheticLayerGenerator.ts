/**
 * Synthetic layer generator — TTS buffer generation pipeline.
 * Generates TTS audio for each chunk from transcription text,
 * time-stretches to match original chunk duration, and caches results.
 */

import type { Chunk } from '../types';
import type { TranscribedWord, WordChunkMapping } from '../types/transcription';
import type { SyntheticTtsProvider, TtsWordTimestamp } from './syntheticTtsProvider';
import type { HeadTtsInputItem } from './headTtsProvider';
import type { ChunkExpressivity } from '../types/document';
import { stretchSynthetic, adjustTimestamps } from './sonicStretcher';
import { getWordsForChunk } from './wordChunkMapper';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SyntheticChunkAudio {
  chunkId: string;
  audioBuffer: AudioBuffer;
  wordTimestamps: TtsWordTimestamp[];
  generatedFromText: string;
  generatedAt: number; // Date.now()
}

export type SyntheticChunkStatus = 'pending' | 'generating' | 'ready' | 'error';

// ─── Module-level cache (AudioBuffers aren't serializable in Zustand) ──────

const syntheticCache = new Map<string, SyntheticChunkAudio>();
const chunkStatuses = new Map<string, SyntheticChunkStatus>();
const statusListeners = new Set<() => void>();

export function getSyntheticCache(): ReadonlyMap<string, SyntheticChunkAudio> {
  return syntheticCache;
}

export function getChunkStatus(chunkId: string): SyntheticChunkStatus {
  return chunkStatuses.get(chunkId) ?? 'pending';
}

export function getAllChunkStatuses(): ReadonlyMap<string, SyntheticChunkStatus> {
  return chunkStatuses;
}

export function onStatusChange(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function notifyStatusChange() {
  for (const listener of statusListeners) {
    listener();
  }
}

function setStatus(chunkId: string, status: SyntheticChunkStatus) {
  chunkStatuses.set(chunkId, status);
  notifyStatusChange();
}

/** Set status from external callers (e.g. when TTS provider fails). */
export { setStatus as setChunkStatus };

// ─── Generation ─────────────────────────────────────────────────────────────

/**
 * Generate synthetic TTS audio for a single chunk.
 */
export async function generateSyntheticForChunk(
  chunkId: string,
  text: string,
  provider: SyntheticTtsProvider,
  audioContext: AudioContext,
  targetDuration: number, // desired duration in seconds (matches original chunk)
  headTtsSpeed: number,
  expressivity?: ChunkExpressivity,
  signal?: AbortSignal,
): Promise<SyntheticChunkAudio> {
  if (!text.trim()) {
    // Create a silent buffer for empty text
    const sampleRate = audioContext.sampleRate;
    const length = Math.max(1, Math.round(targetDuration * sampleRate));
    const silentBuffer = audioContext.createBuffer(1, length, sampleRate);
    return {
      chunkId,
      audioBuffer: silentBuffer,
      wordTimestamps: [],
      generatedFromText: text,
      generatedAt: Date.now(),
    };
  }

  setStatus(chunkId, 'generating');

  try {
    // Build input with expressivity if provided
    const speed = expressivity?.speed ?? headTtsSpeed;
    const voice = expressivity?.voiceId || undefined;
    let input: string | HeadTtsInputItem[] = text;

    if (expressivity) {
      const items: HeadTtsInputItem[] = [];
      if (expressivity.leadingBreakMs > 0) {
        items.push({ type: 'break', value: expressivity.leadingBreakMs });
      }
      // Add phonetic overrides if any
      if (expressivity.phonetics.length > 0) {
        for (const p of expressivity.phonetics) {
          items.push({ type: 'phonetic', value: p.ipa, word: p.word });
        }
        // Also add the full text
        items.push({ type: 'text', value: text });
      } else {
        items.push({ type: 'text', value: text });
      }
      if (expressivity.trailingBreakMs > 0) {
        items.push({ type: 'break', value: expressivity.trailingBreakMs });
      }
      input = items;
    }

    const result = await provider.generate(input, { speed, voice });

    // Check abort signal after generation completes (HeadTTS can't be interrupted mid-call)
    if (signal?.aborted) {
      setStatus(chunkId, 'pending');
      throw new DOMException('Aborted', 'AbortError');
    }

    let { audioBuffer, wordTimestamps } = result;

    // Time-stretch to match target duration if needed
    const generatedDuration = audioBuffer.duration;
    if (targetDuration > 0 && Math.abs(generatedDuration - targetDuration) > 0.05) {
      const stretchRate = generatedDuration / targetDuration;
      audioBuffer = stretchSynthetic(audioBuffer, 1.0, stretchRate, audioContext);

      // Adjust timestamps by the stretch factor
      const actualStretch = generatedDuration / audioBuffer.duration;
      wordTimestamps = adjustTimestamps(wordTimestamps, actualStretch);
    }

    const entry: SyntheticChunkAudio = {
      chunkId,
      audioBuffer,
      wordTimestamps,
      generatedFromText: text,
      generatedAt: Date.now(),
    };

    syntheticCache.set(chunkId, entry);
    setStatus(chunkId, 'ready');
    return entry;
  } catch (err) {
    setStatus(chunkId, 'error');
    console.error(`Synthetic generation failed for chunk ${chunkId}:`, err);
    throw err;
  }
}

/**
 * Generate synthetic audio for all chunks.
 * Runs with a concurrency limit to avoid overwhelming the TTS engine.
 */
export async function generateAllSynthetic(
  chunks: Chunk[],
  words: TranscribedWord[],
  mappings: WordChunkMapping[],
  provider: SyntheticTtsProvider,
  audioContext: AudioContext,
  headTtsSpeed: number,
  concurrency = 3,
): Promise<Map<string, SyntheticChunkAudio>> {
  const results = new Map<string, SyntheticChunkAudio>();
  const queue = [...chunks];

  async function worker() {
    while (queue.length > 0) {
      const chunk = queue.shift();
      if (!chunk) break;

      const chunkWords = getWordsForChunk(chunk.id, words, mappings);
      const text = chunkWords.map(w => w.text).join(' ');
      const targetDuration = chunk.endTime - chunk.startTime;

      try {
        const result = await generateSyntheticForChunk(
          chunk.id, text, provider, audioContext, targetDuration, headTtsSpeed,
        );
        results.set(chunk.id, result);
      } catch {
        // Error already logged in generateSyntheticForChunk
      }
    }
  }

  // Run workers in parallel
  const workers = Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

/**
 * Invalidate specific chunks — removes from cache and marks for regeneration.
 */
export function invalidateChunks(chunkIds: string[]) {
  for (const id of chunkIds) {
    syntheticCache.delete(id);
    setStatus(id, 'pending');
  }
}

/**
 * Clear all synthetic cache.
 */
export function clearSyntheticCache() {
  syntheticCache.clear();
  chunkStatuses.clear();
  notifyStatusChange();
}

/**
 * Get the text that was used to generate a cached chunk's audio.
 * Returns null if not cached.
 */
export function getCachedText(chunkId: string): string | null {
  return syntheticCache.get(chunkId)?.generatedFromText ?? null;
}
