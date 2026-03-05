// Core data model from AudioCanvas v1 spec §14
// Phase 2: Rich Styling, SFX, TTS, Filtering, Templates
// Phase 3: Forms & Schemes

import type { Scheme, DefaultAttributes, SectionScheme, ProjectScheme } from './scheme';
import { DEFAULT_FORM_ATTRIBUTES } from './scheme';
import type { ClipboardItem } from './clipboard';
import type { TranscriptionState } from './transcription';
import { DEFAULT_TRANSCRIPTION_STATE } from './transcription';
import type { SectionConfigState, DivisionPreset } from './configuration';
import type { DocumentAsset, DocumentImportJob, ChunkExpressivity } from './document';

// ─── Texture types ───────────────────────────────────────────────────────────

export type BuiltinTextureId =
  | 'stripes-horiz' | 'stripes-vert' | 'stripes-diag-left' | 'stripes-diag-right'
  | 'dots-sm' | 'dots-md' | 'dots-lg'
  | 'crosshatch' | 'grid' | 'waves' | 'zigzag' | 'chevron'
  | 'checkerboard' | 'diamond' | 'noise-fine' | 'noise-coarse';

export interface TextureRef {
  type: 'builtin' | 'custom' | 'ai' | 'library';
  builtinId?: BuiltinTextureId;
  imageUrl?: string; // data URL for custom/ai/library textures
  libraryAssetId?: string; // references asset in AssetLibrary
  opacity: number;   // 0-1
  scale: number;     // 0.5-3
}

// ─── Gradient types ──────────────────────────────────────────────────────────

export interface GradientStop {
  color: string;        // hex
  position: number;     // 0-1
  textureRef?: TextureRef;
  textureOpacity?: number; // 0-1
}

export type GradientDirection = 'to-right' | 'to-left' | 'to-top' | 'to-bottom';

export interface GradientDef {
  stops: GradientStop[];
  direction: GradientDirection;
}

// ─── Unified chunk style ─────────────────────────────────────────────────────

export interface ChunkStyle {
  color: string;              // base hex color
  alpha: number;              // 0-1
  texture: TextureRef | null;
  gradient: GradientDef | null;
}

// ─── SFX types ───────────────────────────────────────────────────────────────

export interface SfxRef {
  type: 'builtin' | 'custom' | 'library';
  builtinId?: string;
  audioUrl?: string;  // data URL for custom/library SFX
  libraryAssetId?: string; // references asset in AssetLibrary
  volume: number;     // 0-1
}

export type SfxMatchType = 'global' | 'color' | 'texture' | 'color+texture';
export type SfxPosition = 'start' | 'end' | 'both';

export interface SfxMapping {
  id: string;
  matchType: SfxMatchType;
  colorHex?: string;
  textureId?: BuiltinTextureId;
  position: SfxPosition;
  sfxRef: SfxRef;
}

// ─── TTS types ───────────────────────────────────────────────────────────────

export type TtsAnnounceAt = 'start' | 'end' | 'both';
export type TtsContentMode = 'chunk-number' | 'color-label';
export type TtsChunkCountingMode = 'section-relative' | 'project-relative' | 'section-and-chunk' | 'full';

export interface TtsConfig {
  enabled: boolean;
  announceAt: TtsAnnounceAt;
  contentMode: TtsContentMode;
  chunkCountingMode: TtsChunkCountingMode;
  announceSections: boolean;
  sectionAnnounceAt: 'begin' | 'end' | 'both';
  speed: number;     // 0.5-2.0
  pitch: number;     // 0-2, default 1
  voiceUri: string;  // SpeechSynthesisVoice.voiceURI
  duckMainAudio: boolean;
  duckLevel: number; // 0-1, how much to reduce main audio during TTS
}

// ─── Synthetic TTS layer types ──────────────────────────────────────────────

