// Division Engine — Boundary computation, chunk generation, word remapping

import { v4 as uuid } from 'uuid';
import type { Chunk } from '../types';
import type {
  BoundaryPoint,
  DivisionCriterion,
  AudioRange,
  ChunkOverride,
  Configuration,
} from '../types/configuration';
import type { TranscribedWord, WordChunkMapping } from '../types/transcription';
import { computeWaveformPeaks } from './audioProcessing';
import { mapWordsToChunks, removeMappingsForChunks } from './wordChunkMapper';

// ─── Boundary Merging ──────────────────────────────────────────────────────

const MERGE_THRESHOLD_MS = 100; // Boundaries within 100ms are merged

/**
 * Merge candidate boundaries from multiple criteria into final boundary list.
 * Nearby boundaries (within MERGE_THRESHOLD_MS) are clustered together.
 * Cluster time = weighted average. Cluster confidence = max of constituents × weight.
 */
export function mergeBoundaries(
  candidates: BoundaryPoint[],
  minConfidence = 0.3,
): BoundaryPoint[] {
  if (candidates.length === 0) return [];

  const sorted = [...candidates].sort((a, b) => a.time - b.time);
  const clusters: BoundaryPoint[][] = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const lastCluster = clusters[clusters.length - 1];
    const lastTime = lastCluster[lastCluster.length - 1].time;
    if ((sorted[i].time - lastTime) * 1000 <= MERGE_THRESHOLD_MS) {
      lastCluster.push(sorted[i]);
    } else {
      clusters.push([sorted[i]]);
    }
  }

  const merged: BoundaryPoint[] = [];
  for (const cluster of clusters) {
    const totalWeight = cluster.reduce((sum, b) => sum + b.confidence, 0);
    const avgTime = totalWeight > 0
      ? cluster.reduce((sum, b) => sum + b.time * b.confidence, 0) / totalWeight
      : cluster.reduce((sum, b) => sum + b.time, 0) / cluster.length;
    const maxConfidence = Math.max(...cluster.map(b => b.confidence));
    // Use the source of the highest-confidence point
    const bestSource = cluster.reduce((best, b) =>
      b.confidence > best.confidence ? b : best
    ).source;

    if (maxConfidence >= minConfidence) {
      merged.push({
        time: avgTime,
        source: bestSource,
        confidence: maxConfidence,
      });
    }
  }

  return merged;
}

// ─── Chunks from Boundaries ────────────────────────────────────────────────

/**
 * Create Chunk[] from sorted boundary times within an audio range.
 * Computes waveform data per chunk from the provided channel data.
 */
export function chunksFromBoundaries(
  boundaries: BoundaryPoint[],
  audioRange: AudioRange,
  sectionId: string,
  startOrderIndex: number,
  channelData: Float32Array | null,
  sampleRate: number,
  overrides?: Record<number, ChunkOverride>,
): Chunk[] {
  const sorted = [...boundaries]
    .filter(b => b.time > audioRange.startTime && b.time < audioRange.endTime)
    .sort((a, b) => a.time - b.time);

  const splitPoints = [audioRange.startTime, ...sorted.map(b => b.time), audioRange.endTime];
  const chunks: Chunk[] = [];

  for (let i = 0; i < splitPoints.length - 1; i++) {
    const startTime = splitPoints[i];
    const endTime = splitPoints[i + 1];
    if (endTime <= startTime) continue;

    const override = overrides?.[i];
    const chunk: Chunk = {
      id: uuid(),
      audioBufferId: audioRange.audioBufferId,
      startTime,
      endTime,
      sectionId,
      orderIndex: startOrderIndex + i,
      color: override?.color ?? null,
      style: null,
      formId: override?.formId ?? null,
      tags: override?.tags ?? [],
      isDeleted: false,
      waveformData: channelData
        ? computeWaveformPeaks(channelData, sampleRate, startTime, endTime, 100)
        : null,
    };
    chunks.push(chunk);
  }

  return chunks;
}

// ─── Word Remapping for Section ────────────────────────────────────────────

/**
 * Full re-map of word-chunk mappings for a section after configuration change.
 * Removes old section mappings, maps words to new chunks, merges with remaining.
 */
export function remapWordsForSection(
  sectionId: string,
  newChunks: Chunk[],
  allWords: TranscribedWord[],
  existingMappings: WordChunkMapping[],
  oldChunkIds: string[],
): WordChunkMapping[] {
  // Remove mappings for old chunks in this section
  const cleaned = removeMappingsForChunks(oldChunkIds, existingMappings);

  // Map words to new chunks (words have absolute timestamps, chunks have absolute times)
  const sectionChunks = newChunks.filter(c => c.sectionId === sectionId);
  if (sectionChunks.length === 0) return cleaned;

  const newMappings = mapWordsToChunks(allWords, sectionChunks);

  return [...cleaned, ...newMappings];
}

