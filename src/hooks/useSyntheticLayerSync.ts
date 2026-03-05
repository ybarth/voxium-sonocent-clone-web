/**
 * useSyntheticLayerSync — watches transcription/chunk state and drives
 * synthetic TTS buffer generation + synthetic engine sync.
 *
 * Uses SmartTtsScheduler for proximity-based generation ordering.
 * Call ONCE in App.tsx (like usePlaybackSync).
 */

import { useEffect, useRef } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { HeadTtsProvider } from '../utils/headTtsProvider';
import { initSonic } from '../utils/sonicStretcher';
import {
  getSyntheticCache,
  invalidateChunks,
  clearSyntheticCache,
  getCachedText,
  setChunkStatus as setStatusExternal,
} from '../utils/syntheticLayerGenerator';
import { getWordsForChunk } from '../utils/wordChunkMapper';
import { getSyntheticEngine } from './usePlayback';
import { getFlatSectionOrder } from '../utils/sectionTree';
import { SmartTtsScheduler } from '../utils/smartTtsScheduler';
import type { Chunk, Section } from '../types';
import type { ChunkExpressivity } from '../types/document';
import type { TranscribedWord, WordChunkMapping } from '../types/transcription';

// Module-level TTS provider singleton
let ttsProvider: HeadTtsProvider | null = null;
let providerConnecting = false;

async function getOrCreateProvider(audioContext: AudioContext, voiceId: string, speed: number): Promise<HeadTtsProvider> {
  if (ttsProvider && ttsProvider.isReady()) {
    return ttsProvider;
  }

  if (providerConnecting) {
    // Wait for existing connection attempt
    while (providerConnecting) {
      await new Promise(r => setTimeout(r, 100));
    }
    if (ttsProvider?.isReady()) return ttsProvider;
  }

  providerConnecting = true;
  try {
    console.log('[SyntheticSync] Creating HeadTTS provider...');
    ttsProvider = new HeadTtsProvider(audioContext, voiceId, speed);
    await ttsProvider.connect((msg) => console.log('[HeadTTS]', msg));
    console.log('[SyntheticSync] HeadTTS connected successfully');
    // Also init sonic-wasm in parallel (non-blocking)
    initSonic().catch(err => console.warn('Sonic WASM init failed (WSOLA fallback available):', err));
    return ttsProvider;
  } catch (err) {
    console.error('[SyntheticSync] HeadTTS connection FAILED:', err);
    ttsProvider = null;
    throw err;
  } finally {
    providerConnecting = false;
  }
}

// Module-level scheduler singleton
let scheduler: SmartTtsScheduler | null = null;

export function getScheduler(): SmartTtsScheduler | null {
  return scheduler;
}

function getOrCreateScheduler(chunks: Chunk[], sections: Section[]): SmartTtsScheduler {
  if (!scheduler) {
    scheduler = new SmartTtsScheduler();

    // Wire up incremental buffer updates on each chunk completion
    scheduler.onChunkComplete(() => {
      const state = useProjectStore.getState();
      const activeChunks = state.project.chunks.filter(c => !c.isDeleted);
      updateSyntheticEngineBuffers(activeChunks, state.project.sections);
    });
  }

  // Update ordered chunk IDs using section-based sort order
  const activeSections = sections.filter(s => (s.status ?? 'active') === 'active');
  const activeChunks = chunks.filter(c => !c.isDeleted && activeSections.some(s => s.id === c.sectionId));
  const flatOrder = getFlatSectionOrder(activeSections);
  const sectionPosition = new Map(flatOrder.map((s, i) => [s.id, i]));
  const orderedChunks = [...activeChunks].sort((a, b) => {
    const sA = sectionPosition.get(a.sectionId) ?? 0;
    const sB = sectionPosition.get(b.sectionId) ?? 0;
    if (sA !== sB) return sA - sB;
    return a.orderIndex - b.orderIndex;
  });
  scheduler.setOrderedChunks(orderedChunks.map(c => c.id));

  return scheduler;
}

/**
 * Build a text string for a chunk from word-chunk mappings.
 */
function getChunkText(
  chunkId: string,
  words: TranscribedWord[],
  mappings: WordChunkMapping[],
): string {
  const chunkWords = getWordsForChunk(chunkId, words, mappings);
  return chunkWords.map(w => w.text).join(' ');
}

export function useSyntheticLayerSync() {
  const syntheticConfig = useProjectStore(s => s.project.settings.syntheticLayer);
  const words = useProjectStore(s => s.project.transcription.words);
  const mappings = useProjectStore(s => s.project.transcription.wordChunkMappings);
  const chunks = useProjectStore(s => s.project.chunks);
  const sections = useProjectStore(s => s.project.sections);
  const documentExpressivity = useProjectStore(s => s.project.documentExpressivity);
  const currentChunkId = useProjectStore(s => s.playback.currentChunkId);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generatingRef = useRef(false);

  // Clean up when synthetic layer is disabled
  useEffect(() => {
    if (!syntheticConfig.enabled) {
      clearSyntheticCache();
      if (scheduler) {
        scheduler.reset();
      }
    }
  }, [syntheticConfig.enabled]);

  // Track playhead position for priority scheduling
  useEffect(() => {
    if (!syntheticConfig.enabled || !currentChunkId || !scheduler) return;
    scheduler.updatePlayheadPosition(currentChunkId);
  }, [syntheticConfig.enabled, currentChunkId]);

  // Main generation effect: when enabled and transcription text changes
  useEffect(() => {
    if (!syntheticConfig.enabled) return;
    if (words.length === 0) return;

    // Debounce to avoid rapid regeneration during typing
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      regenerateStaleChunks(
        chunks, words, mappings, sections,
        syntheticConfig.voiceId, syntheticConfig.headTtsSpeed,
        generatingRef,
        documentExpressivity,
      );
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    syntheticConfig.enabled, syntheticConfig.voiceId, syntheticConfig.headTtsSpeed,
    words, mappings, chunks, sections, documentExpressivity,
  ]);
}