export type SyntheticLayerMixMode = 'solo-primary' | 'solo-synthetic' | 'mix' | 'stereo-split';
export type SyntheticTtsEngine = 'kokoro' | 'elevenlabs' | 'qwen';

export interface SyntheticLayerConfig {
  enabled: boolean;
  volume: number;              // 0-1
  muted: boolean;
  mixMode: SyntheticLayerMixMode;
  primaryPan: number;          // -1 (left) to 1 (right), used in stereo-split
  syntheticPan: number;        // -1 to 1, used in stereo-split
  primaryDuckLevel: number;    // 0-1, used in mix mode (how much to reduce primary)
  ttsEngine: SyntheticTtsEngine; // which TTS engine to use
  voiceId: string;             // engine-specific voice ID
  headTtsSpeed: number;        // native generation speed (1.0-2.0)
  autoRegenerate: boolean;     // auto-regen when transcription text changes
  elevenLabsModelId: string;   // ElevenLabs model ID
}

export const DEFAULT_SYNTHETIC_LAYER_CONFIG: SyntheticLayerConfig = {
  enabled: false,
  volume: 1.0,
  muted: false,
  mixMode: 'solo-synthetic',
  primaryPan: -0.8,
  syntheticPan: 0.8,
  primaryDuckLevel: 0.3,
  ttsEngine: 'kokoro',
  voiceId: 'af_bella',
  headTtsSpeed: 1.0,
  autoRegenerate: true,
  elevenLabsModelId: 'eleven_multilingual_v2',
};

// ─── Chunk number style presets ──────────────────────────────────────────────

export type ChunkNumberPresetId = 'default' | 'badge' | 'monospace' | 'minimal' | 'outlined' | 'large';

// ─── Filter types ────────────────────────────────────────────────────────────

export type FilterCriterionType = 'color' | 'texture' | 'combo' | 'form' | 'tag';

export interface FilterCriteria {
  type: FilterCriterionType;
  colorHex?: string;
  textureId?: BuiltinTextureId;
  formId?: string; // Phase 3: filter by form
  tag?: string;    // Phase 2: filter by tag
}

export interface FilterState {
  active: boolean;
  criteria: FilterCriteria[];
}

// ─── Template types ──────────────────────────────────────────────────────────

export interface ColorKeyTemplate {
  id: string;
  name: string;
  builtIn: boolean;
  colorKey: ColorKeyEntry[];
  styles: Record<string, ChunkStyle>; // keyed by hex
  sfxMappings: SfxMapping[];
}

// ─── Color picker state ──────────────────────────────────────────────────────

export interface RecentColor {
  hex: string;
  usedAt: number; // timestamp
}

export interface FavoriteColor {
  hex: string;
}

// ─── Core project types ──────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  audioBuffers: AudioBufferRef[];
  chunks: Chunk[];
  sections: Section[];
  colorKey: ColorKey;
  settings: ProjectSettings;
  templates: ColorKeyTemplate[];
  // Phase 3: Forms & Schemes
  scheme: Scheme;             // active scheme
  schemes: Scheme[];          // all available schemes
  // Phase 3: Section Forms & Schemes
  sectionScheme: SectionScheme;       // active section scheme
  sectionSchemes: SectionScheme[];    // all available section schemes
  // Phase 4: Project Schemes
  projectScheme: ProjectScheme | null;    // null = independent mode
  projectSchemes: ProjectScheme[];
  tagLibrary: string[];      // Phase 2: all available tags
  // Phase 5: Transcription
  transcription: TranscriptionState;
  // Phase 6: Configurations
  sectionConfigs: Record<string, SectionConfigState>;
  divisionPresets: DivisionPreset[];
  // Phase 7+: Document import
  documentAssets: DocumentAsset[];
  documentImportJobs: DocumentImportJob[];
  documentExpressivity: Record<string, ChunkExpressivity>;
  undoStack: UndoAction[];
  redoStack: UndoAction[];
}

export interface AudioBufferRef {
  id: string;
  originalFileName: string;
  blob: Blob;
  decodedBuffer: AudioBuffer | null;
  sampleRate: number;
  duration: number;
}

