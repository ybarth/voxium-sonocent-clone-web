// TTS Engine — wraps Web Speech API for chunk announcements
import type { TtsConfig } from '../types';

export class TtsEngine {
  private synthesis: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];
  private voicesLoaded = false;
  private mainGainNode: GainNode | null = null;
  private originalVolume = 1.0;
  private isDucked = false;

  constructor() {
    this.synthesis = window.speechSynthesis;
    this.loadVoices();
  }

  private loadVoices() {
    const load = () => {
      this.voices = this.synthesis.getVoices();
      this.voicesLoaded = this.voices.length > 0;
    };
    load();
    if (!this.voicesLoaded) {
      this.synthesis.addEventListener('voiceschanged', load);
    }
  }

  /** Get available voices */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.voicesLoaded) {
      this.voices = this.synthesis.getVoices();
    }
    return this.voices;
  }

  /** Set the main audio gain node for ducking */
  setMainGainNode(gainNode: GainNode) {
    this.mainGainNode = gainNode;
  }

  /** Speak text with config */
  speak(text: string, config: TtsConfig) {
    console.log('[TTS] speak() called:', text, 'enabled:', config.enabled);
    if (!config.enabled) return;

    // Cancel any ongoing speech
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = config.speed;

    // Find voice by URI
    if (config.voiceUri) {
      const voice = this.voices.find((v) => v.voiceURI === config.voiceUri);
      if (voice) utterance.voice = voice;
    }

    // Duck main audio during speech
    if (config.duckMainAudio && this.mainGainNode) {
      this.duckAudio(config.duckLevel);
      utterance.onend = () => this.unduckAudio();
      utterance.onerror = () => this.unduckAudio();
    }

    this.synthesis.speak(utterance);
  }

  /** Cancel current speech */
  cancel() {
    this.synthesis.cancel();
    if (this.isDucked) this.unduckAudio();
  }

  private duckAudio(duckLevel: number) {
    if (!this.mainGainNode || this.isDucked) return;
    this.isDucked = true;
    this.originalVolume = this.mainGainNode.gain.value;
    const duckedVolume = this.originalVolume * (1 - duckLevel);
    this.mainGainNode.gain.setTargetAtTime(duckedVolume, this.mainGainNode.context.currentTime, 0.05);
  }

  private unduckAudio() {
    if (!this.mainGainNode || !this.isDucked) return;
    this.isDucked = false;
    this.mainGainNode.gain.setTargetAtTime(this.originalVolume, this.mainGainNode.context.currentTime, 0.05);
  }

  destroy() {
    this.synthesis.cancel();
    if (this.isDucked) this.unduckAudio();
  }
}

/** Generate TTS text for a chunk based on content mode */
export function getTtsText(
  contentMode: TtsConfig['contentMode'],
  chunkNumber: number,
  sectionName?: string,
  colorLabel?: string
): string {
  switch (contentMode) {
    case 'chunk-number':
      return `Chunk ${chunkNumber}`;
    case 'section-and-chunk':
      return sectionName ? `${sectionName}, Chunk ${chunkNumber}` : `Chunk ${chunkNumber}`;
    case 'color-label':
      return colorLabel ? `${colorLabel}, Chunk ${chunkNumber}` : `Chunk ${chunkNumber}`;
  }
}
