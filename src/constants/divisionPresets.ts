// Built-in division presets for chunk boundary computation

import type { DivisionPreset } from '../types/configuration';

export const PRESET_SILENCE_DETECTION: DivisionPreset = {
  id: 'preset-silence-default',
  name: 'Silence Detection (Default)',
  builtIn: true,
  criteria: [
    {
      type: 'silence',
      enabled: true,
      weight: 1.0,
      params: {
        thresholdDb: -40,
        minSilenceDurationMs: 300,
        minChunkDurationMs: 500,
      },
    },
  ],
};

export const PRESET_NATURAL_SPEECH: DivisionPreset = {
  id: 'preset-natural-speech',
  name: 'Natural Speech Phrases',
  builtIn: true,
  criteria: [
    {
      type: 'silence',
      enabled: true,
      weight: 0.6,
      params: {
        thresholdDb: -40,
        minSilenceDurationMs: 200,
        minChunkDurationMs: 300,
      },
    },
    {
      type: 'cadence',
      enabled: true,
      weight: 0.4,
      params: {
        silenceThresholdDb: -35,
        minPauseDurationMs: 150,
        phraseGrouping: 2,
      },
    },
  ],
};

export const PRESET_SENTENCE_LEVEL: DivisionPreset = {
  id: 'preset-sentence-level',
  name: 'Sentence Level',
  builtIn: true,
  criteria: [
    {
      type: 'grammar',
      enabled: true,
      weight: 1.0,
      params: {
        granularity: 'sentence',
        minPauseBetweenMs: 100,
      },
    },
  ],
};

export const PRESET_STUDY_NOTES: DivisionPreset = {
  id: 'preset-study-notes',
  name: 'Study Notes',
  builtIn: true,
  criteria: [
    {
      type: 'grammar',
      enabled: true,
      weight: 0.4,
      params: {
        granularity: 'clause',
        minPauseBetweenMs: 100,
      },
    },
    {
      type: 'target-duration',
      enabled: true,
      weight: 0.3,
      params: {
        targetMs: 15000,
      },
    },
    {
      type: 'silence',
      enabled: true,
      weight: 0.3,
      params: {
        thresholdDb: -40,
        minSilenceDurationMs: 300,
        minChunkDurationMs: 500,
      },
    },
  ],
};

export const PRESET_ONE_WORD: DivisionPreset = {
  id: 'preset-one-word',
  name: 'One Word Per Chunk',
  builtIn: true,
  criteria: [
    {
      type: 'word-level',
      enabled: true,
      weight: 1.0,
      params: {},
    },
  ],
};

export const PRESET_FINE_GRAINED: DivisionPreset = {
  id: 'preset-fine-grained',
  name: 'Fine-Grained',
  builtIn: true,
  criteria: [
    {
      type: 'silence',
      enabled: true,
      weight: 0.5,
      params: {
        thresholdDb: -35,
        minSilenceDurationMs: 150,
        minChunkDurationMs: 200,
      },
    },
    {
      type: 'max-duration',
      enabled: true,
      weight: 0.5,
      params: {
        maxMs: 3000,
      },
    },
  ],
};

export const ALL_BUILTIN_PRESETS: DivisionPreset[] = [
  PRESET_SILENCE_DETECTION,
  PRESET_NATURAL_SPEECH,
  PRESET_SENTENCE_LEVEL,
  PRESET_STUDY_NOTES,
  PRESET_ONE_WORD,
  PRESET_FINE_GRAINED,
];
