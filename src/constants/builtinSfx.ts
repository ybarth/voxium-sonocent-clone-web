// Built-in SFX definitions for Web Audio synthesis
// Each entry defines synthesis parameters for a short sound effect

export interface BuiltinSfxDef {
  id: string;
  label: string;
  category: 'click' | 'tone' | 'chime' | 'percussive' | 'transition' | 'beep' | 'silence';
  // Synthesis parameters
  oscillatorType?: OscillatorType;
  frequency?: number;
  frequencyEnd?: number;    // for sweeps
  filterType?: BiquadFilterType;
  filterFrequency?: number;
  attack: number;           // seconds
  decay: number;            // seconds
  sustain: number;          // 0-1
  release: number;          // seconds
  duration: number;         // total seconds
  harmonics?: number[];     // additional sine harmonics (freq multipliers)
  useNoise?: boolean;
}

export const BUILTIN_SFXS: BuiltinSfxDef[] = [
  // Clicks (~8)
  { id: 'click-soft', label: 'Soft Click', category: 'click', useNoise: true, filterType: 'bandpass', filterFrequency: 2000, attack: 0.001, decay: 0.03, sustain: 0, release: 0.01, duration: 0.04 },
  { id: 'click-sharp', label: 'Sharp Click', category: 'click', useNoise: true, filterType: 'bandpass', filterFrequency: 4000, attack: 0.001, decay: 0.02, sustain: 0, release: 0.005, duration: 0.03 },
  { id: 'click-low', label: 'Low Click', category: 'click', useNoise: true, filterType: 'bandpass', filterFrequency: 800, attack: 0.001, decay: 0.05, sustain: 0, release: 0.02, duration: 0.07 },
  { id: 'click-high', label: 'High Click', category: 'click', useNoise: true, filterType: 'bandpass', filterFrequency: 6000, attack: 0.001, decay: 0.015, sustain: 0, release: 0.005, duration: 0.025 },
  { id: 'click-pop', label: 'Pop', category: 'click', oscillatorType: 'sine', frequency: 400, frequencyEnd: 100, attack: 0.001, decay: 0.03, sustain: 0, release: 0.01, duration: 0.04 },
  { id: 'click-tick', label: 'Tick', category: 'click', useNoise: true, filterType: 'highpass', filterFrequency: 3000, attack: 0.001, decay: 0.01, sustain: 0, release: 0.005, duration: 0.02 },
  { id: 'click-snap', label: 'Snap', category: 'click', useNoise: true, filterType: 'bandpass', filterFrequency: 5000, attack: 0.001, decay: 0.025, sustain: 0, release: 0.01, duration: 0.04 },
  { id: 'click-bubble', label: 'Bubble', category: 'click', oscillatorType: 'sine', frequency: 600, frequencyEnd: 200, attack: 0.001, decay: 0.06, sustain: 0, release: 0.02, duration: 0.08 },

  // Tones (~6)
  { id: 'tone-low', label: 'Low Tone', category: 'tone', oscillatorType: 'sine', frequency: 220, attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.05, duration: 0.15 },
  { id: 'tone-mid', label: 'Mid Tone', category: 'tone', oscillatorType: 'sine', frequency: 440, attack: 0.01, decay: 0.08, sustain: 0.3, release: 0.05, duration: 0.12 },
  { id: 'tone-high', label: 'High Tone', category: 'tone', oscillatorType: 'sine', frequency: 880, attack: 0.005, decay: 0.06, sustain: 0.2, release: 0.04, duration: 0.1 },
  { id: 'tone-warm', label: 'Warm Tone', category: 'tone', oscillatorType: 'triangle', frequency: 330, attack: 0.02, decay: 0.1, sustain: 0.4, release: 0.08, duration: 0.2 },
  { id: 'tone-bright', label: 'Bright Tone', category: 'tone', oscillatorType: 'triangle', frequency: 660, attack: 0.005, decay: 0.07, sustain: 0.3, release: 0.05, duration: 0.12 },
  { id: 'tone-square', label: 'Square Tone', category: 'tone', oscillatorType: 'square', frequency: 440, attack: 0.01, decay: 0.05, sustain: 0.2, release: 0.03, duration: 0.08 },

  // Chimes (~3)
  { id: 'chime-gentle', label: 'Gentle Chime', category: 'chime', oscillatorType: 'sine', frequency: 523, harmonics: [2, 3, 4], attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.2, duration: 0.5 },
  { id: 'chime-bright', label: 'Bright Chime', category: 'chime', oscillatorType: 'sine', frequency: 784, harmonics: [2, 3], attack: 0.002, decay: 0.25, sustain: 0.05, release: 0.15, duration: 0.4 },
  { id: 'chime-deep', label: 'Deep Chime', category: 'chime', oscillatorType: 'sine', frequency: 262, harmonics: [2, 3, 5], attack: 0.01, decay: 0.4, sustain: 0.15, release: 0.3, duration: 0.7 },

  // Percussive (~4)
  { id: 'perc-hit', label: 'Hit', category: 'percussive', useNoise: true, filterType: 'highpass', filterFrequency: 4000, attack: 0.001, decay: 0.02, sustain: 0, release: 0.01, duration: 0.03 },
  { id: 'perc-tap', label: 'Tap', category: 'percussive', useNoise: true, filterType: 'highpass', filterFrequency: 2000, attack: 0.001, decay: 0.03, sustain: 0, release: 0.015, duration: 0.045 },
  { id: 'perc-thud', label: 'Thud', category: 'percussive', useNoise: true, filterType: 'lowpass', filterFrequency: 500, attack: 0.001, decay: 0.06, sustain: 0, release: 0.03, duration: 0.09 },
  { id: 'perc-rim', label: 'Rim', category: 'percussive', useNoise: true, filterType: 'bandpass', filterFrequency: 3500, attack: 0.001, decay: 0.015, sustain: 0, release: 0.005, duration: 0.02 },

  // Transitions (~4)
  { id: 'trans-swoop-up', label: 'Swoop Up', category: 'transition', oscillatorType: 'sine', frequency: 200, frequencyEnd: 800, attack: 0.01, decay: 0.08, sustain: 0.2, release: 0.05, duration: 0.15 },
  { id: 'trans-swoop-down', label: 'Swoop Down', category: 'transition', oscillatorType: 'sine', frequency: 800, frequencyEnd: 200, attack: 0.01, decay: 0.08, sustain: 0.2, release: 0.05, duration: 0.15 },
  { id: 'trans-whoosh', label: 'Whoosh', category: 'transition', useNoise: true, filterType: 'bandpass', filterFrequency: 1000, attack: 0.02, decay: 0.1, sustain: 0.1, release: 0.08, duration: 0.2 },
  { id: 'trans-sweep', label: 'Sweep', category: 'transition', oscillatorType: 'sawtooth', frequency: 100, frequencyEnd: 2000, filterType: 'lowpass', filterFrequency: 3000, attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.05, duration: 0.2 },

  // Beeps (~3)
  { id: 'beep-standard', label: 'Standard Beep', category: 'beep', oscillatorType: 'sine', frequency: 1000, attack: 0.002, decay: 0.05, sustain: 0.5, release: 0.02, duration: 0.08 },
  { id: 'beep-high', label: 'High Beep', category: 'beep', oscillatorType: 'sine', frequency: 1500, attack: 0.002, decay: 0.04, sustain: 0.4, release: 0.02, duration: 0.06 },
  { id: 'beep-double', label: 'Double Beep', category: 'beep', oscillatorType: 'sine', frequency: 800, attack: 0.002, decay: 0.03, sustain: 0.3, release: 0.01, duration: 0.05 },

  // Silence (~3) — empty spacers
  { id: 'silence-50', label: 'Silence 50ms', category: 'silence', attack: 0, decay: 0, sustain: 0, release: 0, duration: 0.05 },
  { id: 'silence-100', label: 'Silence 100ms', category: 'silence', attack: 0, decay: 0, sustain: 0, release: 0, duration: 0.1 },
  { id: 'silence-200', label: 'Silence 200ms', category: 'silence', attack: 0, decay: 0, sustain: 0, release: 0, duration: 0.2 },
];

// Flat list for dropdown menus
export const BUILTIN_SFX_LIST = BUILTIN_SFXS.map((s) => ({ id: s.id, label: s.label, category: s.category }));
