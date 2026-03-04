// Audio extraction — slices AudioBuffer by chunk time ranges for STT upload

import type { Chunk, AudioBufferRef } from '../types';

/**
 * Encode an AudioBuffer to WAV Blob.
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt subchunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // subchunk1 size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);

  // data subchunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels and write 16-bit PCM
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = headerSize;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Extract audio for a set of chunks, concatenated in order, as a WAV Blob.
 * Chunks must all reference audio buffers that are already decoded.
 */
export function extractChunkAudio(
  chunks: Chunk[],
  audioBuffers: AudioBufferRef[],
  audioContext: AudioContext,
): Blob {
  if (chunks.length === 0) {
    throw new Error('No chunks provided for audio extraction');
  }

  const bufferMap = new Map(audioBuffers.map(b => [b.id, b]));

  // Calculate total duration
  let totalSamples = 0;
  const slices: { buffer: AudioBuffer; startSample: number; endSample: number }[] = [];

  for (const chunk of chunks) {
    const ref = bufferMap.get(chunk.audioBufferId);
    if (!ref?.decodedBuffer) {
      throw new Error(`Audio buffer not decoded for chunk ${chunk.id}`);
    }
    const buf = ref.decodedBuffer;
    const startSample = Math.floor(chunk.startTime * buf.sampleRate);
    const endSample = Math.min(Math.ceil(chunk.endTime * buf.sampleRate), buf.length);
    const sampleCount = endSample - startSample;
    totalSamples += sampleCount;
    slices.push({ buffer: buf, startSample, endSample });
  }

  // Use the sample rate from the first buffer
  const sampleRate = slices[0].buffer.sampleRate;
  const numChannels = slices[0].buffer.numberOfChannels;

  // Create output buffer
  const outputBuffer = audioContext.createBuffer(numChannels, totalSamples, sampleRate);

  let writeOffset = 0;
  for (const { buffer, startSample, endSample } of slices) {
    const sampleCount = endSample - startSample;
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = buffer.getChannelData(ch);
      const outputData = outputBuffer.getChannelData(ch);
      for (let i = 0; i < sampleCount; i++) {
        outputData[writeOffset + i] = channelData[startSample + i];
      }
    }
    writeOffset += sampleCount;
  }

  return audioBufferToWav(outputBuffer);
}

/**
 * Get the time offset of each chunk within the extracted audio.
 * Returns a map of chunkId → { offsetInExtracted, duration }.
 */
export function getChunkOffsets(
  chunks: Chunk[],
): Map<string, { offsetInExtracted: number; duration: number }> {
  const offsets = new Map<string, { offsetInExtracted: number; duration: number }>();
  let offset = 0;
  for (const chunk of chunks) {
    const duration = chunk.endTime - chunk.startTime;
    offsets.set(chunk.id, { offsetInExtracted: offset, duration });
    offset += duration;
  }
  return offsets;
}
