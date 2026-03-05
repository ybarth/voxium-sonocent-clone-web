/**
 * Web Speech API synthetic TTS provider.
 * Generates silent AudioBuffers (for engine timing) and speaks in real-time
 * during playback via speechSynthesis.
 */

import type { SyntheticTtsProvider, TtsGenerateResult, TtsWordTimestamp, HeadTtsInputItem } from './syntheticTtsProvider';

export const WEB_SPEECH_PROVIDER_ID = 'web-speech';

export class WebSpeechSyntheticProvider implements SyntheticTtsProvider {
  private audioContext: AudioContext;
  private currentVoice: string;
  private currentSpeed: number;
  private ready = false;
  private voices: SpeechSynthesisVoice[] = [];

  constructor(audioContext: AudioContext, voice = '', speed = 1.0) {
    this.audioContext = audioContext;
    this.currentVoice = voice;
    this.currentSpeed = speed;
  }

  async connect(): Promise<void> {
    this.voices = speechSynthesis.getVoices();
    if (this.voices.length === 0) {
      await new Promise<void>(resolve => {
        speechSynthesis.addEventListener('voiceschanged', () => {
          this.voices = speechSynthesis.getVoices();
          resolve();
        }, { once: true });
        setTimeout(resolve, 2000);
      });
      this.voices = speechSynthesis.getVoices();
    }
    if (!this.currentVoice && this.voices.length > 0) {
      this.currentVoice = this.voices[0].voiceURI;
    }
    this.ready = true;
  }

  async generate(
    input: string | HeadTtsInputItem[],
    options?: { speed?: number; voice?: string },
  ): Promise<TtsGenerateResult> {
    const text = typeof input === 'string'
      ? input
      : input.filter(i => i.type === 'text').map(i => String(i.value)).join(' ');

    const words = text.split(/\s+/).filter(Boolean);
    const sampleRate = this.audioContext.sampleRate;
    const speed = options?.speed ?? this.currentSpeed;

    // Estimate duration (~150 words/min at 1x speed)
    const estimatedDuration = Math.max(0.1, (words.length / (150 / 60)) / speed);
    const length = Math.max(1, Math.round(estimatedDuration * sampleRate));
    const silentBuffer = this.audioContext.createBuffer(1, length, sampleRate);

    // Approximate word timestamps
    const wordDuration = estimatedDuration / Math.max(1, words.length);
    const wordTimestamps: TtsWordTimestamp[] = words.map((word, i) => ({
      word,
      startTimeMs: i * wordDuration * 1000,
      durationMs: wordDuration * 1000,
      startTimeSec: i * wordDuration,
      endTimeSec: (i + 1) * wordDuration,
    }));

    return {
      audioBuffer: silentBuffer,
      wordTimestamps,
      totalDuration: estimatedDuration,
    };
  }

  /** Speak text in real-time via speechSynthesis (called during playback).
   *  playbackRate is the overall playback speed multiplier from the transport. */
  speakRealtime(text: string, volume = 1.0, playbackRate = 1.0) {
    if (!text.trim()) return;
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    // Combine TTS engine speed with overall playback rate.
    // SpeechSynthesis rate range is roughly 0.1–10 depending on browser.
    utterance.rate = Math.min(10, Math.max(0.1, this.currentSpeed * playbackRate));
    utterance.volume = volume;

    if (this.currentVoice) {
      const voice = this.voices.find(v => v.voiceURI === this.currentVoice);
      if (voice) utterance.voice = voice;
    }

    speechSynthesis.speak(utterance);
  }

  /** Cancel any in-progress real-time speech */
  cancelRealtime() {
    speechSynthesis.cancel();
  }

  /** Get available system voices */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0) {
      this.voices = speechSynthesis.getVoices();
    }
    return this.voices;
  }

  isReady() { return this.ready; }

  setVoice(voiceId: string) { this.currentVoice = voiceId; }
  setSpeed(speed: number) { this.currentSpeed = Math.max(0.25, Math.min(4, speed)); }

  get voice() { return this.currentVoice; }
  get speed() { return this.currentSpeed; }
}

/** Get available Web Speech voices (can be called before provider is created) */
export function getWebSpeechVoices(): SpeechSynthesisVoice[] {
  return speechSynthesis.getVoices();
}
