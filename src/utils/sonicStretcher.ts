/**
 * Sonic WASM time-stretcher — uses @echogarden/sonic-wasm (libsonic PICOLA)
 * for high-quality time-stretching at extreme speed ranges.
 *
 * Hybrid strategy: use existing WSOLA for moderate stretching,
 * switch to sonic-wasm for extreme ranges (> 2x the HeadTTS native speed).
 */

import { timeStretchRegion } from './timeStretch';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sonicModule: any = null;
let sonicReady = false;
let sonicInitPromise: Promise<void> | null = null;

/** Load and initialize the sonic WASM module */
export async function initSonic(): Promise<void> {
  if (sonicReady) return;
  if (sonicInitPromise) return sonicInitPromise;

  sonicInitPromise = (async () => {
    try {
      const SonicFactory = (await import('@echogarden/sonic-wasm')).default;
      sonicModule = await SonicFactory();
      sonicReady = true;
      console.log('Sonic WASM initialized');
    } catch (err) {
      console.error('Failed to initialize sonic-wasm:', err);
      sonicInitPromise = null;
      throw err;
    }
  })();

  return sonicInitPromise;
}

/**
 * Time-stretch an AudioBuffer using sonic-wasm (PICOLA algorithm).
 * @param buffer Input AudioBuffer
 * @param rate Speed factor (> 1 = faster, < 1 = slower)
 * @param ctx AudioContext for creating the output buffer
 */
export function sonicStretch(
  buffer: AudioBuffer,
  rate: number,
  ctx: BaseAudioContext,
): AudioBuffer {
  if (!sonicReady || !sonicModule) {
    throw new Error('Sonic WASM not initialized. Call initSonic() first.');
  }

  const sampleRate = buffer.sampleRate;
  const channels = buffer.numberOfChannels;
  const inputLength = buffer.length;

  // Process each channel independently using sonicChangeFloatSpeed
  const estimatedOutputLength = Math.ceil(inputLength / rate) + 1024;
  const channelOutputs: Float32Array[] = [];
  let actualOutputLength = 0;

  for (let ch = 0; ch < channels; ch++) {
    const inputData = buffer.getChannelData(ch);

    // Allocate WASM memory for input
    const inputPtr = sonicModule._malloc(inputLength * 4);
    const outputPtr = sonicModule._malloc(estimatedOutputLength * 4);
    const outputLenPtr = sonicModule._malloc(4);

    // Copy input to WASM heap
    sonicModule.HEAPF32.set(inputData, inputPtr / 4);

    // Set output length initial value
    sonicModule.setValue(outputLenPtr, estimatedOutputLength, 'i32');

    // Call sonic stretch: sonicChangeFloatSpeed(samples, numSamples, speed, pitch, rate, volume, sampleRate, numChannels, outputSamples)
    // Using speed parameter for time-stretching (preserves pitch)
    const result = sonicModule._sonicChangeFloatSpeed(
      inputPtr,
      inputLength,
      rate,       // speed
      1.0,        // pitch (no pitch change)
      1.0,        // rate (sample rate change factor, 1.0 = no change)
      1.0,        // volume
      sampleRate,
      1,          // process as mono (we handle channels ourselves)
      outputPtr,
    );

    if (result > 0) {
      const outputData = new Float32Array(result);
      outputData.set(sonicModule.HEAPF32.subarray(outputPtr / 4, outputPtr / 4 + result));
      channelOutputs.push(outputData);
      actualOutputLength = Math.max(actualOutputLength, result);
    } else {
      // Fallback: return input unchanged
      channelOutputs.push(new Float32Array(inputData));
      actualOutputLength = inputLength;
    }

    // Free WASM memory
    sonicModule._free(inputPtr);
    sonicModule._free(outputPtr);
    sonicModule._free(outputLenPtr);
  }

  // Create output AudioBuffer
  const outputBuffer = ctx.createBuffer(channels, actualOutputLength, sampleRate);
  for (let ch = 0; ch < channels; ch++) {
    const data = channelOutputs[ch];
    const channelData = outputBuffer.getChannelData(ch);
    channelData.set(data.subarray(0, actualOutputLength));
  }

  return outputBuffer;
}

/**
 * Hybrid time-stretching for the synthetic layer.
 * Uses WSOLA for moderate speeds, sonic-wasm for extreme speeds.
 *
 * @param buffer Input AudioBuffer (TTS-generated audio)
 * @param headTtsSpeed The speed HeadTTS generated at (e.g., 1.0)
 * @param targetSpeed The desired playback speed
 * @param ctx AudioContext
 */
export function stretchSynthetic(
  buffer: AudioBuffer,
  headTtsSpeed: number,
  targetSpeed: number,
  ctx: BaseAudioContext,
): AudioBuffer {
  // Total stretch factor needed
  const stretchRate = targetSpeed / headTtsSpeed;

  if (Math.abs(stretchRate - 1.0) < 0.01) {
    return buffer; // No stretching needed
  }

  // Use WSOLA for moderate stretching (up to 2x), sonic for extreme
  if (stretchRate <= 2.0 && sonicReady) {
    // For moderate, WSOLA is fine
    return timeStretchRegion(buffer, 0, buffer.duration, stretchRate, ctx);
  }

  if (sonicReady) {
    return sonicStretch(buffer, stretchRate, ctx);
  }

  // Fallback to WSOLA if sonic isn't loaded
  return timeStretchRegion(buffer, 0, buffer.duration, stretchRate, ctx);
}

/**
 * Adjust word timestamps by a stretch factor.
 */
export function adjustTimestamps<T extends { startTimeMs: number; durationMs: number; startTimeSec: number; endTimeSec: number }>(
  timestamps: T[],
  stretchFactor: number,
): T[] {
  if (Math.abs(stretchFactor - 1.0) < 0.001) return timestamps;

  return timestamps.map(t => ({
    ...t,
    startTimeMs: t.startTimeMs / stretchFactor,
    durationMs: t.durationMs / stretchFactor,
    startTimeSec: t.startTimeSec / stretchFactor,
    endTimeSec: t.endTimeSec / stretchFactor,
  }));
}
