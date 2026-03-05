/**
 * Generic interface for synthetic TTS providers.
 * All providers that generate audio for the synthetic layer implement this.
 */

import type { TtsGenerateResult, TtsWordTimestamp, HeadTtsInputItem } from './headTtsProvider';

export type { TtsGenerateResult, TtsWordTimestamp, HeadTtsInputItem };

export interface SyntheticTtsProvider {
  connect(onProgress?: (msg: string) => void): Promise<void>;

  generate(input: string | HeadTtsInputItem[], options?: {
    speed?: number;
    voice?: string;
  }): Promise<TtsGenerateResult>;

  isReady(): boolean;
  setVoice(voiceId: string): void;
  setSpeed(speed: number): void;

  readonly voice: string;
  readonly speed: number;
}
