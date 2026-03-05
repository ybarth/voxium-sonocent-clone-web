// Audio-text sync hook — maps playback cursor to active word
// Supports dual-source highlighting: STT mappings (primary) or TTS timestamps (synthetic)

import { useMemo } from 'react';
import { useProjectStore } from '../stores/projectStore';
import type { TranscribedWord, WordChunkMapping, HighlightGranularity } from '../types/transcription';
import { getSyntheticCache } from '../utils/syntheticLayerGenerator';
import type { TtsWordTimestamp } from '../utils/headTtsProvider';

interface SyncResult {
  activeWordId: string | null;
  highlightedWordIds: Set<string>;
}

/**
 * Maps the current playback position to the active word and highlighted range.
 * When activeLayer is 'synthetic', uses TTS word timestamps instead of STT mappings.
 */
export function useTranscriptionSync(): SyncResult {
  const currentChunkId = useProjectStore(s => s.playback.currentChunkId);
  const cursorPositionInChunk = useProjectStore(s => s.playback.cursorPositionInChunk);
  const isPlaying = useProjectStore(s => s.playback.isPlaying);
  const words = useProjectStore(s => s.project.transcription.words);
  const mappings = useProjectStore(s => s.project.transcription.wordChunkMappings);
  const granularities = useProjectStore(s => s.project.transcription.highlightGranularities);
  const activeLayer = useProjectStore(s => s.playback.activeLayer);
  const syntheticEnabled = useProjectStore(s => s.project.settings.syntheticLayer.enabled);

  return useMemo(() => {
    if (!isPlaying || !currentChunkId || words.length === 0) {
      return { activeWordId: null, highlightedWordIds: new Set<string>() };
    }

    // ─── Synthetic layer highlighting via TTS timestamps ──────────────
    if (activeLayer === 'synthetic' && syntheticEnabled) {
      const synData = getSyntheticCache().get(currentChunkId);
      if (synData && synData.wordTimestamps.length > 0) {
        return buildSyntheticHighlight(
          synData.wordTimestamps, synData.audioBuffer.duration,
          cursorPositionInChunk, words, currentChunkId, mappings, granularities,
        );
      }
      // Fall through to STT-based highlighting if no synthetic data
    }

    // ─── Primary layer highlighting via STT word-chunk mappings ───────
    const chunkMappings = mappings
      .filter(m => m.chunkId === currentChunkId)
      .sort((a, b) => a.startFraction - b.startFraction);

    let activeWordId: string | null = null;

    for (const m of chunkMappings) {
      if (cursorPositionInChunk >= m.startFraction && cursorPositionInChunk <= m.endFraction) {
        activeWordId = m.wordId;
        break;
      }
    }

    // If no exact match, find nearest
    if (!activeWordId && chunkMappings.length > 0) {
      let best = chunkMappings[0];
      let bestDist = Math.abs(cursorPositionInChunk - (best.startFraction + best.endFraction) / 2);
      for (const m of chunkMappings) {
        const dist = Math.abs(cursorPositionInChunk - (m.startFraction + m.endFraction) / 2);
        if (dist < bestDist) {
          best = m;
          bestDist = dist;
        }
      }
      activeWordId = best.wordId;
    }

    // Build highlighted word set based on granularity
    const highlighted = new Set<string>();

    if (activeWordId) {
      if (granularities.includes('word')) {
        highlighted.add(activeWordId);
      }
      const activeWord = words.find(w => w.id === activeWordId);

      if (activeWord) {
        // Find word's position in sorted word list
        const sortedWords = [...words].sort((a, b) => a.startTime - b.startTime);
        const activeIdx = sortedWords.findIndex(w => w.id === activeWordId);

        if (granularities.includes('sentence')) {
          addSentenceWords(sortedWords, activeIdx, highlighted);
        }
        if (granularities.includes('chunk')) {
          // Highlight all words in the same chunk
          for (const m of chunkMappings) {
            highlighted.add(m.wordId);
          }
        }
      }
    }

    return { activeWordId, highlightedWordIds: highlighted };
  }, [currentChunkId, cursorPositionInChunk, isPlaying, words, mappings, granularities, activeLayer, syntheticEnabled]);
}