/**
 * Regenerate synthetic audio for chunks whose text has changed or is missing from cache.
 * Uses SmartTtsScheduler for proximity-based ordering.
 */
async function regenerateStaleChunks(
  chunks: Chunk[],
  words: TranscribedWord[],
  mappings: WordChunkMapping[],
  sections: Section[],
  voiceId: string,
  headTtsSpeed: number,
  generatingRef: React.MutableRefObject<boolean>,
  expressivityMap?: Record<string, ChunkExpressivity>,
) {
  if (generatingRef.current) return;
  generatingRef.current = true;

  try {
    // Identify stale chunks FIRST so statuses are visible in the UI
    // even before the TTS provider connects
    const activeChunks = chunks.filter(c => !c.isDeleted);
    const staleChunkJobs: Array<{
      chunkId: string;
      text: string;
      targetDuration: number;
      expressivity?: ChunkExpressivity;
    }> = [];

    for (const chunk of activeChunks) {
      const text = getChunkText(chunk.id, words, mappings);
      const cachedText = getCachedText(chunk.id);

      if (cachedText !== text) {
        staleChunkJobs.push({
          chunkId: chunk.id,
          text,
          targetDuration: chunk.endTime - chunk.startTime,
          expressivity: expressivityMap?.[chunk.id],
        });
      }
    }

    if (staleChunkJobs.length === 0) {
      console.log('[SyntheticSync] All chunks up to date, nothing to regenerate');
      return;
    }

    console.log(`[SyntheticSync] ${staleChunkJobs.length} stale chunks to regenerate`);

    // Invalidate stale entries — marks them 'pending' in chunk statuses
    // so the ProcessingPanel can show them immediately
    invalidateChunks(staleChunkJobs.map(j => j.chunkId));

    // Set up scheduler with ordered chunks (even before provider connects)
    const sched = getOrCreateScheduler(chunks, sections);
    const currentChunkId = useProjectStore.getState().playback.currentChunkId;
    if (currentChunkId) {
      sched.updatePlayheadPosition(currentChunkId);
    }
    sched.enqueueStaleChunks(staleChunkJobs);

    // Now connect to TTS provider (may take time or fail)
    const audioContext = useProjectStore.getState().audioContext
      ?? useProjectStore.getState().initAudioContext();
    if (!audioContext) {
      console.warn('[SyntheticSync] No AudioContext available');
      return;
    }

    let provider;
    try {
      provider = await getOrCreateProvider(audioContext, voiceId, headTtsSpeed);
    } catch (err) {
      // Mark all queued chunks as error so the panel shows the failure
      for (const job of staleChunkJobs) {
        setStatusExternal(job.chunkId, 'error');
      }
      sched.stop();
      console.error('[SyntheticSync] TTS provider failed — all chunks marked as error');
      return;
    }

    // Update voice/speed if changed
    if (provider.voice !== voiceId) provider.setVoice(voiceId);
    if (provider.speed !== headTtsSpeed) provider.setSpeed(headTtsSpeed);

    await sched.start(provider, audioContext, headTtsSpeed);

    const successCount = staleChunkJobs.filter(j => getSyntheticCache().has(j.chunkId)).length;
    console.log(`[SyntheticSync] Generation complete: ${successCount}/${staleChunkJobs.length} succeeded`);

    // Final buffer update (incremental updates already happened per-chunk)
    updateSyntheticEngineBuffers(activeChunks, sections);
  } finally {
    generatingRef.current = false;
  }
}

/**
 * Push generated synthetic buffers to the synthetic PlaybackEngine.
 * After loading, syncs play state with the primary engine so that
 * late-generated TTS audio starts playing if the user already pressed play.
 */
function updateSyntheticEngineBuffers(chunks: Chunk[], sections: Section[]) {
  const synEngine = getSyntheticEngine();
  if (!synEngine) {
    console.warn('[SyntheticSync] No synthetic engine available — skipping buffer update');
    return;
  }

  const cache = getSyntheticCache();
  const bufferMap = new Map<string, AudioBuffer>();

  // Create virtual synthetic chunks that map 1:1 with real chunks
  const syntheticChunks: Chunk[] = [];

  for (const chunk of chunks) {
    const cached = cache.get(chunk.id);
    if (!cached) continue;

    const synBufferId = `syn-${chunk.id}`;
    bufferMap.set(synBufferId, cached.audioBuffer);

    syntheticChunks.push({
      ...chunk,
      audioBufferId: synBufferId,
      startTime: 0,
      endTime: cached.audioBuffer.duration,
    });
  }

  console.log(`[SyntheticSync] Loading ${syntheticChunks.length} chunks into synthetic engine`);
  synEngine.setBuffers(bufferMap);
  synEngine.setChunks(syntheticChunks, sections);

  // If the primary engine is currently playing, sync the synthetic engine
  const state = useProjectStore.getState();
  if (state.playback.isPlaying && syntheticChunks.length > 0) {
    const currentChunkId = state.playback.currentChunkId;
    if (currentChunkId) {
      synEngine.seekToChunk(currentChunkId, 0);
    }
    synEngine.play();
    console.log('[SyntheticSync] Synced synthetic engine to playing state');
  }
}
