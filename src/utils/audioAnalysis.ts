// Audio Analysis — Volume fluctuation, loudness, duration, and cadence detection
// All functions operate on Float32Array channel data and return BoundaryPoint[]

import type { BoundaryPoint } from '../types/configuration';

// ─── Volume Fluctuation Detection ──────────────────────────────────────────

/**
 * Detect volume fluctuation boundaries using first derivative of RMS envelope.
 * Splits at significant zero crossings of the envelope's rate of change.
 */
export function detectVolumeFluctuations(
  channelData: Float32Array,
  sampleRate: number,
  params: {
    fluctuationThresholdDb?: number;
    smoothingWindowMs?: number;
    minGapMs?: number;
  } = {},
): BoundaryPoint[] {
  const {
    fluctuationThresholdDb = -6,
    smoothingWindowMs = 50,
    minGapMs = 300,
  } = params;

  const frameSize = Math.floor(sampleRate * 0.01); // 10ms frames
  const smoothingFrames = Math.max(1, Math.floor(smoothingWindowMs / 10));
  const minGapFrames = Math.floor(minGapMs / 10);

  // Compute RMS envelope
  const rmsValues: number[] = [];
  for (let i = 0; i < channelData.length; i += frameSize) {
    const end = Math.min(i + frameSize, channelData.length);
    let sum = 0;
    for (let j = i; j < end; j++) {
      sum += channelData[j] * channelData[j];
    }
    rmsValues.push(Math.sqrt(sum / (end - i)));
  }

  // Smooth the envelope
  const smoothed: number[] = [];
  for (let i = 0; i < rmsValues.length; i++) {
    const start = Math.max(0, i - Math.floor(smoothingFrames / 2));
    const end = Math.min(rmsValues.length, i + Math.ceil(smoothingFrames / 2));
    let sum = 0;
    for (let j = start; j < end; j++) sum += rmsValues[j];
    smoothed.push(sum / (end - start));
  }

  // Compute first derivative
  const derivative: number[] = [];
  for (let i = 1; i < smoothed.length; i++) {
    derivative.push(smoothed[i] - smoothed[i - 1]);
  }

  // Find significant zero crossings (negative-to-positive = volume dip)
  const thresholdLinear = Math.pow(10, fluctuationThresholdDb / 20);
  const boundaries: BoundaryPoint[] = [];
  let lastBoundaryFrame = -minGapFrames;

  for (let i = 1; i < derivative.length; i++) {
    if (derivative[i - 1] < -thresholdLinear * 0.01 && derivative[i] > thresholdLinear * 0.01) {
      if (i - lastBoundaryFrame >= minGapFrames) {
        boundaries.push({
          time: (i * frameSize) / sampleRate,
          source: 'volume-fluctuation',
          confidence: Math.min(1, Math.abs(derivative[i] - derivative[i - 1]) / (thresholdLinear * 0.05)),
        });
        lastBoundaryFrame = i;
      }
    }
  }

  return boundaries;
}

// ─── Loudness Boundary Detection ───────────────────────────────────────────

/**
 * Detect boundaries where loudness drops significantly.
 * Uses K-weighted RMS approximation over 400ms windows.
 */