/**
 * Build highlighting from TTS word timestamps.
 * Maps cursor position (0-1 fraction) → TTS word timestamp → original word ID.
 */
function buildSyntheticHighlight(
  ttsTimestamps: TtsWordTimestamp[],
  ttsDuration: number,
  cursorFraction: number,
  words: TranscribedWord[],
  currentChunkId: string,
  mappings: WordChunkMapping[],
  granularities: HighlightGranularity[],
): SyncResult {
  const cursorTimeSec = cursorFraction * ttsDuration;

  // Find active TTS word by timestamp
  let activeTtsIdx = -1;
  for (let i = 0; i < ttsTimestamps.length; i++) {
    const ts = ttsTimestamps[i];
    if (cursorTimeSec >= ts.startTimeSec && cursorTimeSec <= ts.endTimeSec) {
      activeTtsIdx = i;
      break;
    }
  }

  // Nearest fallback
  if (activeTtsIdx === -1 && ttsTimestamps.length > 0) {
    let bestDist = Infinity;
    for (let i = 0; i < ttsTimestamps.length; i++) {
      const mid = (ttsTimestamps[i].startTimeSec + ttsTimestamps[i].endTimeSec) / 2;
      const dist = Math.abs(cursorTimeSec - mid);
      if (dist < bestDist) {
        bestDist = dist;
        activeTtsIdx = i;
      }
    }
  }

  if (activeTtsIdx === -1) {
    return { activeWordId: null, highlightedWordIds: new Set<string>() };
  }

  // Map TTS word index to original word ID via chunk mappings
  // TTS words are in the same order as the source words for this chunk
  const chunkMappings = mappings
    .filter(m => m.chunkId === currentChunkId)
    .sort((a, b) => a.startFraction - b.startFraction);

  const activeWordId = chunkMappings[activeTtsIdx]?.wordId ?? null;

  const highlighted = new Set<string>();
  if (activeWordId) {
    if (granularities.includes('word')) {
      highlighted.add(activeWordId);
    }

    if (granularities.includes('sentence') || granularities.includes('chunk')) {
      const sortedWords = [...words].sort((a, b) => a.startTime - b.startTime);
      const activeIdx = sortedWords.findIndex(w => w.id === activeWordId);

      if (granularities.includes('sentence')) {
        addSentenceWords(sortedWords, activeIdx, highlighted);
      }
      if (granularities.includes('chunk')) {
        for (const m of chunkMappings) {
          highlighted.add(m.wordId);
        }
      }
    }
  }

  return { activeWordId, highlightedWordIds: highlighted };
}

/**
 * Find sentence boundaries (period, !, ?) and add all words in the sentence.
 */
function addSentenceWords(
  sortedWords: TranscribedWord[],
  activeIdx: number,
  highlighted: Set<string>,
) {
  if (activeIdx < 0) return;

  // Find sentence start (scan backward for sentence-ending punctuation)
  let start = activeIdx;
  for (let i = activeIdx - 1; i >= 0; i--) {
    const text = sortedWords[i].text;
    if (text.match(/[.!?]$/)) {
      start = i + 1;
      break;
    }
    if (i === 0) start = 0;
  }

  // Find sentence end (scan forward for sentence-ending punctuation)
  let end = activeIdx;
  for (let i = activeIdx; i < sortedWords.length; i++) {
    end = i;
    if (sortedWords[i].text.match(/[.!?]$/)) break;
    if (i === sortedWords.length - 1) end = i;
  }

  for (let i = start; i <= end; i++) {
    highlighted.add(sortedWords[i].id);
  }
}
