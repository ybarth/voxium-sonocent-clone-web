// Transcription Engine — Provider interface + router integration

import { OpenAIWhisperProvider } from './providers/openaiWhisper';
import { GoogleSTTProvider } from './providers/googleSTT';

// ─── Provider interface ─────────────────────────────────────────────────────

export interface ProviderWord {
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  speakerLabel?: string;
}

export interface TranscriptionRequest {
  audioBlob: Blob;
  language?: string;
  enableDiarization?: boolean;
  maxSpeakers?: number;
  prompt?: string;
}

export interface TranscriptionResponse {
  text: string;
  words: ProviderWord[];
  language: string;
  duration: number;
  speakers?: string[];
}

export interface TranscriptionProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse>;
}

// ─── Provider registry ──────────────────────────────────────────────────────

const providers = new Map<string, TranscriptionProvider>();

function initProviders() {
  if (providers.size > 0) return;
  const whisper = new OpenAIWhisperProvider();
  const google = new GoogleSTTProvider();
  providers.set('openai-whisper', whisper);
  providers.set('google-stt', google);
}

export function getTranscriptionProvider(name: string): TranscriptionProvider | undefined {
  initProviders();
  return providers.get(name);
}

export function getConfiguredTranscriptionProviders(): TranscriptionProvider[] {
  initProviders();
  return Array.from(providers.values()).filter(p => p.isConfigured);
}

/**
 * Transcribe audio using the specified provider (or fallback).
 */
export async function transcribe(
  request: TranscriptionRequest,
  providerName: string,
  fallbackProviderName?: string,
): Promise<TranscriptionResponse> {
  initProviders();

  // Try primary
  const primary = providers.get(providerName);
  if (primary?.isConfigured) {
    try {
      return await primary.transcribe(request);
    } catch (err) {
      console.warn(`Primary STT provider ${providerName} failed:`, err);
      if (!fallbackProviderName) throw err;
    }
  }

  // Try fallback
  if (fallbackProviderName) {
    const fallback = providers.get(fallbackProviderName);
    if (fallback?.isConfigured) {
      return fallback.transcribe(request);
    }
  }

  // Try any configured provider
  for (const provider of providers.values()) {
    if (provider.isConfigured) {
      return provider.transcribe(request);
    }
  }

  throw new Error('No STT provider is configured. Add an API key in Settings > AI Configuration.');
}
