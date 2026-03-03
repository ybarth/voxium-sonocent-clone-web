// SFX Engine — synthesizes and plays built-in sound effects via Web Audio API
import type { SfxRef, SfxMapping, Chunk } from '../types';
import type { Scheme, DefaultAttributes } from '../types/scheme';
import { resolveChunkForm } from './formResolver';
import { BUILTIN_SFXS, type BuiltinSfxDef } from '../constants/builtinSfx';

export class SfxEngine {
  private audioContext: AudioContext;
  private gainNode: GainNode;
  private bufferCache = new Map<string, AudioBuffer>();
  private customCache = new Map<string, AudioBuffer>();
  private synthesized = false;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.gainNode = audioContext.createGain();
    this.gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    this.gainNode.connect(audioContext.destination);
  }

  /** Pre-generate all built-in SFX as AudioBuffers */
  synthesizeAll() {
    if (this.synthesized) return;
    this.synthesized = true;

    for (const def of BUILTIN_SFXS) {
      const buffer = this.synthesizeOne(def);
      this.bufferCache.set(def.id, buffer);
    }
  }

  private synthesizeOne(def: BuiltinSfxDef): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const length = Math.ceil(def.duration * sampleRate);
    const buffer = this.audioContext.createBuffer(1, Math.max(1, length), sampleRate);
    const data = buffer.getChannelData(0);

    if (def.category === 'silence') {
      // silence — all zeros
      return buffer;
    }

    const totalDur = def.duration;
    const atkEnd = def.attack;
    const decEnd = atkEnd + def.decay;
    const susEnd = totalDur - def.release;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;

      // ADSR envelope
      let env = 0;
      if (t < atkEnd) {
        env = atkEnd > 0 ? t / atkEnd : 1;
      } else if (t < decEnd) {
        env = 1 - (1 - def.sustain) * ((t - atkEnd) / def.decay);
      } else if (t < susEnd) {
        env = def.sustain;
      } else {
        const rel = def.release > 0 ? (t - susEnd) / def.release : 0;
        env = def.sustain * (1 - Math.min(1, rel));
      }

      // Signal
      let sample = 0;

      if (def.useNoise) {
        sample = (Math.random() * 2 - 1);
      } else if (def.oscillatorType && def.frequency) {
        const freq = def.frequencyEnd
          ? def.frequency + (def.frequencyEnd - def.frequency) * (t / totalDur)
          : def.frequency;
        const phase = 2 * Math.PI * freq * t;

        switch (def.oscillatorType) {
          case 'sine':
            sample = Math.sin(phase);
            break;
          case 'square':
            sample = Math.sin(phase) > 0 ? 1 : -1;
            break;
          case 'triangle':
            sample = (2 / Math.PI) * Math.asin(Math.sin(phase));
            break;
          case 'sawtooth':
            sample = 2 * ((freq * t) % 1) - 1;
            break;
        }

        // Add harmonics
        if (def.harmonics) {
          for (const mult of def.harmonics) {
            const hPhase = 2 * Math.PI * freq * mult * t;
            sample += Math.sin(hPhase) * (0.3 / mult);
          }
        }
      }

      data[i] = sample * env;
    }

    // Simple biquad filter simulation (single-pass IIR approximation)
    if (def.filterType && def.filterFrequency) {
      this.applyFilter(data, sampleRate, def.filterType, def.filterFrequency);
    }

    // Normalize
    let peak = 0;
    for (let i = 0; i < length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
    if (peak > 0) {
      const scale = 0.8 / peak;
      for (let i = 0; i < length; i++) {
        data[i] *= scale;
      }
    }

    return buffer;
  }

  private applyFilter(data: Float32Array, sampleRate: number, type: BiquadFilterType, cutoff: number) {
    // Simple one-pole filter approximation
    const rc = 1 / (2 * Math.PI * cutoff);
    const dt = 1 / sampleRate;
    const alpha = dt / (rc + dt);

    if (type === 'lowpass') {
      let prev = 0;
      for (let i = 0; i < data.length; i++) {
        prev = prev + alpha * (data[i] - prev);
        data[i] = prev;
      }
    } else if (type === 'highpass') {
      let prev = 0;
      let prevInput = data[0] || 0;
      for (let i = 0; i < data.length; i++) {
        const input = data[i];
        prev = (1 - alpha) * (prev + input - prevInput);
        prevInput = input;
        data[i] = prev;
      }
    } else if (type === 'bandpass') {
      // Low-pass then high-pass (crude bandpass)
      const lp = new Float32Array(data.length);
      let lpPrev = 0;
      for (let i = 0; i < data.length; i++) {
        lpPrev = lpPrev + alpha * (data[i] - lpPrev);
        lp[i] = lpPrev;
      }
      // High pass at cutoff/2
      const rc2 = 1 / (Math.PI * cutoff);
      const alpha2 = dt / (rc2 + dt);
      let hpPrev = 0;
      let hpPrevInput = lp[0] || 0;
      for (let i = 0; i < data.length; i++) {
        const input = lp[i];
        hpPrev = (1 - alpha2) * (hpPrev + input - hpPrevInput);
        hpPrevInput = input;
        data[i] = hpPrev;
      }
    }
  }

  /** Play a built-in or custom SFX */
  playSfx(sfxRef: SfxRef) {
    if (!this.synthesized) this.synthesizeAll();

    let buffer: AudioBuffer | undefined;

    if (sfxRef.type === 'builtin' && sfxRef.builtinId) {
      buffer = this.bufferCache.get(sfxRef.builtinId);
    } else if ((sfxRef.type === 'custom' || sfxRef.type === 'library') && sfxRef.audioUrl) {
      buffer = this.customCache.get(sfxRef.audioUrl);
    }

    if (!buffer) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    // Per-sfx volume
    const vol = this.audioContext.createGain();
    vol.gain.setValueAtTime(sfxRef.volume, this.audioContext.currentTime);
    source.connect(vol);
    vol.connect(this.gainNode);

    source.start();
  }

  /** Preview an SFX (same as play, for UI hover/click) */
  previewSfx(sfxRef: SfxRef) {
    this.playSfx(sfxRef);
  }

  /** Load a custom audio file into the cache */
  async loadCustomSfx(url: string): Promise<AudioBuffer | null> {
    if (this.customCache.has(url)) return this.customCache.get(url)!;

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.customCache.set(url, audioBuffer);
      return audioBuffer;
    } catch {
      return null;
    }
  }

  /** Bulk-preload all custom audio URLs from a set of SFX mappings */
  async preloadMappings(mappings: SfxMapping[]): Promise<void> {
    const urls = mappings
      .filter((m) => (m.sfxRef.type === 'custom' || m.sfxRef.type === 'library') && m.sfxRef.audioUrl)
      .map((m) => m.sfxRef.audioUrl!);

    await Promise.all(urls.map((url) => this.loadCustomSfx(url)));
  }

  /** Set the master SFX volume */
  setVolume(volume: number) {
    this.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
  }

  destroy() {
    this.gainNode.disconnect();
    this.bufferCache.clear();
    this.customCache.clear();
  }
}