// ─── Silence-Based Boundaries ──────────────────────────────────────────────

/**
 * Extract boundary points from silence detection (mirrors segmentAudio logic).
 */
export function computeSilenceBoundaries(
  channelData: Float32Array,
  sampleRate: number,
  params: Record<string, number | string | boolean>,
): BoundaryPoint[] {
  const thresholdDb = (params.thresholdDb as number) ?? -40;
  const minSilenceDurationMs = (params.minSilenceDurationMs as number) ?? 300;
  const minChunkDurationMs = (params.minChunkDurationMs as number) ?? 500;

  const thresholdLinear = Math.pow(10, thresholdDb / 20);
  const frameSize = Math.floor(sampleRate * 0.01); // 10ms frames
  const minSilenceFrames = Math.ceil(
    (minSilenceDurationMs / 1000) * sampleRate / frameSize,
  );

  // Compute RMS per frame
  const frames: boolean[] = [];
  for (let i = 0; i < channelData.length; i += frameSize) {
    const end = Math.min(i + frameSize, channelData.length);
    let sum = 0;
    for (let j = i; j < end; j++) {
      sum += channelData[j] * channelData[j];
    }
    const rms = Math.sqrt(sum / (end - i));
    frames.push(rms < thresholdLinear);
  }

  // Find silence regions
  const silenceRegions: { startFrame: number; endFrame: number }[] = [];
  let silenceStart: number | null = null;
  for (let i = 0; i < frames.length; i++) {
    if (frames[i]) {
      if (silenceStart === null) silenceStart = i;
    } else {
      if (silenceStart !== null) {
        if (i - silenceStart >= minSilenceFrames) {
          silenceRegions.push({ startFrame: silenceStart, endFrame: i });
        }
        silenceStart = null;
      }
    }
  }
  if (silenceStart !== null && frames.length - silenceStart >= minSilenceFrames) {
    silenceRegions.push({ startFrame: silenceStart, endFrame: frames.length });
  }

  // Convert to boundary points at silence midpoints
  const boundaries: BoundaryPoint[] = [];
  let prevTime = 0;
  for (const region of silenceRegions) {
    const midFrame = Math.floor((region.startFrame + region.endFrame) / 2);
    const time = (midFrame * frameSize) / sampleRate;

    // Skip if resulting chunk would be too short
    if ((time - prevTime) * 1000 >= minChunkDurationMs) {
      boundaries.push({
        time,
        source: 'silence',
        confidence: 0.8,
      });
      prevTime = time;
    }
  }

  return boundaries;
}

// ─── Duration-Based Boundaries ─────────────────────────────────────────────

/**
 * Create boundaries at fixed intervals, optionally snapping to preferred points.
 */
export function computeDurationBoundaries(
  totalDuration: number,
  startTime: number,
  params: Record<string, number | string | boolean>,
  preferredPoints?: BoundaryPoint[],
): BoundaryPoint[] {
  const targetMs = params.targetMs as number | undefined;
  const maxMs = params.maxMs as number | undefined;
  const intervalMs = targetMs ?? maxMs ?? 5000;
  const intervalSec = intervalMs / 1000;

  const boundaries: BoundaryPoint[] = [];
  let t = startTime + intervalSec;

  while (t < startTime + totalDuration - 0.1) {
    let bestTime = t;

    // Snap to nearest preferred point within 30% of interval
    if (preferredPoints && preferredPoints.length > 0) {
      const snapWindow = intervalSec * 0.3;
      const nearby = preferredPoints.filter(
        p => Math.abs(p.time - t) <= snapWindow,
      );
      if (nearby.length > 0) {
        bestTime = nearby.reduce((best, p) =>
          Math.abs(p.time - t) < Math.abs(best.time - t) ? p : best,
        ).time;
      }
    }

    boundaries.push({
      time: bestTime,
      source: targetMs ? 'manual' : 'manual',
      confidence: 0.6,
    });
    t = bestTime + intervalSec;
  }

  return boundaries;
}

// ─── Word-Level Boundaries ─────────────────────────────────────────────────

/**
 * Create a boundary between every word (one-word-per-chunk).
 */
export function computeWordBoundaries(
  words: TranscribedWord[],
  audioRange: AudioRange,
): BoundaryPoint[] {
  if (words.length <= 1) return [];

  const rangeWords = words
    .filter(w => w.startTime >= audioRange.startTime && w.endTime <= audioRange.endTime)
    .sort((a, b) => a.startTime - b.startTime);

  const boundaries: BoundaryPoint[] = [];
  for (let i = 0; i < rangeWords.length - 1; i++) {
    // Boundary at midpoint between word end and next word start
    const gapMid = (rangeWords[i].endTime + rangeWords[i + 1].startTime) / 2;
    boundaries.push({
      time: gapMid,
      source: 'word-level',
      confidence: 1.0,
    });
  }

  return boundaries;
}

