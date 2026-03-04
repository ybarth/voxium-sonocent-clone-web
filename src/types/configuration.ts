// Configuration System — Division criteria, boundary points, versions, and AI suggestions

// ─── Division Criterion Types ──────────────────────────────────────────────

export type DivisionCriterionType =
  | 'silence'
  | 'volume-fluctuation'
  | 'loudness'
  | 'max-duration'
  | 'target-duration'
  | 'cadence'
  | 'grammar'
  | 'topic'
  | 'word-level'
  | 'manual';

export interface DivisionCriterion {
  type: DivisionCriterionType;
  enabled: boolean;
  weight: number; // 0-1
  params: Record<string, number | string | boolean>;
}

export interface DivisionPreset {
  id: string;
  name: string;
  builtIn: boolean;
  criteria: DivisionCriterion[];
}

// ─── Boundary Points ───────────────────────────────────────────────────────

export type BoundarySource = DivisionCriterionType | 'manual' | 'ai';

export interface BoundaryPoint {
  time: number; // seconds (absolute within audio buffer)
  source: BoundarySource;
  confidence: number; // 0-1
}

// ─── Configuration ─────────────────────────────────────────────────────────

export interface ChunkOverride {
  color?: string | null;
  formId?: string | null;
  tags?: string[];
}

export interface Configuration {
  id: string;
  name: string;
  boundaries: BoundaryPoint[];
  presetId: string | null;
  criteria: DivisionCriterion[];
  createdAt: number; // timestamp
  source: 'user' | 'ai' | 'auto';
  chunkOverrides: Record<number, ChunkOverride>; // keyed by chunk order index
}

// ─── Audio Range ───────────────────────────────────────────────────────────

export interface AudioRange {
  audioBufferId: string;
  startTime: number;
  endTime: number;
}

// ─── Section Version ───────────────────────────────────────────────────────

export type VersionSource = 'recording' | 'import' | 'manual';

export interface SectionVersion {
  id: string;
  sectionId: string;
  audioRanges: AudioRange[];
  configurations: Configuration[];
  activeConfigIndex: number;
  createdAt: number; // timestamp
  source: VersionSource;
}

// ─── Section Config State ──────────────────────────────────────────────────

export interface SectionConfigState {
  sectionId: string;
  versions: SectionVersion[];
  activeVersionIndex: number;
  previewConfig: Configuration | null;
}

// ─── AI Division Suggestion ────────────────────────────────────────────────

export interface AIDivisionSuggestion {
  id: string;
  name: string;
  description: string;
  configuration: Configuration;
  reasoning: string;
  signals: string[];
}