export interface Chunk {
  id: string;
  audioBufferId: string;
  startTime: number;
  endTime: number;
  sectionId: string;
  orderIndex: number;
  color: string | null;
  style: ChunkStyle | null; // Phase 2: overrides color when non-null
  formId: string | null;    // Phase 3: form from active scheme
  tags: string[];           // Phase 2: custom user tags
  isDeleted: boolean;
  waveformData: number[] | null; // Pre-computed peak data for rendering
}

export interface Section {
  id: string;
  name: string;
  orderIndex: number;
  backgroundColor: string | null;
  backgroundStyle: ChunkStyle | null; // Phase 2: rich section background
  parentId: string | null;
  isCollapsed: boolean;
  depth: number; // 0 = top-level, 1 = subsection (max depth: 1)
  status: 'active' | 'removed' | 'trashed';
  sectionFormId: string | null; // Phase 3: section form from active section scheme
  tags: string[];               // Phase 2: custom user tags
}

export interface ColorKey {
  id: string;
  name: string;
  colors: ColorKeyEntry[];
}

export interface ColorKeyEntry {
  hex: string;
  label: string;
  shortcutKey: number; // 1-9, 0 for default/no shortcut
  style: ChunkStyle | null; // Phase 2: rich style per color key entry
}

export interface ProjectSettings {
  playbackSpeed: number;
  volume: number;
  zoomLevel: number;
  visualMode: 'waveform' | 'flat';
  chunkNumberDisplay: 'section-relative' | 'document-relative' | 'both' | 'hidden';
  silenceThresholdDb: number;
  minSilenceDurationMs: number;
  minChunkDurationMs: number;
  // Phase 2 additions
  sfxMappings: SfxMapping[];
  ttsConfig: TtsConfig;
  recentColors: RecentColor[];
  favoriteColors: FavoriteColor[];
  filter: FilterState;
  chunkNumberStyle: ChunkNumberPresetId;
  // Phase 3: default fallback attributes
  defaultAttributes: DefaultAttributes;
  // Sonocent Classic mode: light theme with flat solid colored bars
  classicMode: boolean;
  // Loop playback over selection or full document
  loopMode: boolean;
  // Synthetic TTS layer
  syntheticLayer: SyntheticLayerConfig;
}

export interface InsertionPoint {
  sectionId: string;
  orderIndex: number;
}

export interface TakeState {
  chunkIds: string[];
  originalPosition: { sectionId: string; startOrderIndex: number } | null;
  moved: boolean;
}

export type UndoActionType =
  | 'split'
  | 'merge'
  | 'delete'
  | 'move'
  | 'move-take'
  | 'recolor'
  | 'restyle'
  | 'section-style'
  | 'filter-extract'
  | 'filter-copy'
  | 'add-section'
  | 'rename-section'
  | 'delete-section'
  | 'import-audio'
  | 'reorder-sections'
  | 'merge-sections'
  | 'split-section'
  | 'nest-section'
  | 'unnest-section'
  | 'collapse-section'
  | 'remove-section'
  | 'restore-section'
  | 'empty-trash'
  // Phase 3: Forms & Schemes
  | 'apply-form'
  | 'change-scheme'
  | 'update-form'
  // Phase 3: Section Forms & Schemes
  | 'apply-section-form'
  | 'change-section-scheme'
  | 'update-section-form'
  // Phase 4: Project Schemes
  | 'change-project-scheme'
  // Phase 2: Tags
  | 'tag-chunks'
  | 'tag-sections'
  // Phase 5: Transcription
  | 'transcribe'
  | 'edit-transcription'
  | 'resolve-clarification'
  // Phase 6: Configurations
  | 'apply-configuration'
  | 'switch-version'
  | 'switch-configuration'
  // Phase 7+: Document import
  | 'import-document';

