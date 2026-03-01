import { v4 as uuid } from 'uuid';
import type { Chunk, AudioBufferRef } from '../types';

/**
 * Decode an audio file into an AudioBuffer
 */
export async function decodeAudioFile(
  file: File,
  audioContext: AudioContext
): Promise<AudioBufferRef> {
  const arrayBuffer = await file.arrayBuffer();
  const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

  return {
    id: uuid(),
    originalFileName: file.name,
    blob: new Blob([arrayBuffer], { type: file.type }),
    decodedBuffer,
    sampleRate: decodedBuffer.sampleRate,
    duration: decodedBuffer.duration,
  };
}

/**
 * Silence-based segmentation (spec §2A)
 * Analyzes audio for silence gaps and splits into phrase-level chunks.
 */
export function segmentAudio(
  buffer: AudioBuffer,
  audioBufferId: string,
  sectionId: string,
  options: {
    silenceThresholdDb: number;
    minSilenceDurationMs: number;
    minChunkDurationMs: number;
  }
): Chunk[] {
  const { silenceThresholdDb, minSilenceDurationMs, minChunkDurationMs } = options;

  // Convert dB threshold to linear amplitude
  const thresholdLinear = Math.pow(10, silenceThresholdDb / 20);

  // Get mono channel data (mix down if stereo)
  const channelData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  // Analysis window: 10ms frames
  const frameSize = Math.floor(sampleRate * 0.01);
  const minSilenceFrames = Math.ceil(
    (minSilenceDurationMs / 1000) * sampleRate / frameSize
  );
  const minChunkSamples = Math.floor((minChunkDurationMs / 1000) * sampleRate);

  // Compute RMS energy per frame
  const frames: { rms: number; isSilent: boolean }[] = [];
  for (let i = 0; i < channelData.length; i += frameSize) {
    const end = Math.min(i + frameSize, channelData.length);
    let sum = 0;
    for (let j = i; j < end; j++) {
      sum += channelData[j] * channelData[j];
    }
    const rms = Math.sqrt(sum / (end - i));
    frames.push({ rms, isSilent: rms < thresholdLinear });
  }

  // Find silence regions (consecutive silent frames >= minSilenceFrames)
  const silenceRegions: { startFrame: number; endFrame: number }[] = [];
  let silenceStart: number | null = null;

  for (let i = 0; i < frames.length; i++) {
    if (frames[i].isSilent) {
      if (silenceStart === null) silenceStart = i;
    } else {
      if (silenceStart !== null) {
        const length = i - silenceStart;
        if (length >= minSilenceFrames) {
          silenceRegions.push({ startFrame: silenceStart, endFrame: i });
        }
        silenceStart = null;
      }
    }
  }
  // Handle trailing silence
  if (silenceStart !== null && frames.length - silenceStart >= minSilenceFrames) {
    silenceRegions.push({ startFrame: silenceStart, endFrame: frames.length });
  }

  // Convert silence regions to split points (midpoint of each silence)
  const splitPoints: number[] = silenceRegions.map((r) => {
    const midFrame = Math.floor((r.startFrame + r.endFrame) / 2);
    return (midFrame * frameSize) / sampleRate;
  });

  // Build chunks from split points
  const chunks: Chunk[] = [];
  let prevTime = 0;
  const allSplits = [...splitPoints, buffer.duration];

  for (let i = 0; i < allSplits.length; i++) {
    const endTime = allSplits[i];
    const durationMs = (endTime - prevTime) * 1000;

    // Skip micro-chunks below minimum duration
    if (durationMs < minChunkDurationMs && i < allSplits.length - 1) {
      continue;
    }

    if (endTime > prevTime) {
      chunks.push({
        id: uuid(),
        audioBufferId,
        startTime: prevTime,
        endTime,
        sectionId,
        orderIndex: chunks.length,
        color: null,
        isDeleted: false,
        waveformData: null,
      });
    }
    prevTime = endTime;
  }

  // If no chunks were created (e.g., very short audio), create one chunk for the whole thing
  if (chunks.length === 0 && buffer.duration > 0) {
    chunks.push({
      id: uuid(),
      audioBufferId,
      startTime: 0,
      endTime: buffer.duration,
      sectionId,
      orderIndex: 0,
      color: null,
      isDeleted: false,
      waveformData: null,
    });
  }

  // Compute waveform data for each chunk
  for (const chunk of chunks) {
    chunk.waveformData = computeWaveformPeaks(
      channelData,
      sampleRate,
      chunk.startTime,
      chunk.endTime,
      100 // peaks per chunk for rendering
    );
  }

  return chunks;
}

/**
 * Compute waveform peak data for a time range.
 * Returns normalized peak values (0-1) for rendering.
 */
export function computeWaveformPeaks(
  channelData: Float32Array,
  sampleRate: number,
  startTime: number,
  endTime: number,
  numPeaks: number
): number[] {
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.min(
    Math.floor(endTime * sampleRate),
    channelData.length
  );
  const totalSamples = endSample - startSample;
  const samplesPerPeak = Math.max(1, Math.floor(totalSamples / numPeaks));

  const peaks: number[] = [];
  for (let i = 0; i < numPeaks; i++) {
    const start = startSample + i * samplesPerPeak;
    const end = Math.min(start + samplesPerPeak, endSample);
    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > max) max = abs;
    }
    peaks.push(max);
  }

  return peaks;
}

/**
 * Recompute waveform data for a chunk (after split/merge)
 */
export function recomputeWaveform(
  chunk: Chunk,
  buffer: AudioBuffer
): number[] {
  const channelData = buffer.getChannelData(0);
  return computeWaveformPeaks(
    channelData,
    buffer.sampleRate,
    chunk.startTime,
    chunk.endTime,
    100
  );
}