export function detectLoudnessBoundaries(
  channelData: Float32Array,
  sampleRate: number,
  params: {
    loudnessThresholdLufs?: number;
    windowMs?: number;
    minGapMs?: number;
  } = {},
): BoundaryPoint[] {
  const {
    loudnessThresholdLufs = -30,
    windowMs = 400,
    minGapMs = 500,
  } = params;

  const windowSamples = Math.floor(sampleRate * windowMs / 1000);
  const hopSamples = Math.floor(windowSamples / 4); // 75% overlap
  const minGapSamples = Math.floor(sampleRate * minGapMs / 1000);

  // Simple K-weighting approximation: high-shelf boost + high-pass filter
  // For simplicity, we use unweighted RMS and convert to approximate LUFS
  const loudnessValues: { time: number; lufs: number }[] = [];

  for (let i = 0; i + windowSamples <= channelData.length; i += hopSamples) {
    let sum = 0;
    for (let j = i; j < i + windowSamples; j++) {
      sum += channelData[j] * channelData[j];
    }
    const rms = Math.sqrt(sum / windowSamples);
    // Approximate LUFS from RMS (offset by ~0.691 for K-weighting approximation)
    const lufs = rms > 0 ? 20 * Math.log10(rms) - 0.691 : -100;
    loudnessValues.push({
      time: (i + windowSamples / 2) / sampleRate,
      lufs,
    });
  }

  // Find drops below threshold
  const boundaries: BoundaryPoint[] = [];
  let lastBoundarySample = -minGapSamples;
  let wasAbove = false;

  for (const { time, lufs } of loudnessValues) {
    const sample = Math.floor(time * sampleRate);
    if (lufs > loudnessThresholdLufs) {
      wasAbove = true;
    } else if (wasAbove && lufs <= loudnessThresholdLufs) {
      if (sample - lastBoundarySample >= minGapSamples) {
        boundaries.push({
          time,
          source: 'loudness',
          confidence: Math.min(1, Math.abs(lufs - loudnessThresholdLufs) / 10),
        });
        lastBoundarySample = sample;
      }
      wasAbove = false;
    }
  }

  return boundaries;
}

// ─── Cadence (Speech Rhythm) Detection ─────────────────────────────────────

/**
 * Detect phrase boundaries from speech rhythm patterns.
 * Groups pauses by their duration to identify natural phrase boundaries.
 */
export function detectCadenceBoundaries(
  channelData: Float32Array,
  sampleRate: number,
  params: {
    silenceThresholdDb?: number;
    minPauseDurationMs?: number;
    phraseGrouping?: number;
  } = {},
): BoundaryPoint[] {
  const {
    silenceThresholdDb = -35,
    minPauseDurationMs = 150,
    phraseGrouping = 2,
  } = params;

  const thresholdLinear = Math.pow(10, silenceThresholdDb / 20);
  const frameSize = Math.floor(sampleRate * 0.01); // 10ms frames
  const minPauseFrames = Math.ceil((minPauseDurationMs / 1000) * sampleRate / frameSize);

  // Detect all pauses (including short ones)
  const pauses: { startFrame: number; endFrame: number; duration: number }[] = [];
  let pauseStart: number | null = null;

  for (let i = 0; i < channelData.length; i += frameSize) {
    const end = Math.min(i + frameSize, channelData.length);
    let sum = 0;
    for (let j = i; j < end; j++) {
      sum += channelData[j] * channelData[j];
    }
    const rms = Math.sqrt(sum / (end - i));
    const frameIdx = Math.floor(i / frameSize);

    if (rms < thresholdLinear) {
      if (pauseStart === null) pauseStart = frameIdx;
    } else {
      if (pauseStart !== null) {
        const duration = frameIdx - pauseStart;
        if (duration >= minPauseFrames) {
          pauses.push({ startFrame: pauseStart, endFrame: frameIdx, duration });
        }
        pauseStart = null;
      }
    }
  }

  if (pauses.length === 0) return [];

  // Sort pauses by duration (longest first) and use phraseGrouping
  // to determine which pauses constitute phrase boundaries
  const sortedByDuration = [...pauses].sort((a, b) => b.duration - a.duration);
  const medianDuration = sortedByDuration[Math.floor(sortedByDuration.length / 2)].duration;
  const phraseThreshold = medianDuration * phraseGrouping;

  const boundaries: BoundaryPoint[] = [];
  for (const pause of pauses) {
    const midFrame = Math.floor((pause.startFrame + pause.endFrame) / 2);
    const time = (midFrame * frameSize) / sampleRate;
    const confidence = Math.min(1, pause.duration / phraseThreshold);

    if (pause.duration >= medianDuration) {
      boundaries.push({
        time,
        source: 'cadence',
        confidence: Math.max(0.3, confidence),
      });
    }
  }

  return boundaries.sort((a, b) => a.time - b.time);
}
