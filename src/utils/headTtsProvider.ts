/**
 * HeadTTS provider — wraps @met4citizen/headtts (Kokoro-82M) for in-browser TTS
 * with word-level timestamps.
 */

// HeadTTS is an ESM-only module with no TS types — use dynamic import
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let HeadTTSClass: any = null;

// Vite-resolved worker URL (must be created in our source, not inside node_modules)
import ttsWorkerUrl from './ttsWorkerUrl';

export interface TtsWordTimestamp {
  word: string;
  startTimeMs: number;
  durationMs: number;
  startTimeSec: number;
  endTimeSec: number;
}

export interface TtsGenerateResult {
  audioBuffer: AudioBuffer;
  wordTimestamps: TtsWordTimestamp[];
  totalDuration: number; // seconds
}

/** Available Kokoro voices */
export const KOKORO_VOICES = [
  'af_bella', 'af_nicole', 'af_sarah', 'af_sky',
  'am_adam', 'am_michael', 'am_fenrir',
  'bf_emma', 'bf_isabella',
  'bm_george', 'bm_lewis',
] as const;

export type KokoroVoiceId = typeof KOKORO_VOICES[number];

/** Structured input item for extended TTS control */
export interface HeadTtsInputItem {
  type: 'text' | 'break' | 'phonetic';
  value: string | number; // text content, break duration ms, or IPA string
  word?: string; // for phonetic: the original word to apply IPA to
}

