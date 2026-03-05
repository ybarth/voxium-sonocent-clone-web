/**
 * Qwen TTS (CosyVoice) provider for the synthetic layer.
 * Uses Alibaba's CosyVoice model via Hugging Face Inference API.
 *
 * Note: This provider requires a Hugging Face API token with access to the
 * CosyVoice model, or a self-hosted endpoint URL.
 */

import type { SyntheticTtsProvider, TtsGenerateResult, TtsWordTimestamp, HeadTtsInputItem } from './syntheticTtsProvider';

export const QWEN_VOICES = [
  { id: 'default', name: 'Default' },
  { id: 'chinese_female', name: 'Chinese Female' },
  { id: 'chinese_male', name: 'Chinese Male' },
  { id: 'english_female', name: 'English Female' },
  { id: 'english_male', name: 'English Male' },
] as const;

const HF_INFERENCE_URL = 'https://api-inference.huggingface.co/models/FunAudioLLM/CosyVoice2-0.5B';

export class QwenTtsProvider implements SyntheticTtsProvider {
  private audioContext: AudioContext;
  private currentVoice: string;
  private currentSpeed: number;
  private apiToken: string;
  private ready = false;

  constructor(audioContext: AudioContext, voice = 'default', speed = 1.0, apiToken = '') {
    this.audioContext = audioContext;
    this.currentVoice = voice;
    this.currentSpeed = speed;
    this.apiToken = apiToken;
  }

  async connect(onProgress?: (msg: string) => void): Promise<void> {
    // Check for HF API token in localStorage or env
    const token = this.apiToken
      || localStorage.getItem('voxium_hf_api_token')
      || (import.meta.env.VITE_HF_API_TOKEN as string)
      || '';

    if (!token) {
      throw new Error(
        'Qwen TTS requires a Hugging Face API token. ' +
        'Set VITE_HF_API_TOKEN in your .env or configure it in Settings.'
      );
    }

    this.apiToken = token;
    onProgress?.('Checking Qwen TTS availability...');

    // Verify endpoint is reachable
    try {
      const response = await fetch(HF_INFERENCE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: 'test' }),
      });

      if (response.status === 503) {
        onProgress?.('Model is loading on Hugging Face — this may take a few minutes...');
        // Model loading — we'll still mark as ready and retry on generate
      } else if (!response.ok && response.status !== 200) {
        const text = await response.text();
        throw new Error(`Qwen TTS endpoint error: ${response.status} — ${text}`);
      }
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new Error('Cannot reach Hugging Face Inference API. Check your network connection.');
      }
      throw err;
    }

    this.ready = true;
    onProgress?.('Qwen TTS ready');
  }

  async generate(
    input: string | HeadTtsInputItem[],
    options?: { speed?: number; voice?: string },
  ): Promise<TtsGenerateResult> {
    if (!this.ready) throw new Error('Qwen TTS provider not connected');

    const text = typeof input === 'string'
      ? input
      : input.filter(i => i.type === 'text').map(i => String(i.value)).join(' ');

    if (!text.trim()) {
      const sampleRate = this.audioContext.sampleRate;
      const silentBuffer = this.audioContext.createBuffer(1, sampleRate, sampleRate);
      return { audioBuffer: silentBuffer, wordTimestamps: [], totalDuration: 1 };
    }

    const response = await fetch(HF_INFERENCE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: text,
        parameters: {
          voice: options?.voice ?? this.currentVoice,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Qwen TTS error: ${response.status} — ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));

    // Approximate word timestamps (CosyVoice doesn't return alignment data)
    const words = text.split(/\s+/).filter(Boolean);
    const wordDuration = audioBuffer.duration / Math.max(1, words.length);
    const wordTimestamps: TtsWordTimestamp[] = words.map((word, i) => ({
      word,
      startTimeMs: i * wordDuration * 1000,
      durationMs: wordDuration * 1000,
      startTimeSec: i * wordDuration,
      endTimeSec: (i + 1) * wordDuration,
    }));

    return {
      audioBuffer,
      wordTimestamps,
      totalDuration: audioBuffer.duration,
    };
  }

  isReady() { return this.ready; }

  setVoice(voiceId: string) { this.currentVoice = voiceId; }
  setSpeed(speed: number) { this.currentSpeed = Math.max(0.25, Math.min(4, speed)); }

  get voice() { return this.currentVoice; }
  get speed() { return this.currentSpeed; }
}