// ─── Configuration from Boundaries ─────────────────────────────────────────

/**
 * Create a Configuration object from boundary points and criteria.
 */
export function createConfiguration(
  name: string,
  boundaries: BoundaryPoint[],
  criteria: DivisionCriterion[],
  source: Configuration['source'],
  presetId?: string,
): Configuration {
  return {
    id: uuid(),
    name,
    boundaries: [...boundaries].sort((a, b) => a.time - b.time),
    presetId: presetId ?? null,
    criteria,
    createdAt: Date.now(),
    source,
    chunkOverrides: {},
  };
}

// ─── Boundaries from Existing Chunks ───────────────────────────────────────

/**
 * Extract boundary points from an existing chunk layout.
 * Useful when creating the initial configuration from silence-based segmentation.
 */
export function boundariesFromChunks(
  chunks: Chunk[],
  sectionId: string,
): BoundaryPoint[] {
  const sectionChunks = chunks
    .filter(c => c.sectionId === sectionId && !c.isDeleted)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  if (sectionChunks.length <= 1) return [];

  const boundaries: BoundaryPoint[] = [];
  for (let i = 0; i < sectionChunks.length - 1; i++) {
    // Boundary between consecutive chunks
    const boundary = (sectionChunks[i].endTime + sectionChunks[i + 1].startTime) / 2;
    boundaries.push({
      time: boundary,
      source: 'silence', // assume initial chunks from silence detection
      confidence: 0.8,
    });
  }

  return boundaries;
}

// ─── Compute Boundaries Orchestrator ───────────────────────────────────────

import {
  detectVolumeFluctuations,
  detectLoudnessBoundaries,
  detectCadenceBoundaries,
} from './audioAnalysis';
import { computeGrammarBoundaries } from './grammarDivision';

/**
 * Orchestrator: run each enabled criterion, merge results into final boundaries.
 * Each criterion produces candidates. Candidates are weighted, pooled, and merged.
 */
export function computeBoundaries(
  criteria: DivisionCriterion[],
  channelData: Float32Array | null,
  sampleRate: number,
  audioRange: AudioRange,
  words?: TranscribedWord[],
  minConfidence = 0.3,
): BoundaryPoint[] {
  const allCandidates: BoundaryPoint[] = [];

  for (const criterion of criteria) {
    if (!criterion.enabled) continue;

    let candidates: BoundaryPoint[] = [];

    switch (criterion.type) {
      case 'silence':
        if (channelData) {
          candidates = computeSilenceBoundaries(channelData, sampleRate, criterion.params);
        }
        break;

      case 'volume-fluctuation':
        if (channelData) {
          candidates = detectVolumeFluctuations(channelData, sampleRate, {
            fluctuationThresholdDb: criterion.params.fluctuationThresholdDb as number | undefined,
            smoothingWindowMs: criterion.params.smoothingWindowMs as number | undefined,
            minGapMs: criterion.params.minGapMs as number | undefined,
          });
        }
        break;

      case 'loudness':
        if (channelData) {
          candidates = detectLoudnessBoundaries(channelData, sampleRate, {
            loudnessThresholdLufs: criterion.params.loudnessThresholdLufs as number | undefined,
            windowMs: criterion.params.windowMs as number | undefined,
            minGapMs: criterion.params.minGapMs as number | undefined,
          });
        }
        break;

      case 'cadence':
        if (channelData) {
          candidates = detectCadenceBoundaries(channelData, sampleRate, {
            silenceThresholdDb: criterion.params.silenceThresholdDb as number | undefined,
            minPauseDurationMs: criterion.params.minPauseDurationMs as number | undefined,
            phraseGrouping: criterion.params.phraseGrouping as number | undefined,
          });
        }
        break;

      case 'max-duration':
      case 'target-duration':
        candidates = computeDurationBoundaries(
          audioRange.endTime - audioRange.startTime,
          audioRange.startTime,
          criterion.params,
        );
        break;

      case 'grammar':
        if (words && words.length > 0) {
          candidates = computeGrammarBoundaries(words, {
            granularity: criterion.params.granularity as 'sentence' | 'clause' | 'phrase' | undefined,
            minPauseBetweenMs: criterion.params.minPauseBetweenMs as number | undefined,
          });
        }
        break;

      case 'word-level':
        if (words) {
          candidates = computeWordBoundaries(words, audioRange);
        }
        break;

      case 'topic':
        // Async — handled separately via topicDivision.ts
        break;

      case 'manual':
        // Manual boundaries are added directly, not computed
        break;
    }

    // Apply criterion weight to each candidate's confidence
    const weighted = candidates.map(b => ({
      ...b,
      confidence: b.confidence * criterion.weight,
    }));
    allCandidates.push(...weighted);
  }

  return mergeBoundaries(allCandidates, minConfidence);
}