export class HeadTtsProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tts: any = null;
  private ready = false;
  private connecting = false;
  private audioContext: AudioContext;
  private currentVoice: string;
  private currentSpeed: number;

  constructor(audioContext: AudioContext, voice: string = 'af_bella', speed = 1.0) {
    this.audioContext = audioContext;
    this.currentVoice = voice;
    this.currentSpeed = speed;
  }

  async connect(onProgress?: (msg: string) => void): Promise<void> {
    if (this.ready || this.connecting) return;
    this.connecting = true;

    try {
      // Dynamic import — HeadTTS is ESM-only
      if (!HeadTTSClass) {
        const mod = await import('@met4citizen/headtts');
        HeadTTSClass = mod.HeadTTS;
      }

      this.tts = new HeadTTSClass({
        endpoints: ['webgpu', 'wasm'],
        audioCtx: this.audioContext,
        languages: ['en-us'],
        voices: [this.currentVoice],
        defaultVoice: this.currentVoice,
        defaultSpeed: this.currentSpeed,
        defaultAudioEncoding: 'wav',
        splitSentences: false, // We handle chunking ourselves
        workerModule: ttsWorkerUrl, // Use public-served worker so Vite doesn't mangle it
      });

      // HeadTTS creates blob workers (`new Worker(blob:..., {type:'module'})`)
      // that do `import "/headtts/worker-tts.mjs"`. Chrome blocks import
      // statements inside blob module workers. Workaround: intercept Worker
      // construction during connect() and redirect blob URLs to the direct URL.
      const OrigWorker = globalThis.Worker;
      globalThis.Worker = class PatchedWorker extends OrigWorker {
        constructor(scriptURL: string | URL, options?: WorkerOptions) {
          const urlStr = scriptURL.toString();
          if (urlStr.startsWith('blob:') && options?.type === 'module') {
            // Replace blob worker with direct module worker
            console.log('[HeadTTS] Intercepted blob worker, using direct URL:', ttsWorkerUrl);
            super(ttsWorkerUrl, options);
          } else {
            super(scriptURL, options);
          }
        }
      } as typeof Worker;

      try {
        await this.tts.connect(null, onProgress ? (e: ProgressEvent) => {
          onProgress(`Loading TTS model... ${Math.round((e.loaded / (e.total || 1)) * 100)}%`);
        } : null);
      } finally {
        // Restore original Worker constructor
        globalThis.Worker = OrigWorker;
      }

      // Configure initial voice
      await this.tts.setup({
        voice: this.currentVoice,
        language: 'en-us',
        speed: this.currentSpeed,
        audioEncoding: 'wav',
      });

      this.ready = true;
      console.log('HeadTTS connected successfully');
    } catch (err) {
      console.error('HeadTTS connection failed:', err);
      throw err;
    } finally {
      this.connecting = false;
    }
  }

  async generate(input: string | HeadTtsInputItem[], options?: {
    speed?: number;
    voice?: string;
  }): Promise<TtsGenerateResult> {
    if (!this.ready || !this.tts) {
      throw new Error('HeadTTS not connected. Call connect() first.');
    }

    // Apply voice/speed changes if requested
    const speed = options?.speed ?? this.currentSpeed;
    const voice = options?.voice ?? this.currentVoice;
    if (speed !== this.currentSpeed || voice !== this.currentVoice) {
      this.currentSpeed = speed;
      this.currentVoice = voice;
      await this.tts.setup({ voice, speed });
    }

    // Build the input for HeadTTS — structured items get flattened to text
    // (HeadTTS only accepts plain text; breaks become silence injected post-generation)
    let text: string;
    let leadingBreakMs = 0;
    let trailingBreakMs = 0;

    if (typeof input === 'string') {
      text = input;
    } else {
      const textParts: string[] = [];
      for (const item of input) {
        if (item.type === 'text') {
          textParts.push(String(item.value));
        } else if (item.type === 'break') {
          // Capture leading/trailing breaks; HeadTTS doesn't support inline breaks
          if (textParts.length === 0) {
            leadingBreakMs += Number(item.value);
          } else {
            trailingBreakMs += Number(item.value);
          }
        } else if (item.type === 'phonetic') {
          // For now, pass the word as-is (IPA override would need SSML support)
          textParts.push(item.word || String(item.value));
        }
      }
      text = textParts.join(' ');
    }

    // synthesize returns an array of audio messages (one per sentence chunk)
    const messages = await this.tts.synthesize({ input: text });

    if (!messages || messages.length === 0) {
      throw new Error('HeadTTS returned no audio messages');
    }

    // Combine all message parts into a single result
    const allTimestamps: TtsWordTimestamp[] = [];
    const audioBuffers: AudioBuffer[] = [];
    let cumulativeMs = 0;

    for (const msg of messages) {
      if (msg.type === 'error') {
        throw new Error(`HeadTTS error: ${msg.data?.error || 'Unknown'}`);
      }
      if (msg.type !== 'audio' || !msg.data) continue;

      const { words, wtimes, wdurations, audio } = msg.data;

      // audio is already an AudioBuffer (decoded from WAV by HeadTTS)
      if (audio instanceof AudioBuffer) {
        audioBuffers.push(audio);
      }

      // Build word timestamps
      if (words && wtimes && wdurations) {
        for (let i = 0; i < words.length; i++) {
          const startMs = (wtimes[i] ?? 0) + cumulativeMs;
          const durMs = wdurations[i] ?? 0;
          allTimestamps.push({
            word: words[i],
            startTimeMs: startMs,
            durationMs: durMs,
            startTimeSec: startMs / 1000,
            endTimeSec: (startMs + durMs) / 1000,
          });
        }
      }

      // Accumulate time offset for multi-part messages
      if (audio instanceof AudioBuffer) {
        cumulativeMs += audio.duration * 1000;
      }
    }

    // Concatenate audio buffers if multiple parts
    let finalBuffer = audioBuffers.length === 1
      ? audioBuffers[0]
      : concatAudioBuffers(audioBuffers, this.audioContext);

    // Inject leading/trailing silence for break items
    if (leadingBreakMs > 0 || trailingBreakMs > 0) {
      const sampleRate = finalBuffer.sampleRate;
      const leadingSamples = Math.round((leadingBreakMs / 1000) * sampleRate);
      const trailingSamples = Math.round((trailingBreakMs / 1000) * sampleRate);
      const totalLength = leadingSamples + finalBuffer.length + trailingSamples;
      const channels = finalBuffer.numberOfChannels;
      const padded = this.audioContext.createBuffer(channels, totalLength, sampleRate);

      for (let ch = 0; ch < channels; ch++) {
        const output = padded.getChannelData(ch);
        // Leading silence is already zeros
        output.set(finalBuffer.getChannelData(ch), leadingSamples);
        // Trailing silence is already zeros
      }

      // Adjust timestamps for leading silence
      if (leadingBreakMs > 0) {
        for (const ts of allTimestamps) {
          ts.startTimeMs += leadingBreakMs;
          ts.startTimeSec = ts.startTimeMs / 1000;
          ts.endTimeSec = (ts.startTimeMs + ts.durationMs) / 1000;
        }
      }

      finalBuffer = padded;
    }

    return {
      audioBuffer: finalBuffer,
      wordTimestamps: allTimestamps,
      totalDuration: finalBuffer.duration,
    };
  }

  setVoice(voiceId: string) {
    this.currentVoice = voiceId;
  }

  setSpeed(speed: number) {
    this.currentSpeed = Math.max(0.25, Math.min(4, speed));
  }

  isReady(): boolean {
    return this.ready;
  }

  get voice(): string {
    return this.currentVoice;
  }

  get speed(): number {
    return this.currentSpeed;
  }
}

/** Concatenate multiple AudioBuffers into one */
function concatAudioBuffers(buffers: AudioBuffer[], ctx: BaseAudioContext): AudioBuffer {
  if (buffers.length === 0) throw new Error('No buffers to concatenate');
  if (buffers.length === 1) return buffers[0];

  const channels = buffers[0].numberOfChannels;
  const sampleRate = buffers[0].sampleRate;
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = ctx.createBuffer(channels, totalLength, sampleRate);

  for (let ch = 0; ch < channels; ch++) {
    const output = result.getChannelData(ch);
    let offset = 0;
    for (const buf of buffers) {
      const chCount = buf.numberOfChannels;
      // If buf has fewer channels, use channel 0 as fallback
      output.set(buf.getChannelData(ch < chCount ? ch : 0), offset);
      offset += buf.length;
    }
  }

  return result;
}
