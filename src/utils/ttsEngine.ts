// TTS Engine — wraps Web Speech API for chunk announcements
import type { TtsConfig, TtsChunkCountingMode, TtsContentMode } from '../types';
import type { VoiceAttribute } from '../types/scheme';

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

  /** Speak text with config, optionally overriding voice/pitch from a form's VoiceAttribute */
  speak(text: string, config: TtsConfig, voiceOverride?: VoiceAttribute) {
    console.log('[TTS] speak() called:', text, 'enabled:', config.enabled);
    if (!config.enabled) return;

    // Cancel any ongoing speech
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = config.speed;
    utterance.pitch = voiceOverride?.pitch ?? config.pitch ?? 1.0;

    // Resolve voice: override first, then config
    const voiceUri = voiceOverride?.voiceUri || config.voiceUri;
    if (voiceUri) {
      const voice = this.voices.find((v) => v.voiceURI === voiceUri);
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

/** Generate TTS text for a chunk based on content mode and counting mode */
export function getTtsText(
  contentMode: TtsContentMode,
  chunkCountingMode: TtsChunkCountingMode,
  projectChunkNumber: number,
  sectionChunkNumber: number,
  sectionNumber: number,
  sectionName?: string,
  colorLabel?: string
): string {
  let numberPart: string;

  switch (chunkCountingMode) {
    case 'section-relative':
      numberPart = `${sectionChunkNumber}`;
      break;
    case 'project-relative':
      numberPart = `${projectChunkNumber}`;
      break;
    case 'section-and-chunk':
      numberPart = sectionName
        ? `${sectionName}, ${sectionChunkNumber}`
        : `Section ${sectionNumber}, ${sectionChunkNumber}`;
      break;
    case 'full':
      numberPart = sectionName
        ? `${sectionName}, ${sectionChunkNumber} of ${projectChunkNumber}`
        : `Section ${sectionNumber}, ${sectionChunkNumber} of ${projectChunkNumber}`;
      break;
  }

  if (contentMode === 'color-label' && colorLabel) {
    return `${colorLabel}, ${numberPart}`;
  }

  return numberPart;
}

/** Generate TTS text for a section announcement */
export function getSectionTtsText(sectionName: string | undefined, sectionNumber: number): string {
  return sectionName || `Section ${sectionNumber}`;
}
