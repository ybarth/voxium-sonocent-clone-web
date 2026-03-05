/**
 * ElevenLabs TTS provider for the synthetic layer.
 * Generates AudioBuffers with word-level timestamps via the ElevenLabs API.
 */

import type { SyntheticTtsProvider, TtsGenerateResult, TtsWordTimestamp, HeadTtsInputItem } from './syntheticTtsProvider';
import { getElevenLabsApiKey } from './elevenLabsApi';

// Well-known ElevenLabs preset voices
export const ELEVENLABS_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie' },
  { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric' },
  { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris' },
  { id: 'N2lVS1w4EoAxZjlIdkCT', name: 'Callum' },
  { id: 'bIHbv24MWmeRgasZH58o', name: 'Will' },
] as const;

export const ELEVENLABS_MODELS = [
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2' },
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5' },
  { id: 'eleven_monolingual_v1', name: 'English v1' },
] as const;

export class ElevenLabsTtsProvider implements SyntheticTtsProvider {
  private audioContext: AudioContext;
  private currentVoice: string;
  private currentSpeed: number;
  private modelId: string;
  private apiKey = '';
  private ready = false;

  constructor(audioContext: AudioContext, voice: string, speed: number, modelId: string) {
    this.audioContext = audioContext;
    this.currentVoice = voice || ELEVENLABS_VOICES[0].id;
    this.currentSpeed = speed;
    this.modelId = modelId;
  }

  async connect(): Promise<void> {
    const key = getElevenLabsApiKey();
    if (!key) throw new Error('ElevenLabs API key not configured. Set it in Settings > AI Configuration.');
    this.apiKey = key;
    this.ready = true;
  }

  async generate(
    input: string | HeadTtsInputItem[],
    options?: { speed?: number; voice?: string },
  ): Promise<TtsGenerateResult> {
    if (!this.ready) throw new Error('ElevenLabs provider not connected');

    const text = typeof input === 'string'
      ? input
      : input.filter(i => i.type === 'text').map(i => String(i.value)).join(' ');

    if (!text.trim()) {
      const sampleRate = this.audioContext.sampleRate;
      const silentBuffer = this.audioContext.createBuffer(1, sampleRate, sampleRate);
      return { audioBuffer: silentBuffer, wordTimestamps: [], totalDuration: 1 };
    }

    const voiceId = options?.voice ?? this.currentVoice;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: this.modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`ElevenLabs TTS error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    const audioBase64 = data.audio_base64;
    const alignment = data.alignment;

    // Decode base64 audio to ArrayBuffer
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer.slice(0));

    const wordTimestamps = buildWordTimestamps(alignment);

    return {
      audioBuffer,
      wordTimestamps,
      totalDuration: audioBuffer.duration,
    };
  }

  isReady() { return this.ready; }

  setVoice(voiceId: string) { this.currentVoice = voiceId; }
  setSpeed(speed: number) { this.currentSpeed = Math.max(0.25, Math.min(4, speed)); }
  setModel(modelId: string) { this.modelId = modelId; }

  get voice() { return this.currentVoice; }
  get speed() { return this.currentSpeed; }
  get model() { return this.modelId; }
}

/** Build word-level timestamps from ElevenLabs character alignment data */
function buildWordTimestamps(
  alignment?: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  },
): TtsWordTimestamp[] {
  if (!alignment?.characters) return [];

  const { characters, character_start_times_seconds, character_end_times_seconds } = alignment;
  const timestamps: TtsWordTimestamp[] = [];
  let currentWord = '';
  let wordStart = 0;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    const isLast = i === characters.length - 1;

    if (char === ' ' || isLast) {
      if (isLast && char !== ' ') currentWord += char;

      if (currentWord) {
        const endIdx = isLast ? i : i - 1;
        const wordEnd = character_end_times_seconds[endIdx] ?? 0;
        timestamps.push({
          word: currentWord,
          startTimeMs: wordStart * 1000,
          durationMs: (wordEnd - wordStart) * 1000,
          startTimeSec: wordStart,
          endTimeSec: wordEnd,
        });
      }
      currentWord = '';
      if (i + 1 < characters.length) {
        wordStart = character_start_times_seconds[i + 1] ?? 0;
      }
    } else {
      if (currentWord === '') {
        wordStart = character_start_times_seconds[i] ?? 0;
      }
      currentWord += char;
    }
  }

  return timestamps;
}