/**
 * Resolve which SFX to play for a given chunk and position.
 * Priority: color+texture > color > texture > global
 */
export function resolveSfxForChunk(
  chunk: Chunk,
  mappings: SfxMapping[],
  position: 'start' | 'end'
): SfxRef | null {
  const chunkColor = chunk.style?.color ?? chunk.color;
  const chunkTexture = chunk.style?.texture?.builtinId;

  // Find matching mappings for this position
  const positionMappings = mappings.filter(
    (m) => m.position === position || m.position === 'both'
  );

  // Priority 1: color+texture match
  if (chunkColor && chunkTexture) {
    const match = positionMappings.find(
      (m) => m.matchType === 'color+texture' && m.colorHex === chunkColor && m.textureId === chunkTexture
    );
    if (match) return match.sfxRef;
  }

  // Priority 2: color match
  if (chunkColor) {
    const match = positionMappings.find(
      (m) => m.matchType === 'color' && m.colorHex === chunkColor
    );
    if (match) return match.sfxRef;
  }

  // Priority 3: texture match
  if (chunkTexture) {
    const match = positionMappings.find(
      (m) => m.matchType === 'texture' && m.textureId === chunkTexture
    );
    if (match) return match.sfxRef;
  }

  // Priority 4: global fallback
  const globalMatch = positionMappings.find((m) => m.matchType === 'global');
  return globalMatch?.sfxRef ?? null;
}

/**
 * Resolve SFX for a chunk using the Forms & Schemes system.
 * Priority: form sound attribute → legacy SfxMapping fallback.
 * The `position` parameter maps to SoundAttribute.trigger:
 * - 'start' matches trigger 'start' | 'both'
 * - 'end' matches trigger 'end' | 'both'
 * - 'boundary' is a special case for chunk transitions
 */
export function resolveSfxForChunkForm(
  chunk: Chunk,
  scheme: Scheme,
  defaults: DefaultAttributes,
  position: 'start' | 'end' | 'boundary',
  legacyMappings: SfxMapping[]
): SfxRef | null {
  // 1. Try form sound attribute
  const resolved = resolveChunkForm(chunk, scheme, defaults);
  if (resolved.sound) {
    const { trigger, sfxRef, volume } = resolved.sound;
    const triggerMatches =
      (position === 'start' && (trigger === 'start' || trigger === 'both')) ||
      (position === 'end' && (trigger === 'end' || trigger === 'both')) ||
      (position === 'boundary' && trigger === 'boundary');

    if (triggerMatches) {
      return volume !== undefined
        ? { ...sfxRef, volume }
        : sfxRef;
    }
  }

  // 2. Fallback to legacy SfxMapping system (not for boundary triggers)
  if (position !== 'boundary') {
    return resolveSfxForChunk(chunk, legacyMappings, position);
  }

  return null;
}