export interface UndoAction {
  type: UndoActionType;
  timestamp: number;
  previousState: {
    chunks: Chunk[];
    sections: Section[];
    clipboardItems?: ClipboardItem[];
    sectionConfigs?: Record<string, SectionConfigState>;
  };
}

// ─── Default color key — expanded to 20+ entries ─────────────────────────────

export const DEFAULT_COLORS: ColorKeyEntry[] = [
  // Warm family (1-3)
  { hex: '#EF4444', label: 'Key Point', shortcutKey: 1, style: null },
  { hex: '#F97316', label: 'Example', shortcutKey: 2, style: null },
  { hex: '#EAB308', label: 'Question', shortcutKey: 3, style: null },
  // Cool family (4-6)
  { hex: '#22C55E', label: 'Important', shortcutKey: 4, style: null },
  { hex: '#06B6D4', label: 'Definition', shortcutKey: 5, style: null },
  { hex: '#3B82F6', label: 'Reference', shortcutKey: 6, style: null },
  // Vivid family (7-9)
  { hex: '#8B5CF6', label: 'Review', shortcutKey: 7, style: null },
  { hex: '#EC4899', label: 'Action Item', shortcutKey: 8, style: null },
  { hex: '#6B7280', label: 'Skip', shortcutKey: 9, style: null },
  // Extended — no shortcuts (10+)
  { hex: '#DC2626', label: 'Critical', shortcutKey: 0, style: null },
  { hex: '#D97706', label: 'Caution', shortcutKey: 0, style: null },
  { hex: '#65A30D', label: 'Confirmed', shortcutKey: 0, style: null },
  { hex: '#0891B2', label: 'Hypothesis', shortcutKey: 0, style: null },
  { hex: '#2563EB', label: 'Source', shortcutKey: 0, style: null },
  { hex: '#7C3AED', label: 'Insight', shortcutKey: 0, style: null },
  { hex: '#DB2777', label: 'Highlight', shortcutKey: 0, style: null },
  // Pastel family
  { hex: '#FCA5A5', label: 'Note', shortcutKey: 0, style: null },
  { hex: '#FDE68A', label: 'Reminder', shortcutKey: 0, style: null },
  { hex: '#A7F3D0', label: 'Positive', shortcutKey: 0, style: null },
  { hex: '#BFDBFE', label: 'Context', shortcutKey: 0, style: null },
  // Neutral
  { hex: '#A1A1AA', label: 'Neutral', shortcutKey: 0, style: null },
  { hex: '#44403C', label: 'Background', shortcutKey: 0, style: null },
];

export const DEFAULT_CHUNK_COLOR = '#D1D5DB';

export const DEFAULT_TTS_CONFIG: TtsConfig = {
  enabled: false,
  announceAt: 'start',
  contentMode: 'chunk-number',
  chunkCountingMode: 'section-relative',
  announceSections: true,
  sectionAnnounceAt: 'begin',
  speed: 1.0,
  pitch: 1.0,
  voiceUri: '',
  duckMainAudio: true,
  duckLevel: 0.3,
};

export const DEFAULT_FILTER_STATE: FilterState = {
  active: false,
  criteria: [],
};

export const DEFAULT_SETTINGS: ProjectSettings = {
  playbackSpeed: 1.0,
  volume: 1.0,
  zoomLevel: 1.0,
  visualMode: 'waveform',
  chunkNumberDisplay: 'document-relative',
  silenceThresholdDb: -40,
  minSilenceDurationMs: 300,
  minChunkDurationMs: 500,
  sfxMappings: [],
  ttsConfig: DEFAULT_TTS_CONFIG,
  recentColors: [],
  favoriteColors: [],
  filter: DEFAULT_FILTER_STATE,
  chunkNumberStyle: 'default',
  defaultAttributes: DEFAULT_FORM_ATTRIBUTES,
  classicMode: false,
  loopMode: false,
  syntheticLayer: DEFAULT_SYNTHETIC_LAYER_CONFIG,
};
