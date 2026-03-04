// Transcription data model — Speech-to-Text system types

// ─── Word-level types ───────────────────────────────────────────────────────

export type WordSource = 'transcription' | 'manual' | 'edited';

export type WordFlag =
  | 'low-confidence'
  | 'sense-check-fail'
  | 'borderline'
  | 'false-start'
  | 'incomplete-clause'
  | 'filler-word';

export interface WordAlternative {
  text: string;
  confidence: number;
  category: 'lexical' | 'grammatical' | 'syntactical' | 'formatting';
}

export interface TranscribedWord {
  id: string;
  text: string;
  startTime: number; // absolute time in seconds
  endTime: number;
  confidence: number; // 0-1 from STT provider
  contextualConfidence: number; // 0-1 from LLM analysis
  speakerId: string | null;
  source: WordSource;
  alternatives: WordAlternative[];
  flags: WordFlag[];
}

// ─── Word-Chunk mapping ─────────────────────────────────────────────────────

export interface WordChunkMapping {
  wordId: string;
  chunkId: string;
  startFraction: number; // 0-1 within the chunk
  endFraction: number;   // 0-1 within the chunk
}

// ─── Speaker ────────────────────────────────────────────────────────────────

export interface Speaker {
  id: string;
  label: string;
  color: string; // hex
}

// ─── Transcription jobs ─────────────────────────────────────────────────────

export type TranscriptionScope =
  | { type: 'chunk'; chunkIds: string[] }
  | { type: 'section'; sectionIds: string[] }
  | { type: 'project' };

export type TranscriptionJobStatus =
  | 'pending'
  | 'extracting-audio'
  | 'transcribing'
  | 'mapping-words'
  | 'analyzing-confidence'
  | 'applying-edits'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TranscriptionJob {
  id: string;
  status: TranscriptionJobStatus;
  scope: TranscriptionScope;
  provider: string;
  model: string;
  chunkIds: string[];
  startedAt: number;
  completedAt: number | null;
  error: string | null;
  progress: number; // 0-1
  cost: number | null;
}

// ─── Editing tiers ──────────────────────────────────────────────────────────

export interface EditingTierConfig {
  tier1: {
    cleanFalseStarts: boolean;
    cleanFillerWords: boolean;
    basicFormatting: boolean;
    customRules: string[]; // user-defined regex or keyword rules
  };
  tier2: {
    enabled: boolean;
    promptTemplate: string;
    provider: string;
    model: string;
  };
}

// ─── Settings ───────────────────────────────────────────────────────────────

export interface TranscriptionSettings {
  defaultProvider: 'openai-whisper' | 'google-stt';
  language: string; // BCP-47 language code, '' for auto-detect
  enableMultiSpeaker: boolean;
  maxSpeakers: number;
  clarificationQueriesEnabled: boolean;
  autoTranscribeOnRecord: boolean;
  confidenceThreshold: number; // below this = flagged (default 0.6)
  borderlineThreshold: number; // below this = contextual analysis (default 0.8)
}

// ─── Clarification queries ──────────────────────────────────────────────────

export interface ClarificationQuery {
  id: string;
  wordId: string;
  context: string; // surrounding text for context
  question: string;
  suggestions: string[];
  resolved: boolean;
  resolvedText: string | null;
}

// ─── Confidence levels ──────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'flagged';

export const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  high: 'transparent',
  medium: 'rgba(234, 179, 8, 0.2)',   // yellow
  low: 'rgba(245, 158, 11, 0.3)',      // amber
  flagged: 'rgba(239, 68, 68, 0.3)',   // red
};

export function getConfidenceLevel(
  confidence: number,
  settings: TranscriptionSettings,
): ConfidenceLevel {
  if (confidence < settings.confidenceThreshold) return 'flagged';
  if (confidence < settings.borderlineThreshold) return 'low';
  if (confidence < 0.9) return 'medium';
  return 'high';
}

// ─── View modes ─────────────────────────────────────────────────────────────

export type TextViewMode = 'clean' | 'confidence' | 'speaker';

export type HighlightGranularity = 'word' | 'clause' | 'sentence' | 'paragraph' | 'chunk';

// ─── Aggregate state ────────────────────────────────────────────────────────

export interface TranscriptionState {
  words: TranscribedWord[];
  wordChunkMappings: WordChunkMapping[];
  speakers: Speaker[];
  jobs: TranscriptionJob[];
  editingConfig: EditingTierConfig;
  settings: TranscriptionSettings;
  clarifications: ClarificationQuery[];
  viewMode: TextViewMode;
  highlightGranularities: HighlightGranularity[];
  staleChunkIds: string[]; // chunks whose audio was replaced after transcription
}

// ─── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULT_EDITING_CONFIG: EditingTierConfig = {
  tier1: {
    cleanFalseStarts: true,
    cleanFillerWords: true,
    basicFormatting: true,
    customRules: [],
  },
  tier2: {
    enabled: false,
    promptTemplate: 'Clean up this transcription for readability while preserving the original meaning. Fix grammar, remove repetitions, and improve flow.',
    provider: 'claude',
    model: 'claude-haiku-4-5-20251001',
  },
};

export const DEFAULT_TRANSCRIPTION_SETTINGS: TranscriptionSettings = {
  defaultProvider: 'openai-whisper',
  language: '',
  enableMultiSpeaker: false,
  maxSpeakers: 2,
  clarificationQueriesEnabled: false,
  autoTranscribeOnRecord: false,
  confidenceThreshold: 0.6,
  borderlineThreshold: 0.8,
};

export const DEFAULT_TRANSCRIPTION_STATE: TranscriptionState = {
  words: [],
  wordChunkMappings: [],
  speakers: [],
  jobs: [],
  editingConfig: DEFAULT_EDITING_CONFIG,
  settings: DEFAULT_TRANSCRIPTION_SETTINGS,
  clarifications: [],
  viewMode: 'clean',
  highlightGranularities: ['word'],
  staleChunkIds: [],
};
