// Google Speech-to-Text Provider (using Gemini API key)

import { getGeminiKey } from '../aiProvider';
import type { TranscriptionProvider, TranscriptionRequest, TranscriptionResponse, ProviderWord } from '../transcriptionEngine';

export class GoogleSTTProvider implements TranscriptionProvider {
  readonly name = 'google-stt';

  get isConfigured(): boolean {
    return !!getGeminiKey();
  }

  private get key(): string {
    const k = getGeminiKey();
    if (!k) throw new Error('Google AI (Gemini) API key not configured. Set it in Settings > AI Configuration.');
    return k;
  }

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse> {
    // Convert audio blob to base64
    const arrayBuffer = await request.audioBlob.arrayBuffer();
    const base64Audio = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const config: any = {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000, // will be overridden by WAV header
      languageCode: request.language || 'en-US',
      enableWordTimeOffsets: true,
      enableWordConfidence: true,
      model: 'latest_long',
    };

    if (request.enableDiarization && request.maxSpeakers) {
      config.diarizationConfig = {
        enableSpeakerDiarization: true,
        maxSpeakerCount: request.maxSpeakers,
      };
    }

    const body = {
      config,
      audio: {
        content: base64Audio,
      },
    };

    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${this.key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google STT API error: ${response.status} — ${err}`);
    }

    const data = await response.json();

    const words: ProviderWord[] = [];
    let fullText = '';

    for (const result of data.results ?? []) {
      const alt = result.alternatives?.[0];
      if (!alt) continue;

      fullText += (fullText ? ' ' : '') + (alt.transcript ?? '');

      for (const w of alt.words ?? []) {
        words.push({
          text: w.word ?? '',
          startTime: parseDuration(w.startTime),
          endTime: parseDuration(w.endTime),
          confidence: w.confidence ?? 0.5,
          speakerLabel: w.speakerTag ? `speaker-${w.speakerTag}` : undefined,
        });
      }
    }

    // Detect unique speakers
    const speakerSet = new Set(words.map(w => w.speakerLabel).filter(Boolean));

    return {
      text: fullText,
      words,
      language: request.language || 'en',
      duration: words.length > 0 ? words[words.length - 1].endTime : 0,
      speakers: speakerSet.size > 0
        ? Array.from(speakerSet).map(label => label!)
        : undefined,
    };
  }
}

/** Parse Google's duration format (e.g., "1.500s") to seconds */
function parseDuration(d: string | { seconds?: string | number; nanos?: number } | undefined): number {
  if (!d) return 0;
  if (typeof d === 'string') {
    return parseFloat(d.replace('s', '')) || 0;
  }
  const seconds = typeof d.seconds === 'string' ? parseInt(d.seconds, 10) : (d.seconds ?? 0);
  const nanos = d.nanos ?? 0;
  return seconds + nanos / 1e9;
}
