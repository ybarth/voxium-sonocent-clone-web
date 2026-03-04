// OpenAI Whisper STT Provider

import { getOpenAIKey } from '../aiProvider';
import type { TranscriptionProvider, TranscriptionRequest, TranscriptionResponse, ProviderWord } from '../transcriptionEngine';

export class OpenAIWhisperProvider implements TranscriptionProvider {
  readonly name = 'openai-whisper';

  get isConfigured(): boolean {
    return !!getOpenAIKey();
  }

  private get key(): string {
    const k = getOpenAIKey();
    if (!k) throw new Error('OpenAI API key not configured. Set it in Settings > AI Configuration.');
    return k;
  }

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse> {
    const formData = new FormData();
    formData.append('file', request.audioBlob, 'audio.wav');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');

    if (request.language) {
      formData.append('language', request.language);
    }
    if (request.prompt) {
      formData.append('prompt', request.prompt);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.key}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Whisper API error: ${response.status} — ${err}`);
    }

    const data = await response.json();

    // Map Whisper word-level response to ProviderWord[]
    const words: ProviderWord[] = (data.words ?? []).map((w: any) => ({
      text: w.word?.trim() ?? '',
      startTime: w.start ?? 0,
      endTime: w.end ?? 0,
      confidence: 1.0, // Whisper doesn't provide per-word confidence in verbose_json
      speakerLabel: undefined,
    }));

    return {
      text: data.text ?? '',
      words,
      language: data.language ?? request.language ?? 'en',
      duration: data.duration ?? 0,
    };
  }
}
