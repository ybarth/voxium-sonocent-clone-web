import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type {
  Project, Chunk, Section, AudioBufferRef, ProjectSettings,
  UndoAction, InsertionPoint, TakeState,
  ChunkStyle, SfxMapping, TtsConfig, FilterCriteria,
  ColorKeyTemplate, ColorKeyEntry,
} from '../types';
import { DEFAULT_COLORS, DEFAULT_SETTINGS, DEFAULT_TTS_CONFIG } from '../types';
import type {
  TranscriptionState, TranscribedWord, WordChunkMapping, Speaker,
  TranscriptionJob, TranscriptionJobStatus, TranscriptionScope,
  EditingTierConfig, TranscriptionSettings, ClarificationQuery,
  TextViewMode, HighlightGranularity,
} from '../types/transcription';
import { DEFAULT_TRANSCRIPTION_STATE } from '../types/transcription';
import type { Scheme, Form, DefaultAttributes, SectionScheme, SectionForm, ProjectScheme } from '../types/scheme';
import { STANDARD_SCHEME, ALL_BUILTIN_SCHEMES } from '../constants/schemes';
import { STANDARD_SECTION_SCHEME, ALL_BUILTIN_SECTION_SCHEMES } from '../constants/sectionSchemes';
import { STANDARD_PROJECT_SCHEME, ALL_BUILTIN_PROJECT_SCHEMES } from '../constants/projectSchemes';
import { getFlatSectionOrder } from '../utils/sectionTree';
import {
  remapWordsAfterChunkSplit, remapWordsAfterChunkMerge, removeMappingsForChunks,
} from '../utils/wordChunkMapper';
import { BUILTIN_TEMPLATES } from '../constants/templates';
import { useClipboardStore } from './clipboardStore';
import type {
  SectionConfigState, SectionVersion, Configuration,
  DivisionPreset, DivisionCriterion, BoundaryPoint, AIDivisionSuggestion,
} from '../types/configuration';
import { ALL_BUILTIN_PRESETS, PRESET_SILENCE_DETECTION } from '../constants/divisionPresets';
import {
  chunksFromBoundaries, remapWordsForSection, mergeBoundaries,
  computeSilenceBoundaries, computeDurationBoundaries, computeWordBoundaries,
  createConfiguration, boundariesFromChunks, computeBoundaries,
} from '../utils/divisionEngine';

// --- Cursor model ---
// The cursor is a precise position: which chunk (or null if between/outside)
// and the exact fractional position (0-1) within that chunk.
// When the cursor is "between" chunks or at project start/end,
// currentChunkId is null and cursorTime represents the insert point.

interface PlaybackState {
  isPlaying: boolean;
  isRecording: boolean;
  currentChunkId: string | null;
  cursorTime: number;
  cursorPositionInChunk: number; // 0-1 within current chunk
  insertionPoint: InsertionPoint | null;
  /** Separate from insertionPoint — tracks where the recording head is during live recording */
  recordingHead: InsertionPoint | null;
  /** When non-null, chunks are painted this color as the cursor passes through them during playback */
  paintingColor: string | null;
}

interface SelectionState {
  selectedChunkIds: Set<string>;
  anchorChunkId: string | null; // For Shift-range selection: the chunk where the range started
  selectedSectionIds: Set<string>;
  anchorSectionId: string | null; // For Shift-range section selection
  focusedPaneId: 'audio' | 'text' | 'annotations' | 'file';
}

// Paintbrush: apply actions at a given scope
export type PaintbrushScope =
  | 'single-chunk'
  | 'single-section'
  | 'form-of-chunk'            // all chunks with formId X
  | 'form-of-section'          // all sections with sectionFormId Y
  | 'form-of-chunk-in-section' // chunks with formId X in section Y
  | 'form-of-chunk-in-section-form'; // chunks with formId X in sections with sectionFormId Y

export type ResettableAttribute = 'form' | 'section-form' | 'color' | 'tags' | 'shape';

export type PaintbrushAction =
  | { type: 'apply-form'; formId: string }
  | { type: 'apply-tags'; tags: string[] }
  | { type: 'remove-tags'; tags: string[] }
  | { type: 'reset-attribute'; attribute: ResettableAttribute };

export interface PaintbrushMode {
  action: PaintbrushAction;
  scope: PaintbrushScope;
  scopeFilterFormId?: string;
  scopeFilterSectionFormId?: string;
}

// Legacy ClipboardState kept for interface compatibility (actual state lives in clipboardStore)
export interface ClipboardState {
  chunks: Chunk[];
  sourceSectionId: string | null;
  mode: 'cut' | 'copy' | null;
}

interface ProjectStore {
  project: Project;
  playback: PlaybackState;
  selection: SelectionState;
  take: TakeState;

  audioContext: AudioContext | null;
  initAudioContext: () => AudioContext;

  setProjectName: (name: string) => void;
  updateSettings: (settings: Partial<ProjectSettings>) => void;

  addAudioBuffer: (ref: AudioBufferRef) => void;

  setChunks: (chunks: Chunk[]) => void;
  addChunks: (chunks: Chunk[]) => void;
  replaceLiveChunks: (liveAudioBufferId: string, newChunks: Chunk[]) => void;
  updateLiveRecording: (liveAudioBufferId: string, newChunks: Chunk[], recordingHead: InsertionPoint) => void;
  updateChunk: (id: string, updates: Partial<Chunk>) => void;
  deleteChunks: (ids: string[]) => void;
  colorChunks: (ids: string[], color: string | null) => void;
  splitChunkAtCursor: () => void;
  mergeChunks: (ids: string[]) => void;

  addSection: (name?: string, options?: { parentId?: string | null; afterSectionId?: string }) => Section;
  renameSection: (id: string, name: string) => void;
  deleteSection: (id: string) => void;
  reorderSections: (orderedIds: string[]) => void;
  toggleSectionCollapse: (id: string) => void;
  moveSectionUp: (id: string) => void;
  moveSectionDown: (id: string) => void;
  mergeSections: (sourceId: string, targetId: string) => void;
  mergeMultipleSections: (sectionIds: string[]) => void;
  splitSectionAtChunk: (sectionId: string, chunkOrderIndex: number) => void;
  nestSection: (sectionId: string, newParentId: string) => void;
  unnestSection: (sectionId: string) => void;
  removeSection: (id: string) => void;
  restoreSection: (id: string) => void;
  emptyTrash: () => void;

  // Selection — new model
  /** Click a chunk: plain click = single select; ctrl = toggle; shift = range from anchor */
  selectChunk: (id: string, mode: 'replace' | 'toggle' | 'range') => void;
  selectAllInSection: (sectionId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setFocusedPane: (pane: SelectionState['focusedPaneId']) => void;
  selectSection: (id: string, mode: 'replace' | 'toggle' | 'range') => void;
  clearSectionSelection: () => void;

  // Insertion point & take
  placeCursorAtInsertionPoint: (sectionId: string, orderIndex: number) => void;
  bumpChunksForInsertion: (sectionId: string, fromOrderIndex: number, offset: number) => void;
  renumberSection: (sectionId: string) => void;
  setTakeChunkIds: (ids: string[], originalSectionId: string, startOrderIndex: number) => void;
  clearTake: () => void;
  moveTakeToPosition: (sectionId: string, orderIndex: number) => void;
  moveTakeBack: () => void;

  // Cursor placement
  /** Place cursor at a specific position within a chunk (fraction 0-1) */
  placeCursorInChunk: (chunkId: string, fraction: number) => void;
  setPlaying: (playing: boolean) => void;
  setRecording: (recording: boolean) => void;
  setRecordingHead: (head: InsertionPoint | null) => void;
  setCurrentChunk: (id: string | null) => void;
  setCursorTime: (time: number) => void;
  setCursorPositionInChunk: (pos: number) => void;
  setPaintingColor: (color: string | null) => void;
  /** Color a single chunk without pushing undo (used during painting) */
  paintChunk: (id: string, color: string) => void;

  // Navigation — shift extends selection
  navigateChunk: (direction: 'prev' | 'next', extend?: boolean) => void;
  navigateSection: (direction: 'prev' | 'next') => void;
  navigateToStart: () => void;
  navigateToEnd: () => void;
  navigateToSectionStart: () => void;
  navigateToSectionEnd: () => void;

  // Intra-chunk cursor
  scrubCursor: (delta: number) => void;

  // Nudge / reorder
  nudgeChunks: (ids: string[], direction: -1 | 1) => void;
  nudgeChunksToEdge: (ids: string[], edge: 'start' | 'end') => void;
  moveChunksToSection: (ids: string[], direction: 'prev' | 'next') => void;

  // Editing extras
  duplicateChunks: (ids: string[]) => void;

  // Selection extras
  invertSelection: () => void;

  // Phase 2: Rich styling
  styleChunks: (ids: string[], style: ChunkStyle) => void;
  setSectionStyle: (sectionId: string, style: ChunkStyle | null) => void;
  setSectionStyles: (sectionIds: string[], style: ChunkStyle | null) => void;
  addRecentColor: (hex: string) => void;
  toggleFavoriteColor: (hex: string) => void;

  // Phase 2: Filter
  setFilter: (criteria: FilterCriteria[]) => void;
  clearFilter: () => void;
  toggleFilterCriterion: (criterion: FilterCriteria) => void;
  extractFilteredChunks: (targetSectionName: string) => void;
  copyFilteredChunks: (targetSectionName: string) => void;
  getFilteredChunkIds: () => Set<string>;

  // Phase 2: SFX
  setSfxMappings: (mappings: SfxMapping[]) => void;
  addSfxMapping: (mapping: SfxMapping) => void;
  removeSfxMapping: (id: string) => void;

  // Phase 2: TTS
  setTtsConfig: (partial: Partial<TtsConfig>) => void;

  // Phase 2: Templates
  createTemplate: (name: string) => void;
  updateTemplate: (id: string, updates: Partial<ColorKeyTemplate>) => void;
  deleteTemplate: (id: string) => void;
  duplicateTemplate: (id: string) => void;
  applyTemplate: (id: string, mode?: 'both' | 'colors' | 'sounds') => void;
  exportTemplate: (id: string) => string;
  importTemplate: (json: string) => void;

  // Phase 2: Color key management
  updateColorKeyEntry: (index: number, updates: Partial<ColorKeyEntry>) => void;
  addColorKeyEntry: (entry: ColorKeyEntry) => void;
  removeColorKeyEntry: (index: number) => void;

  // Phase 3: Forms & Schemes
  applyForm: (ids: string[], formId: string) => void;
  clearForm: (ids: string[]) => void;
  paintForm: (id: string, formId: string) => void;
  setActiveScheme: (schemeId: string) => void;
  createScheme: (name: string) => Scheme;
  updateScheme: (id: string, updates: Partial<Scheme>) => void;
  deleteScheme: (id: string) => void;
  duplicateScheme: (id: string) => void;
  addFormToScheme: (schemeId: string, form: Form) => void;
  updateFormInScheme: (schemeId: string, formId: string, updates: Partial<Form>) => void;
  removeFormFromScheme: (schemeId: string, formId: string) => void;
  setDefaultAttributes: (updates: Partial<DefaultAttributes>) => void;

  // Phase 3: Section Forms & Schemes
  applySectionForm: (sectionIds: string[], formId: string) => void;
  clearSectionForm: (sectionIds: string[]) => void;
  setActiveSectionScheme: (schemeId: string) => void;
  createSectionScheme: (name: string) => SectionScheme;
  updateSectionScheme: (id: string, updates: Partial<SectionScheme>) => void;
  deleteSectionScheme: (id: string) => void;
  duplicateSectionScheme: (id: string) => void;
  addSectionFormToScheme: (schemeId: string, form: SectionForm) => void;
  updateSectionFormInScheme: (schemeId: string, formId: string, updates: Partial<SectionForm>) => void;
  removeSectionFormFromScheme: (schemeId: string, formId: string) => void;

  // Scheme templates (localStorage-backed)
  addScheme: (scheme: Scheme) => void;
  addSectionScheme: (scheme: SectionScheme) => void;
  saveSchemeAsTemplate: (schemeId: string, newName?: string, overwriteTemplateId?: string) => void;
  loadSchemeTemplate: (templateId: string) => void;
  getSavedTemplateNames: () => { id: string; name: string }[];
  deleteSchemeTemplate: (templateId: string) => void;

  // Phase 4: Project Schemes
  createProjectScheme: (name: string, chunkSchemeId: string, sectionSchemeId: string) => ProjectScheme;
  addProjectScheme: (scheme: ProjectScheme) => void;
  setActiveProjectScheme: (id: string | null) => void;
  updateProjectScheme: (id: string, updates: Partial<ProjectScheme>) => void;
  deleteProjectScheme: (id: string) => void;
  duplicateProjectScheme: (id: string) => void;

  // Phase 2: Tags
  tagChunks: (ids: string[], tags: string[]) => void;
  untagChunks: (ids: string[], tags: string[]) => void;
  tagSections: (ids: string[], tags: string[]) => void;
  untagSections: (ids: string[], tags: string[]) => void;
  addTagToLibrary: (tag: string) => void;
  removeTagFromLibrary: (tag: string) => void;

  // Phase 2: Selection Checkmarks
  checkSelectionMode: boolean;
  setCheckSelectionMode: (on: boolean) => void;
  checkedChunkIds: Set<string>;
  checkedSectionIds: Set<string>;
  toggleCheckChunk: (id: string) => void;
  toggleCheckSection: (id: string) => void;
  checkAllSelected: () => void;
  uncheckAll: () => void;
  applyToChecked: (action: 'style' | 'form' | 'sectionForm' | 'delete' | 'tag', payload?: unknown) => void;

  // Phase 2: Paintbrush
  paintbrushMode: PaintbrushMode | null;
  setPaintbrushMode: (mode: PaintbrushMode | null) => void;
  applyPaintbrush: (targetId: string, targetType: 'chunk' | 'section') => void;
  resetChunkAttribute: (ids: string[], attribute: ResettableAttribute) => void;
  resetSectionAttribute: (ids: string[], attribute: ResettableAttribute) => void;

  // Phase 2.5: Virtual Clipboard
  clipboard: ClipboardState;
  clipboardCut: () => void;
  clipboardCopy: () => void;
  clipboardPaste: (specificItemId?: string) => void;

  // Phase 2.5: Drag-and-Drop Chunk Reorder
  moveChunksToPosition: (chunkIds: string[], targetSectionId: string, targetOrderIndex: number) => void;

  // Phase 5: Transcription
  setTranscriptionWords: (words: TranscribedWord[]) => void;
  addTranscriptionWords: (words: TranscribedWord[]) => void;
  updateWord: (wordId: string, updates: Partial<TranscribedWord>) => void;
  deleteWords: (wordIds: string[]) => void;
  setWordChunkMappings: (mappings: WordChunkMapping[]) => void;
  addWordChunkMappings: (mappings: WordChunkMapping[]) => void;
  addSpeaker: (speaker: Speaker) => void;
  updateSpeaker: (id: string, updates: Partial<Speaker>) => void;
  startTranscriptionJob: (job: TranscriptionJob) => void;
  updateJobStatus: (jobId: string, status: TranscriptionJobStatus, updates?: Partial<TranscriptionJob>) => void;
  cancelJob: (jobId: string) => void;
  updateTranscriptionSettings: (updates: Partial<TranscriptionSettings>) => void;
  updateEditingConfig: (updates: Partial<EditingTierConfig>) => void;
  setClarifications: (queries: ClarificationQuery[]) => void;
  resolveClarification: (queryId: string, resolvedText: string) => void;
  dismissClarification: (queryId: string) => void;
  setTextViewMode: (mode: TextViewMode) => void;
  setHighlightGranularity: (granularities: HighlightGranularity[]) => void;
  markChunksStale: (chunkIds: string[]) => void;
  clearStaleChunks: (chunkIds: string[]) => void;

  // Phase 6: Configuration System
  initSectionConfig: (sectionId: string) => void;
  addVersion: (sectionId: string, audioRanges: { audioBufferId: string; startTime: number; endTime: number }[], source: 'recording' | 'import' | 'manual') => void;
  addConfiguration: (sectionId: string, versionId: string, config: Configuration) => void;
  switchConfiguration: (sectionId: string, configIndex: number) => void;
  switchVersion: (sectionId: string, versionIndex: number) => void;
  cycleConfiguration: (sectionId: string, direction: 1 | -1) => void;
  deleteConfiguration: (sectionId: string, versionId: string, configId: string) => void;
  renameConfiguration: (sectionId: string, versionId: string, configId: string, name: string) => void;
  setPreviewConfig: (sectionId: string, config: Configuration | null) => void;
  commitPreview: (sectionId: string) => void;
  applyDivisionPreset: (sectionId: string, presetId: string) => void;
  applyCustomDivision: (sectionId: string, criteria: DivisionCriterion[]) => void;
  applyWordPerChunk: (sectionId: string) => void;
  addDivisionPreset: (preset: DivisionPreset) => void;
  updateDivisionPreset: (id: string, updates: Partial<DivisionPreset>) => void;
  deleteDivisionPreset: (id: string) => void;

  pushUndo: (type: UndoAction['type'], clipboardSnapshot?: import('../types/clipboard').ClipboardItem[]) => void;
  undo: () => void;
  redo: () => void;
}

export function getOrderedChunks(chunks: Chunk[], sections: Section[]): Chunk[] {
  const activeSections = sections.filter(s => (s.status ?? 'active') === 'active');
  const flatOrder = getFlatSectionOrder(activeSections);
  const sectionPosition = new Map(flatOrder.map((s, i) => [s.id, i]));
  const activeSectionIds = new Set(flatOrder.map(s => s.id));
  return [...chunks]
    .filter(c => !c.isDeleted && activeSectionIds.has(c.sectionId))
    .sort((a, b) => {
      const sA = sectionPosition.get(a.sectionId) ?? 0;
      const sB = sectionPosition.get(b.sectionId) ?? 0;
      if (sA !== sB) return sA - sB;
      return a.orderIndex - b.orderIndex;
    });
}

const initialSection: Section = {
  id: uuid(),
  name: 'Section 1',
  orderIndex: 0,
  backgroundColor: null,
  backgroundStyle: null,
  parentId: null,
  isCollapsed: false,
  depth: 0,
  status: 'active',
  sectionFormId: null,
  tags: [],
};

const initialScheme: Scheme = STANDARD_SCHEME;

const initialProject: Project = {
  id: uuid(),
  name: 'Untitled Project',
  createdAt: new Date(),
  updatedAt: new Date(),
  audioBuffers: [],
  chunks: [],
  sections: [initialSection],
  colorKey: {
    id: uuid(),
    name: 'Default',
    colors: DEFAULT_COLORS,
  },
  settings: { ...DEFAULT_SETTINGS },
  templates: [],
  scheme: initialScheme,
  schemes: [initialScheme],
  sectionScheme: STANDARD_SECTION_SCHEME,
  sectionSchemes: [STANDARD_SECTION_SCHEME],
  projectScheme: STANDARD_PROJECT_SCHEME,
  projectSchemes: [STANDARD_PROJECT_SCHEME],
  tagLibrary: [],
  transcription: { ...DEFAULT_TRANSCRIPTION_STATE },
  sectionConfigs: {},
  divisionPresets: [...ALL_BUILTIN_PRESETS],
  undoStack: [],
  redoStack: [],
};

/**
 * Migrate legacy TtsConfig to current schema.
 * Handles: missing chunkCountingMode, old 'section-and-chunk' contentMode,
 * missing announceSections/sectionAnnounceAt/pitch.
 */
function migrateTtsConfig(config: any): TtsConfig {
  const migrated = { ...DEFAULT_TTS_CONFIG, ...config };

  // Migrate old 'section-and-chunk' contentMode to new chunkCountingMode
  if (config.contentMode === 'section-and-chunk') {
    migrated.contentMode = 'chunk-number';
    migrated.chunkCountingMode = 'section-and-chunk';
  }

  // Ensure new fields have defaults
  if (migrated.chunkCountingMode === undefined) migrated.chunkCountingMode = 'section-relative';
  if (migrated.announceSections === undefined) migrated.announceSections = true;
  if (migrated.sectionAnnounceAt === undefined) migrated.sectionAnnounceAt = 'begin';
  if (migrated.pitch === undefined) migrated.pitch = 1.0;

  return migrated;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: initialProject,

  playback: {
    isPlaying: false,
    isRecording: false,
    currentChunkId: null,
    cursorTime: 0,
    cursorPositionInChunk: 0,
    insertionPoint: null,
    recordingHead: null,
    paintingColor: null,
  },

  take: { chunkIds: [], originalPosition: null, moved: false },

  selection: {
    selectedChunkIds: new Set(),
    anchorChunkId: null,
    selectedSectionIds: new Set(),
    anchorSectionId: null,
    focusedPaneId: 'audio',
  },

  // Phase 2: Selection checkmarks
  checkSelectionMode: false,
  checkedChunkIds: new Set<string>(),
  checkedSectionIds: new Set<string>(),

  // Phase 2: Paintbrush
  paintbrushMode: null,

  // Phase 2.5: Virtual clipboard
  clipboard: { chunks: [], sourceSectionId: null, mode: null },

  audioContext: null,

  initAudioContext: () => {
    let ctx = get().audioContext;
    if (!ctx) {
      ctx = new AudioContext();
      set({ audioContext: ctx });
    }
    return ctx;
  },

  setProjectName: (name) =>
    set((s) => ({ project: { ...s.project, name, updatedAt: new Date() } })),

  updateSettings: (settings) =>
    set((s) => ({
      project: {
        ...s.project,
        settings: { ...s.project.settings, ...settings },
        updatedAt: new Date(),
      },
    })),

  addAudioBuffer: (ref) =>
    set((s) => ({
      project: {
        ...s.project,
        audioBuffers: [...s.project.audioBuffers, ref],
        updatedAt: new Date(),
      },
    })),

  setChunks: (chunks) =>
    set((s) => ({ project: { ...s.project, chunks, updatedAt: new Date() } })),

  addChunks: (chunks) =>
    set((s) => ({
      project: {
        ...s.project,
        chunks: [...s.project.chunks, ...chunks],
        updatedAt: new Date(),
      },
    })),

  replaceLiveChunks: (liveAudioBufferId, newChunks) =>
    set((s) => {
      // Detect which existing chunks are being replaced
      const replacedChunkIds = s.project.chunks
        .filter((c) => c.audioBufferId === liveAudioBufferId)
        .map((c) => c.id);

      // Check if any of those had transcription data
      const transcribedChunkIds = new Set(s.project.transcription.wordChunkMappings.map(m => m.chunkId));
      const staleIds = replacedChunkIds.filter(id => transcribedChunkIds.has(id));

      const existingStale = new Set(s.project.transcription.staleChunkIds);
      staleIds.forEach(id => existingStale.add(id));

      return {
        project: {
          ...s.project,
          chunks: [
            ...s.project.chunks.filter((c) => c.audioBufferId !== liveAudioBufferId),
            ...newChunks,
          ],
          transcription: {
            ...s.project.transcription,
            staleChunkIds: staleIds.length > 0 ? Array.from(existingStale) : s.project.transcription.staleChunkIds,
          },
          updatedAt: new Date(),
        },
      };
    }),

  updateLiveRecording: (liveAudioBufferId, newChunks, recordingHead) =>
    set((s) => ({
      project: {
        ...s.project,
        chunks: [
          ...s.project.chunks.filter((c) => c.audioBufferId !== liveAudioBufferId),
          ...newChunks,
        ],
        updatedAt: new Date(),
      },
      playback: { ...s.playback, recordingHead },
    })),

  updateChunk: (id, updates) =>
    set((s) => ({
      project: {
        ...s.project,
        chunks: s.project.chunks.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
        updatedAt: new Date(),
      },
    })),

  deleteChunks: (ids) => {
    get().pushUndo('delete');
    set((s) => {
      const updatedMappings = removeMappingsForChunks(ids, s.project.transcription.wordChunkMappings);
      return {
        project: {
          ...s.project,
          chunks: s.project.chunks.map((c) =>
            ids.includes(c.id) ? { ...c, isDeleted: true } : c
          ),
          transcription: { ...s.project.transcription, wordChunkMappings: updatedMappings },
          updatedAt: new Date(),
        },
        selection: { ...s.selection, selectedChunkIds: new Set(), anchorChunkId: null },
        playback: { ...s.playback, insertionPoint: null },
      };
    });
  },

  colorChunks: (ids, color) => {
    get().pushUndo('recolor');
    set((s) => ({
      project: {
        ...s.project,
        chunks: s.project.chunks.map((c) =>
          ids.includes(c.id) ? { ...c, color } : c
        ),
        updatedAt: new Date(),
      },
    }));
  },

  splitChunkAtCursor: () => {
    const { playback, project } = get();
    if (!playback.currentChunkId) return;
    const chunk = project.chunks.find((c) => c.id === playback.currentChunkId);
    if (!chunk) return;

    const fraction = playback.cursorPositionInChunk;
    if (fraction <= 0.01 || fraction >= 0.99) return; // Too close to edges

    const splitTimeInChunk = (chunk.endTime - chunk.startTime) * fraction;
    const absTime = chunk.startTime + splitTimeInChunk;

    get().pushUndo('split');
    set((s) => {
      const orig = s.project.chunks.find((c) => c.id === playback.currentChunkId);
      if (!orig) return s;

      const chunk1: Chunk = {
        ...orig,
        id: uuid(),
        endTime: absTime,
        waveformData: null,
      };
      const chunk2: Chunk = {
        ...orig,
        id: uuid(),
        startTime: absTime,
        orderIndex: orig.orderIndex + 0.5,
        waveformData: null,
      };

      const newChunks = s.project.chunks
        .filter((c) => c.id !== orig.id)
        .concat([chunk1, chunk2]);

      // Renumber per section
      const bySection = new Map<string, Chunk[]>();
      for (const c of newChunks) {
        const arr = bySection.get(c.sectionId) ?? [];
        arr.push(c);
        bySection.set(c.sectionId, arr);
      }
      for (const arr of bySection.values()) {
        arr.sort((a, b) => a.orderIndex - b.orderIndex);
        arr.forEach((c, i) => { c.orderIndex = i; });
      }

      // Update word-chunk mappings for the split
      const updatedMappings = remapWordsAfterChunkSplit(
        orig.id,
        [chunk1, chunk2],
        s.project.transcription.wordChunkMappings,
        orig,
      );

      // Sync split boundary to active configuration
      const sectionId = orig.sectionId;
      const cs = s.project.sectionConfigs[sectionId];
      let updatedSectionConfigs = s.project.sectionConfigs;
      if (cs) {
        const version = cs.versions[cs.activeVersionIndex];
        if (version) {
          const activeConfig = version.configurations[version.activeConfigIndex];
          if (activeConfig) {
            const newBoundary: BoundaryPoint = { time: absTime, source: 'manual', confidence: 1.0 };
            const updatedConfig = {
              ...activeConfig,
              boundaries: [...activeConfig.boundaries, newBoundary].sort((a, b) => a.time - b.time),
            };
            const updatedVersions = cs.versions.map((v, vi) =>
              vi === cs.activeVersionIndex
                ? { ...v, configurations: v.configurations.map((c, ci) => ci === v.activeConfigIndex ? updatedConfig : c) }
                : v,
            );
            updatedSectionConfigs = { ...s.project.sectionConfigs, [sectionId]: { ...cs, versions: updatedVersions } };
          }
        }
      }

      return {
        project: {
          ...s.project,
          chunks: newChunks,
          transcription: { ...s.project.transcription, wordChunkMappings: updatedMappings },
          sectionConfigs: updatedSectionConfigs,
          updatedAt: new Date(),
        },
        playback: {
          ...s.playback,
          currentChunkId: chunk2.id,
          cursorPositionInChunk: 0,
          insertionPoint: null,
        },
        selection: {
          ...s.selection,
          selectedChunkIds: new Set([chunk1.id, chunk2.id]),
          anchorChunkId: chunk1.id,
        },
      };
    });
  },

  mergeChunks: (ids) => {
    const { project } = get();
    const ordered = getOrderedChunks(project.chunks, project.sections);
    const toMerge = ordered.filter((c) => ids.includes(c.id));
    if (toMerge.length < 2) return;

    const allSameBuffer = toMerge.every(
      (c) => c.audioBufferId === toMerge[0].audioBufferId
    );
    if (!allSameBuffer) return;

    get().pushUndo('merge');
    set((s) => {
      const merged: Chunk = {
        id: uuid(),
        audioBufferId: toMerge[0].audioBufferId,
        startTime: Math.min(...toMerge.map((c) => c.startTime)),
        endTime: Math.max(...toMerge.map((c) => c.endTime)),
        sectionId: toMerge[0].sectionId,
        orderIndex: toMerge[0].orderIndex,
        color: toMerge[0].color,
        style: toMerge[0].style ?? null,
        formId: toMerge[0].formId ?? null,
        tags: [...new Set(toMerge.flatMap(c => c.tags ?? []))],
        isDeleted: false,
        waveformData: null,
      };

      const newChunks = s.project.chunks
        .filter((c) => !ids.includes(c.id))
        .concat([merged]);

      // Update word-chunk mappings for the merge
      const updatedMappings = remapWordsAfterChunkMerge(
        ids,
        merged.id,
        s.project.transcription.wordChunkMappings,
        toMerge,
      );

      // Sync: remove boundaries between merged range from active configuration
      const mergeSectionId = toMerge[0].sectionId;
      const cs = s.project.sectionConfigs[mergeSectionId];
      let updatedSectionConfigs = s.project.sectionConfigs;
      if (cs) {
        const version = cs.versions[cs.activeVersionIndex];
        if (version) {
          const activeConfig = version.configurations[version.activeConfigIndex];
          if (activeConfig) {
            const mergeStart = merged.startTime;
            const mergeEnd = merged.endTime;
            const filteredBoundaries = activeConfig.boundaries.filter(
              b => b.time <= mergeStart || b.time >= mergeEnd,
            );
            const updatedConfig = { ...activeConfig, boundaries: filteredBoundaries };
            const updatedVersions = cs.versions.map((v, vi) =>
              vi === cs.activeVersionIndex
                ? { ...v, configurations: v.configurations.map((c, ci) => ci === v.activeConfigIndex ? updatedConfig : c) }
                : v,
            );
            updatedSectionConfigs = { ...s.project.sectionConfigs, [mergeSectionId]: { ...cs, versions: updatedVersions } };
          }
        }
      }

      return {
        project: {
          ...s.project,
          chunks: newChunks,
          transcription: { ...s.project.transcription, wordChunkMappings: updatedMappings },
          sectionConfigs: updatedSectionConfigs,
          updatedAt: new Date(),
        },
        selection: { ...s.selection, selectedChunkIds: new Set([merged.id]), anchorChunkId: merged.id },
        playback: { ...s.playback, insertionPoint: null },
      };
    });
  },

  addSection: (name, options) => {
    const store = get();
    const parentId = options?.parentId ?? null;
    const afterSectionId = options?.afterSectionId;
    const depth = parentId ? Math.min(1, (store.project.sections.find((s) => s.id === parentId)?.depth ?? 0) + 1) : 0;

    // Determine orderIndex: insert after afterSectionId among active siblings, or at the end
    let orderIndex: number;
    const siblings = store.project.sections.filter((s) => s.parentId === parentId && (s.status ?? 'active') === 'active');
    if (afterSectionId) {
      const afterSection = siblings.find((s) => s.id === afterSectionId);
      orderIndex = afterSection ? afterSection.orderIndex + 1 : Math.max(...siblings.map((s) => s.orderIndex), -1) + 1;
    } else {
      orderIndex = Math.max(...siblings.map((s) => s.orderIndex), -1) + 1;
    }

    const section: Section = {
      id: uuid(),
      name: name ?? `Section ${store.project.sections.filter(s => (s.status ?? 'active') === 'active').length + 1}`,
      orderIndex,
      backgroundColor: null,
      backgroundStyle: null,
      parentId,
      isCollapsed: false,
      depth,
      status: 'active',
      sectionFormId: null,
      tags: [],
    };

    // Bump sibling orderIndexes that are >= the new orderIndex (when inserting in the middle)
    const updatedSections = afterSectionId
      ? store.project.sections.map((s) =>
          s.parentId === parentId && s.orderIndex >= orderIndex
            ? { ...s, orderIndex: s.orderIndex + 1 }
            : s
        )
      : store.project.sections;

    store.pushUndo('add-section');
    const isRecording = store.playback.isRecording;
    set((s) => ({
      project: {
        ...s.project,
        sections: [...updatedSections, section],
        updatedAt: new Date(),
      },
      // During recording, redirect both insertion point and recording head to the new section
      ...(isRecording ? {
        playback: {
          ...s.playback,
          insertionPoint: { sectionId: section.id, orderIndex: 0 },
          recordingHead: { sectionId: section.id, orderIndex: 0 },
          currentChunkId: null,
        },
      } : {}),
    }));
    return section;
  },

  renameSection: (id, name) => {
    get().pushUndo('rename-section');
    set((s) => ({
      project: {
        ...s.project,
        sections: s.project.sections.map((sec) => sec.id === id ? { ...sec, name } : sec),
        updatedAt: new Date(),
      },
    }));
  },

  deleteSection: (id) => {
    // Must keep at least one active section
    const activeSections = get().project.sections.filter(s => (s.status ?? 'active') === 'active');
    if (activeSections.length <= 1) return;
    get().pushUndo('delete-section');
    set((s) => {
      const childIds = new Set(s.project.sections.filter(sec => sec.parentId === id).map(sec => sec.id));
      return {
        project: {
          ...s.project,
          sections: s.project.sections.map((sec) =>
            sec.id === id || childIds.has(sec.id)
              ? { ...sec, status: 'trashed' as const }
              : sec
          ),
          updatedAt: new Date(),
        },
      };
    });
  },

  reorderSections: (orderedIds) =>
    set((s) => ({
      project: {
        ...s.project,
        sections: s.project.sections
          .map((sec) => ({ ...sec, orderIndex: orderedIds.indexOf(sec.id) }))
          .sort((a, b) => a.orderIndex - b.orderIndex),
        updatedAt: new Date(),
      },
    })),

  toggleSectionCollapse: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        sections: s.project.sections.map((sec) =>
          sec.id === id ? { ...sec, isCollapsed: !sec.isCollapsed } : sec
        ),
        updatedAt: new Date(),
      },
    })),

  moveSectionUp: (id) => {
    const { project } = get();
    const section = project.sections.find((s) => s.id === id);
    if (!section) return;
    const siblings = project.sections
      .filter((s) => s.parentId === section.parentId && (s.status ?? 'active') === 'active')
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = siblings.findIndex((s) => s.id === id);
    if (idx <= 0) return;
    const prev = siblings[idx - 1];
    get().pushUndo('reorder-sections');
    set((s) => ({
      project: {
        ...s.project,
        sections: s.project.sections.map((sec) => {
          if (sec.id === id) return { ...sec, orderIndex: prev.orderIndex };
          if (sec.id === prev.id) return { ...sec, orderIndex: section.orderIndex };
          return sec;
        }),
        updatedAt: new Date(),
      },
    }));
  },

  moveSectionDown: (id) => {
    const { project } = get();
    const section = project.sections.find((s) => s.id === id);
    if (!section) return;
    const siblings = project.sections
      .filter((s) => s.parentId === section.parentId && (s.status ?? 'active') === 'active')
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = siblings.findIndex((s) => s.id === id);
    if (idx >= siblings.length - 1) return;
    const next = siblings[idx + 1];
    get().pushUndo('reorder-sections');
    set((s) => ({
      project: {
        ...s.project,
        sections: s.project.sections.map((sec) => {
          if (sec.id === id) return { ...sec, orderIndex: next.orderIndex };
          if (sec.id === next.id) return { ...sec, orderIndex: section.orderIndex };
          return sec;
        }),
        updatedAt: new Date(),
      },
    }));
  },

  mergeSections: (sourceId, targetId) => {
    const { project } = get();
    const targetChunks = project.chunks.filter((c) => c.sectionId === targetId && !c.isDeleted);
    const maxTargetOrder = targetChunks.length > 0
      ? Math.max(...targetChunks.map((c) => c.orderIndex))
      : -1;

    get().pushUndo('merge-sections');
    set((s) => {
      // Move source chunks to target, appending after existing
      const updatedChunks = s.project.chunks.map((c) => {
        if (c.sectionId === sourceId && !c.isDeleted) {
          return { ...c, sectionId: targetId, orderIndex: maxTargetOrder + 1 + c.orderIndex };
        }
        return c;
      });

      // Reparent source's children to target's parent
      const source = s.project.sections.find((sec) => sec.id === sourceId);
      const updatedSections = s.project.sections
        .map((sec) => {
          if (sec.parentId === sourceId) {
            return { ...sec, parentId: source?.parentId ?? null, depth: source?.depth ?? 0 };
          }
          return sec;
        })
        .filter((sec) => sec.id !== sourceId);

      return {
        project: { ...s.project, chunks: updatedChunks, sections: updatedSections, updatedAt: new Date() },
      };
    });
  },

  mergeMultipleSections: (sectionIds) => {
    if (sectionIds.length < 2) return;
    const { project } = get();

    // Order the given IDs by their display position (flat section order, active only)
    const activeSections = project.sections.filter(s => (s.status ?? 'active') === 'active');
    const flatOrder = getFlatSectionOrder(activeSections);
    const positionMap = new Map(flatOrder.map((s, i) => [s.id, i]));
    const ordered = [...sectionIds].sort((a, b) => (positionMap.get(a) ?? 0) - (positionMap.get(b) ?? 0));

    const targetId = ordered[0]; // keep the first one
    const sourcesToMerge = ordered.slice(1);

    get().pushUndo('merge-sections');
    set((s) => {
      let chunks = [...s.project.chunks];
      let sections = [...s.project.sections];

      // Merge each source into target sequentially
      for (const sourceId of sourcesToMerge) {
        const targetChunks = chunks.filter((c) => c.sectionId === targetId && !c.isDeleted);
        const maxOrder = targetChunks.length > 0
          ? Math.max(...targetChunks.map((c) => c.orderIndex))
          : -1;

        // Move source chunks to target
        chunks = chunks.map((c) => {
          if (c.sectionId === sourceId && !c.isDeleted) {
            return { ...c, sectionId: targetId, orderIndex: maxOrder + 1 + c.orderIndex };
          }
          return c;
        });

        // Reparent source's children
        const source = sections.find((sec) => sec.id === sourceId);
        sections = sections
          .map((sec) => {
            if (sec.parentId === sourceId) {
              return { ...sec, parentId: source?.parentId ?? null, depth: source?.depth ?? 0 };
            }
            return sec;
          })
          .filter((sec) => sec.id !== sourceId);
      }

      return {
        project: { ...s.project, chunks, sections, updatedAt: new Date() },
      };
    });
  },

  splitSectionAtChunk: (sectionId, chunkOrderIndex) => {
    const { project } = get();
    const section = project.sections.find((s) => s.id === sectionId);
    if (!section) return;

    get().pushUndo('split-section');
    const newSectionId = uuid();
    const newSection: Section = {
      id: newSectionId,
      name: `${section.name} (cont.)`,
      orderIndex: section.orderIndex + 0.5, // Will be renumbered
      backgroundColor: section.backgroundColor,
      backgroundStyle: section.backgroundStyle ?? null,
      parentId: section.parentId,
      isCollapsed: false,
      depth: section.depth,
      status: 'active',
      sectionFormId: null,
      tags: [...(section.tags ?? [])],
    };

    set((s) => {
      // Move chunks at/after chunkOrderIndex to the new section
      const updatedChunks = s.project.chunks.map((c) => {
        if (c.sectionId === sectionId && !c.isDeleted && c.orderIndex >= chunkOrderIndex) {
          return { ...c, sectionId: newSectionId, orderIndex: c.orderIndex - chunkOrderIndex };
        }
        return c;
      });

      // Insert new section and renumber siblings
      const siblings = [...s.project.sections, newSection]
        .filter((sec) => sec.parentId === section.parentId)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      const siblingOrder = new Map(siblings.map((sec, i) => [sec.id, i]));

      const updatedSections = [...s.project.sections, newSection].map((sec) => {
        const newOrder = siblingOrder.get(sec.id);
        return newOrder !== undefined && sec.parentId === section.parentId
          ? { ...sec, orderIndex: newOrder }
          : sec;
      });

      return {
        project: { ...s.project, chunks: updatedChunks, sections: updatedSections, updatedAt: new Date() },
      };
    });
  },

  nestSection: (sectionId, newParentId) => {
    const { project } = get();
    const section = project.sections.find((s) => s.id === sectionId);
    const parent = project.sections.find((s) => s.id === newParentId);
    if (!section || !parent) return;
    // Guard: max depth 1, no self-nesting
    if (parent.depth >= 1 || sectionId === newParentId) return;

    get().pushUndo('nest-section');
    set((s) => {
      const newChildren = s.project.sections.filter((sec) => sec.parentId === newParentId);
      const maxOrder = newChildren.length > 0 ? Math.max(...newChildren.map((c) => c.orderIndex)) : -1;
      return {
        project: {
          ...s.project,
          sections: s.project.sections.map((sec) =>
            sec.id === sectionId
              ? { ...sec, parentId: newParentId, depth: parent.depth + 1, orderIndex: maxOrder + 1 }
              : sec
          ),
          updatedAt: new Date(),
        },
      };
    });
  },

  unnestSection: (sectionId) => {
    const { project } = get();
    const section = project.sections.find((s) => s.id === sectionId);
    if (!section || !section.parentId) return;

    const parent = project.sections.find((s) => s.id === section.parentId);
    if (!parent) return;

    get().pushUndo('unnest-section');
    set((s) => {
      // Move to grandparent level, insert after old parent in sibling order
      const grandparentId = parent.parentId;
      const grandparentChildren = s.project.sections
        .filter((sec) => sec.parentId === grandparentId)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      const parentIdx = grandparentChildren.findIndex((sec) => sec.id === parent.id);
      const insertOrder = parentIdx >= 0 ? grandparentChildren[parentIdx].orderIndex + 0.5 : 999;

      // Renumber grandparent siblings
      const updated = s.project.sections.map((sec) =>
        sec.id === sectionId
          ? { ...sec, parentId: grandparentId, depth: parent.depth, orderIndex: insertOrder }
          : sec
      );

      // Renumber siblings at grandparent level
      const siblings = updated
        .filter((sec) => sec.parentId === grandparentId)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      const siblingOrder = new Map(siblings.map((sec, i) => [sec.id, i]));

      return {
        project: {
          ...s.project,
          sections: updated.map((sec) => {
            const newOrder = siblingOrder.get(sec.id);
            return newOrder !== undefined && sec.parentId === grandparentId
              ? { ...sec, orderIndex: newOrder }
              : sec;
          }),
          updatedAt: new Date(),
        },
      };
    });
  },

  removeSection: (id) => {
    // Must keep at least one active section
    const activeSections = get().project.sections.filter(s => (s.status ?? 'active') === 'active');
    if (activeSections.length <= 1) return;
    get().pushUndo('remove-section');
    set((s) => {
      const childIds = new Set(s.project.sections.filter(sec => sec.parentId === id).map(sec => sec.id));
      return {
        project: {
          ...s.project,
          sections: s.project.sections.map((sec) =>
            sec.id === id || childIds.has(sec.id)
              ? { ...sec, status: 'removed' as const }
              : sec
          ),
          updatedAt: new Date(),
        },
      };
    });
  },

  restoreSection: (id) => {
    get().pushUndo('restore-section');
    set((s) => {
      const section = s.project.sections.find(sec => sec.id === id);
      if (!section) return s;

      // If restoring a child whose parent is not active, make it top-level
      const parent = section.parentId
        ? s.project.sections.find(sec => sec.id === section.parentId)
        : null;
      const parentIsActive = parent ? (parent.status ?? 'active') === 'active' : true;

      // Find a good orderIndex among active siblings
      const targetParentId = parentIsActive ? section.parentId : null;
      const activeSiblings = s.project.sections
        .filter(sec => sec.parentId === targetParentId && (sec.status ?? 'active') === 'active');
      const maxOrder = activeSiblings.length > 0
        ? Math.max(...activeSiblings.map(sec => sec.orderIndex))
        : -1;

      // Also restore children of this section
      const childIds = new Set(s.project.sections.filter(sec => sec.parentId === id).map(sec => sec.id));

      return {
        project: {
          ...s.project,
          sections: s.project.sections.map((sec) => {
            if (sec.id === id) {
              return {
                ...sec,
                status: 'active' as const,
                parentId: targetParentId,
                depth: targetParentId ? 1 : 0,
                orderIndex: maxOrder + 1,
              };
            }
            if (childIds.has(sec.id)) {
              return { ...sec, status: 'active' as const };
            }
            return sec;
          }),
          updatedAt: new Date(),
        },
      };
    });
  },

  emptyTrash: () => {
    const trashedIds = new Set(
      get().project.sections
        .filter(s => (s.status ?? 'active') === 'trashed')
        .map(s => s.id)
    );
    if (trashedIds.size === 0) return;
    get().pushUndo('empty-trash');
    set((s) => ({
      project: {
        ...s.project,
        sections: s.project.sections.filter(sec => !trashedIds.has(sec.id)),
        chunks: s.project.chunks.filter(c => !trashedIds.has(c.sectionId)),
        updatedAt: new Date(),
      },
    }));
  },

  // --- Selection with anchor-based range ---
  selectChunk: (id, mode) =>
    set((s) => {
      // Clear section selection when selecting chunks
      const baseClear = { selectedSectionIds: new Set<string>(), anchorSectionId: null };
      if (mode === 'replace') {
        return {
          selection: {
            ...s.selection,
            ...baseClear,
            selectedChunkIds: new Set([id]),
            anchorChunkId: id,
          },
        };
      }
      if (mode === 'toggle') {
        const newSet = new Set(s.selection.selectedChunkIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return {
          selection: {
            ...s.selection,
            ...baseClear,
            selectedChunkIds: newSet,
            anchorChunkId: id,
          },
        };
      }
      // mode === 'range'
      const anchor = s.selection.anchorChunkId;
      if (!anchor) {
        return {
          selection: { ...s.selection, ...baseClear, selectedChunkIds: new Set([id]), anchorChunkId: id },
        };
      }
      const ordered = getOrderedChunks(s.project.chunks, s.project.sections);
      const fromIdx = ordered.findIndex((c) => c.id === anchor);
      const toIdx = ordered.findIndex((c) => c.id === id);
      if (fromIdx === -1 || toIdx === -1) {
        return { selection: { ...s.selection, ...baseClear, selectedChunkIds: new Set([id]), anchorChunkId: id } };
      }
      const start = Math.min(fromIdx, toIdx);
      const end = Math.max(fromIdx, toIdx);
      const ids = ordered.slice(start, end + 1).map((c) => c.id);
      return {
        selection: { ...s.selection, ...baseClear, selectedChunkIds: new Set(ids) },
        // Keep anchorChunkId unchanged for extending ranges
      };
    }),

  selectAllInSection: (sectionId) =>
    set((s) => ({
      selection: {
        ...s.selection,
        selectedChunkIds: new Set(
          s.project.chunks.filter((c) => c.sectionId === sectionId && !c.isDeleted).map((c) => c.id)
        ),
      },
    })),

  selectAll: () =>
    set((s) => ({
      selection: {
        ...s.selection,
        selectedChunkIds: new Set(s.project.chunks.filter((c) => !c.isDeleted).map((c) => c.id)),
      },
    })),

  clearSelection: () =>
    set((s) => ({ selection: { ...s.selection, selectedChunkIds: new Set(), anchorChunkId: null } })),

  setFocusedPane: (pane) =>
    set((s) => ({ selection: { ...s.selection, focusedPaneId: pane } })),

  // --- Section selection ---
  selectSection: (id, mode) =>
    set((s) => {
      // Clear chunk selection when selecting sections
      const baseClear = { selectedChunkIds: new Set<string>(), anchorChunkId: null };
      if (mode === 'replace') {
        return {
          selection: {
            ...s.selection,
            ...baseClear,
            selectedSectionIds: new Set([id]),
            anchorSectionId: id,
          },
        };
      }
      if (mode === 'toggle') {
        const newSet = new Set(s.selection.selectedSectionIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return {
          selection: {
            ...s.selection,
            ...baseClear,
            selectedSectionIds: newSet,
            anchorSectionId: id,
          },
        };
      }
      // mode === 'range'
      const anchor = s.selection.anchorSectionId;
      if (!anchor) {
        return {
          selection: { ...s.selection, ...baseClear, selectedSectionIds: new Set([id]), anchorSectionId: id },
        };
      }
      const activeSections = s.project.sections.filter(sec => (sec.status ?? 'active') === 'active');
      const ordered = getFlatSectionOrder(activeSections);
      const fromIdx = ordered.findIndex((sec) => sec.id === anchor);
      const toIdx = ordered.findIndex((sec) => sec.id === id);
      if (fromIdx === -1 || toIdx === -1) {
        return { selection: { ...s.selection, ...baseClear, selectedSectionIds: new Set([id]), anchorSectionId: id } };
      }
      const start = Math.min(fromIdx, toIdx);
      const end = Math.max(fromIdx, toIdx);
      const ids = ordered.slice(start, end + 1).map((sec) => sec.id);
      return {
        selection: { ...s.selection, ...baseClear, selectedSectionIds: new Set(ids) },
      };
    }),

  clearSectionSelection: () =>
    set((s) => ({ selection: { ...s.selection, selectedSectionIds: new Set(), anchorSectionId: null } })),

  // --- Insertion point & take ---
  placeCursorAtInsertionPoint: (sectionId, orderIndex) =>
    set((s) => ({
      playback: {
        ...s.playback,
        currentChunkId: null,
        insertionPoint: { sectionId, orderIndex },
      },
    })),

  bumpChunksForInsertion: (sectionId, fromOrderIndex, offset) =>
    set((s) => ({
      project: {
        ...s.project,
        chunks: s.project.chunks.map((c) =>
          c.sectionId === sectionId && !c.isDeleted && c.orderIndex >= fromOrderIndex
            ? { ...c, orderIndex: c.orderIndex + offset }
            : c
        ),
        updatedAt: new Date(),
      },
    })),

  renumberSection: (sectionId) =>
    set((s) => {
      const sectionChunks = s.project.chunks
        .filter((c) => c.sectionId === sectionId && !c.isDeleted)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      const idToNewIndex = new Map(sectionChunks.map((c, i) => [c.id, i]));
      return {
        project: {
          ...s.project,
          chunks: s.project.chunks.map((c) => {
            const newIdx = idToNewIndex.get(c.id);
            return newIdx !== undefined ? { ...c, orderIndex: newIdx } : c;
          }),
          updatedAt: new Date(),
        },
      };
    }),

  setTakeChunkIds: (ids, originalSectionId, startOrderIndex) =>
    set({ take: { chunkIds: ids, originalPosition: { sectionId: originalSectionId, startOrderIndex }, moved: false } }),

  clearTake: () =>
    set({ take: { chunkIds: [], originalPosition: null, moved: false } }),

  moveTakeToPosition: (sectionId, orderIndex) => {
    const { take } = get();
    if (take.chunkIds.length === 0) return;
    get().pushUndo('move-take');
    set((s) => {
      // First remove take chunks from their current section order
      const takeIds = new Set(s.take.chunkIds);
      let chunks = s.project.chunks.map((c) => {
        if (takeIds.has(c.id)) return { ...c, sectionId, orderIndex: -1 };
        return c;
      });

      // Renumber the target section excluding take chunks, then insert take chunks at orderIndex
      const targetNonTake = chunks
        .filter((c) => c.sectionId === sectionId && !c.isDeleted && !takeIds.has(c.id))
        .sort((a, b) => a.orderIndex - b.orderIndex);

      // Clamp orderIndex
      const clampedIdx = Math.min(orderIndex, targetNonTake.length);

      // Build final ordering: before + take + after
      const before = targetNonTake.slice(0, clampedIdx);
      const after = targetNonTake.slice(clampedIdx);
      const takeChunks = chunks.filter((c) => takeIds.has(c.id) && !c.isDeleted);

      const finalOrder = [...before, ...takeChunks, ...after];
      const idToIdx = new Map(finalOrder.map((c, i) => [c.id, i]));

      chunks = chunks.map((c) => {
        const idx = idToIdx.get(c.id);
        return idx !== undefined ? { ...c, orderIndex: idx, sectionId } : c;
      });

      // Also renumber any section that lost chunks (the old section)
      // We'll do a full renumber pass for all sections that had take chunks
      const affectedSections = new Set<string>();
      for (const c of s.project.chunks) {
        if (takeIds.has(c.id)) affectedSections.add(c.sectionId);
      }
      affectedSections.add(sectionId);

      for (const secId of affectedSections) {
        const secChunks = chunks
          .filter((c) => c.sectionId === secId && !c.isDeleted)
          .sort((a, b) => a.orderIndex - b.orderIndex);
        const secMap = new Map(secChunks.map((c, i) => [c.id, i]));
        chunks = chunks.map((c) => {
          const ni = secMap.get(c.id);
          return ni !== undefined ? { ...c, orderIndex: ni } : c;
        });
      }

      return {
        project: { ...s.project, chunks, updatedAt: new Date() },
        take: { ...s.take, moved: true },
      };
    });
  },

  moveTakeBack: () => {
    const { take, project } = get();
    if (!take.originalPosition) return;
    // Check if original section still exists
    const sectionExists = project.sections.some((s) => s.id === take.originalPosition!.sectionId);
    if (!sectionExists) return;
    get().moveTakeToPosition(take.originalPosition.sectionId, take.originalPosition.startOrderIndex);
    set((s) => ({ take: { ...s.take, moved: false } }));
  },

  // --- Cursor placement ---
  placeCursorInChunk: (chunkId, fraction) => {
    const chunk = get().project.chunks.find((c) => c.id === chunkId);
    if (!chunk) return;
    const duration = chunk.endTime - chunk.startTime;
    set((s) => ({
      playback: {
        ...s.playback,
        currentChunkId: chunkId,
        cursorPositionInChunk: Math.max(0, Math.min(1, fraction)),
        cursorTime: chunk.startTime + duration * fraction,
        insertionPoint: {
          sectionId: chunk.sectionId,
          orderIndex: fraction < 0.5 ? chunk.orderIndex : chunk.orderIndex + 1,
        },
      },
    }));
  },

  setPlaying: (isPlaying) =>
    set((s) => ({ playback: { ...s.playback, isPlaying } })),

  setRecording: (isRecording) =>
    set((s) => ({
      playback: { ...s.playback, isRecording, ...(!isRecording ? { recordingHead: null } : {}) },
    })),

  setRecordingHead: (head) =>
    set((s) => ({ playback: { ...s.playback, recordingHead: head } })),

  setCurrentChunk: (id) =>
    set((s) => ({ playback: { ...s.playback, currentChunkId: id } })),

  setCursorTime: (time) =>
    set((s) => ({ playback: { ...s.playback, cursorTime: time } })),

  setCursorPositionInChunk: (pos) =>
    set((s) => ({ playback: { ...s.playback, cursorPositionInChunk: pos } })),

  setPaintingColor: (color) =>
    set((s) => ({ playback: { ...s.playback, paintingColor: color } })),

  paintChunk: (id, color) => {
    set((s) => ({
      project: {
        ...s.project,
        chunks: s.project.chunks.map((c) =>
          c.id === id ? { ...c, color } : c
        ),
        updatedAt: new Date(),
      },
    }));
  },

  // --- Navigation ---
  navigateChunk: (direction, extend = false) => {
    const { project, playback, selection } = get();
    const ordered = getOrderedChunks(project.chunks, project.sections);
    if (ordered.length === 0) return;

    const currentIdx = ordered.findIndex((c) => c.id === playback.currentChunkId);
    let nextIdx: number;
    if (direction === 'next') {
      nextIdx = currentIdx < ordered.length - 1 ? currentIdx + 1 : ordered.length - 1;
    } else {
      nextIdx = currentIdx > 0 ? currentIdx - 1 : 0;
    }
    const nextChunk = ordered[nextIdx];

    if (extend) {
      // Shift+arrow: extend selection range from anchor to nextChunk
      const anchor = selection.anchorChunkId ?? playback.currentChunkId ?? nextChunk.id;
      const anchorIdx = ordered.findIndex((c) => c.id === anchor);
      const start = Math.min(anchorIdx, nextIdx);
      const end = Math.max(anchorIdx, nextIdx);
      const ids = ordered.slice(start, end + 1).map((c) => c.id);
      set((s) => ({
        playback: {
          ...s.playback,
          currentChunkId: nextChunk.id,
          cursorTime: nextChunk.startTime,
          cursorPositionInChunk: 0,
        },
        selection: {
          ...s.selection,
          selectedChunkIds: new Set(ids),
          // Keep anchor unchanged
        },
      }));
    } else {
      set((s) => ({
        playback: {
          ...s.playback,
          currentChunkId: nextChunk.id,
          cursorTime: nextChunk.startTime,
          cursorPositionInChunk: 0,
        },
        selection: {
          ...s.selection,
          selectedChunkIds: new Set([nextChunk.id]),
          anchorChunkId: nextChunk.id,
        },
      }));
    }
  },

  navigateSection: (direction) => {
    const { project, playback } = get();
    const activeSections = project.sections.filter(s => (s.status ?? 'active') === 'active');
    const sections = getFlatSectionOrder(activeSections);
    const currentChunk = project.chunks.find((c) => c.id === playback.currentChunkId);
    const currentSectionIdx = currentChunk
      ? sections.findIndex((s) => s.id === currentChunk.sectionId)
      : 0;

    let nextSectionIdx: number;
    if (direction === 'next') {
      nextSectionIdx = Math.min(currentSectionIdx + 1, sections.length - 1);
    } else {
      nextSectionIdx = Math.max(currentSectionIdx - 1, 0);
    }

    const nextSection = sections[nextSectionIdx];
    const sectionChunks = getOrderedChunks(project.chunks, project.sections)
      .filter((c) => c.sectionId === nextSection.id);

    if (sectionChunks.length > 0) {
      const first = sectionChunks[0];
      set((s) => ({
        playback: {
          ...s.playback,
          currentChunkId: first.id,
          cursorTime: first.startTime,
          cursorPositionInChunk: 0,
        },
        selection: {
          ...s.selection,
          selectedChunkIds: new Set([first.id]),
          anchorChunkId: first.id,
        },
      }));
    }
  },

  navigateToStart: () => {
    const ordered = getOrderedChunks(get().project.chunks, get().project.sections);
    if (ordered.length > 0) {
      const first = ordered[0];
      set((s) => ({
        playback: { ...s.playback, currentChunkId: first.id, cursorTime: first.startTime, cursorPositionInChunk: 0 },
        selection: { ...s.selection, selectedChunkIds: new Set([first.id]), anchorChunkId: first.id },
      }));
    }
  },

  navigateToEnd: () => {
    const ordered = getOrderedChunks(get().project.chunks, get().project.sections);
    if (ordered.length > 0) {
      const last = ordered[ordered.length - 1];
      set((s) => ({
        playback: { ...s.playback, currentChunkId: last.id, cursorTime: last.endTime, cursorPositionInChunk: 1 },
        selection: { ...s.selection, selectedChunkIds: new Set([last.id]), anchorChunkId: last.id },
      }));
    }
  },

  navigateToSectionStart: () => {
    const { project, playback } = get();
    const currentChunk = project.chunks.find(c => c.id === playback.currentChunkId);
    if (!currentChunk) return;
    const sectionChunks = getOrderedChunks(project.chunks, project.sections)
      .filter(c => c.sectionId === currentChunk.sectionId);
    if (sectionChunks.length > 0) {
      const first = sectionChunks[0];
      set((s) => ({
        playback: { ...s.playback, currentChunkId: first.id, cursorTime: first.startTime, cursorPositionInChunk: 0 },
        selection: { ...s.selection, selectedChunkIds: new Set([first.id]), anchorChunkId: first.id },
      }));
    }
  },

  navigateToSectionEnd: () => {
    const { project, playback } = get();
    const currentChunk = project.chunks.find(c => c.id === playback.currentChunkId);
    if (!currentChunk) return;
    const sectionChunks = getOrderedChunks(project.chunks, project.sections)
      .filter(c => c.sectionId === currentChunk.sectionId);
    if (sectionChunks.length > 0) {
      const last = sectionChunks[sectionChunks.length - 1];
      set((s) => ({
        playback: { ...s.playback, currentChunkId: last.id, cursorTime: last.endTime, cursorPositionInChunk: 1 },
        selection: { ...s.selection, selectedChunkIds: new Set([last.id]), anchorChunkId: last.id },
      }));
    }
  },

  // --- Intra-chunk cursor scrub ---
  scrubCursor: (delta) => {
    const { playback } = get();
    if (!playback.currentChunkId) return;
    const newPos = Math.max(0, Math.min(1, playback.cursorPositionInChunk + delta));
    get().placeCursorInChunk(playback.currentChunkId, newPos);
  },

  // --- Nudge / reorder ---
  nudgeChunks: (ids, direction) => {
    if (ids.length === 0) return;
    const { project } = get();
    const selectedSet = new Set(ids);

    // Group by section
    const bySectionMap = new Map<string, Chunk[]>();
    for (const chunk of project.chunks) {
      if (!chunk.isDeleted) {
        const arr = bySectionMap.get(chunk.sectionId) ?? [];
        arr.push(chunk);
        bySectionMap.set(chunk.sectionId, arr);
      }
    }

    get().pushUndo('move');

    const updatedChunks = [...project.chunks];
    for (const [sectionId, sectionChunks] of bySectionMap) {
      const sorted = sectionChunks.sort((a, b) => a.orderIndex - b.orderIndex);
      const selectedInSection = sorted.filter(c => selectedSet.has(c.id));
      if (selectedInSection.length === 0) continue;

      const indices = selectedInSection.map(c => sorted.indexOf(c));
      if (direction === -1 && indices[0] === 0) continue;
      if (direction === 1 && indices[indices.length - 1] === sorted.length - 1) continue;

      // Swap the block with the adjacent element
      if (direction === -1) {
        const swapIdx = indices[0] - 1;
        const swapChunk = sorted[swapIdx];
        // Move swap chunk after the selected block
        const newOrder = sorted.filter((_, i) => i !== swapIdx);
        newOrder.splice(indices[0] - 1 + selectedInSection.length, 0, swapChunk);
        newOrder.forEach((c, i) => {
          const idx = updatedChunks.findIndex(uc => uc.id === c.id);
          if (idx !== -1) updatedChunks[idx] = { ...updatedChunks[idx], orderIndex: i };
        });
      } else {
        const swapIdx = indices[indices.length - 1] + 1;
        const swapChunk = sorted[swapIdx];
        // Move swap chunk before the selected block
        const newOrder = sorted.filter((_, i) => i !== swapIdx);
        newOrder.splice(indices[0], 0, swapChunk);
        newOrder.forEach((c, i) => {
          const idx = updatedChunks.findIndex(uc => uc.id === c.id);
          if (idx !== -1) updatedChunks[idx] = { ...updatedChunks[idx], orderIndex: i };
        });
      }
    }

    set((s) => ({
      project: { ...s.project, chunks: updatedChunks, updatedAt: new Date() },
    }));
  },

  nudgeChunksToEdge: (ids, edge) => {
    if (ids.length === 0) return;
    const { project } = get();
    const selectedSet = new Set(ids);

    get().pushUndo('move');

    const updatedChunks = [...project.chunks];
    // Group chunks by section
    const bySectionMap = new Map<string, Chunk[]>();
    for (const chunk of project.chunks) {
      if (!chunk.isDeleted) {
        const arr = bySectionMap.get(chunk.sectionId) ?? [];
        arr.push(chunk);
        bySectionMap.set(chunk.sectionId, arr);
      }
    }

    for (const [_sectionId, sectionChunks] of bySectionMap) {
      const sorted = sectionChunks.sort((a, b) => a.orderIndex - b.orderIndex);
      const selected = sorted.filter(c => selectedSet.has(c.id));
      const unselected = sorted.filter(c => !selectedSet.has(c.id));
      if (selected.length === 0) continue;

      const newOrder = edge === 'start'
        ? [...selected, ...unselected]
        : [...unselected, ...selected];

      newOrder.forEach((c, i) => {
        const idx = updatedChunks.findIndex(uc => uc.id === c.id);
        if (idx !== -1) updatedChunks[idx] = { ...updatedChunks[idx], orderIndex: i };
      });
    }

    set((s) => ({
      project: { ...s.project, chunks: updatedChunks, updatedAt: new Date() },
    }));
  },

  moveChunksToSection: (ids, direction) => {
    if (ids.length === 0) return;
    const { project } = get();
    const selectedSet = new Set(ids);
    const activeSections = project.sections.filter(s => (s.status ?? 'active') === 'active');
    const flatSections = getFlatSectionOrder(activeSections);

    // Find which section the selected chunks are in (use first selected)
    const firstSelected = project.chunks.find(c => selectedSet.has(c.id));
    if (!firstSelected) return;
    const currentSectionIdx = flatSections.findIndex(s => s.id === firstSelected.sectionId);
    if (currentSectionIdx === -1) return;

    const targetIdx = direction === 'prev' ? currentSectionIdx - 1 : currentSectionIdx + 1;
    if (targetIdx < 0 || targetIdx >= flatSections.length) return;
    const targetSection = flatSections[targetIdx];

    get().pushUndo('move');

    // Get existing chunks in target section to find max orderIndex
    const targetChunks = project.chunks.filter(
      c => c.sectionId === targetSection.id && !c.isDeleted
    );
    const maxOrder = targetChunks.length > 0
      ? Math.max(...targetChunks.map(c => c.orderIndex))
      : -1;

    // Move selected chunks to target section
    let nextOrder = maxOrder + 1;
    const updatedChunks = project.chunks.map(c => {
      if (selectedSet.has(c.id)) {
        return { ...c, sectionId: targetSection.id, orderIndex: nextOrder++ };
      }
      return c;
    });

    // Renumber source section
    const sourceId = firstSelected.sectionId;
    const sourceRemaining = updatedChunks
      .filter(c => c.sectionId === sourceId && !c.isDeleted && !selectedSet.has(c.id))
      .sort((a, b) => a.orderIndex - b.orderIndex);
    sourceRemaining.forEach((c, i) => {
      const idx = updatedChunks.findIndex(uc => uc.id === c.id);
      if (idx !== -1) updatedChunks[idx] = { ...updatedChunks[idx], orderIndex: i };
    });

    set((s) => ({
      project: { ...s.project, chunks: updatedChunks, updatedAt: new Date() },
    }));
  },

  // --- Duplicate ---
  duplicateChunks: (ids) => {
    if (ids.length === 0) return;
    const { project } = get();

    get().pushUndo('move');

    const toDuplicate = project.chunks.filter(c => ids.includes(c.id) && !c.isDeleted);
    if (toDuplicate.length === 0) return;

    // Group by section, clone after the originals
    const newChunks: Chunk[] = [];
    const updatedChunks = [...project.chunks];

    // For each section, find selected chunks and insert clones after them
    const bySectionMap = new Map<string, Chunk[]>();
    for (const c of toDuplicate) {
      const arr = bySectionMap.get(c.sectionId) ?? [];
      arr.push(c);
      bySectionMap.set(c.sectionId, arr);
    }

    for (const [sectionId, selected] of bySectionMap) {
      const sorted = selected.sort((a, b) => a.orderIndex - b.orderIndex);
      const maxOrderInSelected = sorted[sorted.length - 1].orderIndex;

      // Bump all chunks after the selected block
      for (let i = 0; i < updatedChunks.length; i++) {
        const c = updatedChunks[i];
        if (c.sectionId === sectionId && !c.isDeleted && c.orderIndex > maxOrderInSelected) {
          updatedChunks[i] = { ...c, orderIndex: c.orderIndex + sorted.length };
        }
      }

      // Create clones right after the originals
      sorted.forEach((orig, i) => {
        newChunks.push({
          ...orig,
          id: uuid(),
          orderIndex: maxOrderInSelected + 1 + i,
          waveformData: null,
        });
      });
    }

    set((s) => ({
      project: {
        ...s.project,
        chunks: [...updatedChunks, ...newChunks],
        updatedAt: new Date(),
      },
      selection: {
        ...s.selection,
        selectedChunkIds: new Set(newChunks.map(c => c.id)),
        anchorChunkId: newChunks[0]?.id ?? null,
      },
    }));
  },

  // --- Invert selection ---
  invertSelection: () => {
    const { project, playback, selection } = get();
    const currentChunk = project.chunks.find(c => c.id === playback.currentChunkId);
    if (!currentChunk) return;

    const sectionChunks = project.chunks.filter(
      c => c.sectionId === currentChunk.sectionId && !c.isDeleted
    );
    const newSelected = new Set<string>();
    for (const c of sectionChunks) {
      if (!selection.selectedChunkIds.has(c.id)) {
        newSelected.add(c.id);
      }
    }
    set((s) => ({
      selection: { ...s.selection, selectedChunkIds: newSelected, anchorChunkId: null },
    }));
  },

  // ── Phase 5: Transcription actions ──────────────────────────────────────────

  setTranscriptionWords: (words) =>
    set((s) => ({
      project: {
        ...s.project,
        transcription: { ...s.project.transcription, words },
        updatedAt: new Date(),
      },
    })),

  addTranscriptionWords: (words) =>
    set((s) => ({
      project: {
        ...s.project,
        transcription: {
          ...s.project.transcription,
          words: [...s.project.transcription.words, ...words],
        },
        updatedAt: new Date(),
      },
    })),

  updateWord: (wordId, updates) =>
    set((s) => ({
      project: {
        ...s.project,
        transcription: {
          ...s.project.transcription,
          words: s.project.transcription.words.map(w =>
            w.id === wordId ? { ...w, ...updates } : w
          ),
        },
        updatedAt: new Date(),
      },
    })),

  deleteWords: (wordIds) => {
    const idSet = new Set(wordIds);
    set((s) => ({
      project: {
        ...s.project,
        transcription: {
          ...s.project.transcription,
          words: s.project.transcription.words.filter(w => !idSet.has(w.id)),
          wordChunkMappings: s.project.transcription.wordChunkMappings.filter(m => !idSet.has(m.wordId)),
        },
        updatedAt: new Date(),
      },
    }));
  },

  setWordChunkMappings: (mappings) =>
    set((s) => ({
      project: {
        ...s.project,
        transcription: { ...s.project.transcription, wordChunkMappings: mappings },
        updatedAt: new Date(),
      },
    })),

  addWordChunkMappings: (mappings) =>
    set((s) => ({
      project: {
        ...s.project,
        transcription: {
          ...s.project.transcription,
          wordChunkMappings: [...s.project.transcription.wordChunkMappings, ...mappings],
        },
        updatedAt: new Date(),
      },
    })),

  addSpeaker: (speaker) =>
    set((s) => ({
      project: {
        ...s.project,
        transcription: {
          ...s.project.transcription,
          speakers: [...s.project.transcription.speakers, speaker],
        },
        updatedAt: new Date(),
      },
    })),

  updateSpeaker: (id, updates) =>
    set((s) => ({
      project: {
        ...s.project,
        transcription: {
          ...s.project.transcription,
          speakers: s.project.transcription.speakers.map(sp =>
            sp.id === id ? { ...sp, ...updates } : sp
          ),
        },
        updatedAt: new Date(),
      },
    })),

  startTranscriptionJob: (job) =>
    set((s) => ({
      project: {
        ...s.project,
        transcription: {
          ...s.project.transcription,
          jobs: [...s.project.transcription.jobs, job],
        },
        updatedAt: new Date(),
      },
    })),

  updateJobStatus: (jobId, status, updates) =>
    set((s) => ({
      project: {
        ...s.project,
        transcription: {
          ...s.project.transcription,
          jobs: s.project.transcription.jobs.map(j =>
            j.id === jobId ? { ...j, status, ...updates } : j
          ),
        },
        updatedAt: new Date(),
      },
    })),

  cancelJob: (jobId) =>
    set((s) => ({
      project: {
        ...s.project,
        transcription: {
          ...s.project.transcription,
          jobs: s.project.transcription.jobs.map(j =>
            j.id === jobId ? { ...j, status: 'cancelled' as const, completedAt: Date.now() } : j
          ),
        },
        updatedAt: new Date(),
      },
    })),

  updateTranscriptionSettings: (updates) =>
    set((s) => ({
      project: {
        ...s.project,
        transcription: {
          ...s.project.transcription,
          settings: { ...s.project.transcription.settings, ...updates },
        },
        updatedAt: new Date(),
      },
    })),

  updateEditingConfig: (updates) =>
    set((s) => ({
      project: {
        ...s.project,
        transcription: {
          ...s.project.transcription,
          editingConfig: { ...s.project.transcription.editingConfig, ...updates },
        },
        updatedAt: new Date(),
      },
    })),

  setClarifications: (queries) =>
    set((s) => ({
      project: {
        ...s.project,
        transcription: { ...s.project.transcription, clarifications: queries },
        updatedAt: new Date(),
      },
    })),

  resolveClarification: (queryId, resolvedText) =>
    set((s) => ({
      project: {
        ...s.project,
        transcription: {
          ...s.project.transcription,
          clarifications: s.project.transcription.clarifications.map(q =>
            q.id === queryId ? { ...q, resolved: true, resolvedText } : q
          ),
        },
        updatedAt: new Date(),
      },
    })),

  dismissClarification: (queryId) =>
    set((s) => ({
      project: {
        ...s.project,
        transcription: {
          ...s.project.transcription,
          clarifications: s.project.transcription.clarifications.filter(q => q.id !== queryId),
        },
        updatedAt: new Date(),
      },
    })),

  setTextViewMode: (mode) =>
    set((s) => ({
      project: {
        ...s.project,
        transcription: { ...s.project.transcription, viewMode: mode },
      },
    })),

  setHighlightGranularity: (granularities) =>
    set((s) => ({
      project: {
        ...s.project,
        transcription: { ...s.project.transcription, highlightGranularities: granularities },
      },
    })),

  markChunksStale: (chunkIds) =>
    set((s) => {
      const existing = new Set(s.project.transcription.staleChunkIds);
      chunkIds.forEach(id => existing.add(id));
      return {
        project: {
          ...s.project,
          transcription: { ...s.project.transcription, staleChunkIds: Array.from(existing) },
        },
      };
    }),

  clearStaleChunks: (chunkIds) =>
    set((s) => {
      const toRemove = new Set(chunkIds);
      return {
        project: {
          ...s.project,
          transcription: {
            ...s.project.transcription,
            staleChunkIds: s.project.transcription.staleChunkIds.filter(id => !toRemove.has(id)),
          },
        },
      };
    }),

  pushUndo: (type, clipboardSnapshot?) =>
    set((s) => {
      const isConfigAction = type === 'apply-configuration' || type === 'switch-version' || type === 'switch-configuration';
      return {
        project: {
          ...s.project,
          undoStack: [
            ...s.project.undoStack.slice(-199),
            {
              type,
              timestamp: Date.now(),
              previousState: {
                chunks: JSON.parse(JSON.stringify(s.project.chunks)),
                sections: JSON.parse(JSON.stringify(s.project.sections)),
                ...(clipboardSnapshot ? { clipboardItems: clipboardSnapshot } : {}),
                ...(isConfigAction ? { sectionConfigs: JSON.parse(JSON.stringify(s.project.sectionConfigs)) } : {}),
              },
            },
          ],
          redoStack: [],
        },
      };
    }),

  undo: () => {
    const undoState = get();
    const stack = undoState.project.undoStack;
    if (stack.length === 0) return;
    const action = stack[stack.length - 1];

    // If this action has a clipboard snapshot, capture current clipboard for redo and restore
    let currentClipboardSnapshot: import('../types/clipboard').ClipboardItem[] | undefined;
    if (action.previousState.clipboardItems) {
      currentClipboardSnapshot = useClipboardStore.getState().snapshotItems();
      useClipboardStore.getState().restoreItems(action.previousState.clipboardItems);
    }

    set((s) => ({
      project: {
        ...s.project,
        chunks: action.previousState.chunks,
        sections: action.previousState.sections,
        ...(action.previousState.sectionConfigs ? { sectionConfigs: action.previousState.sectionConfigs } : {}),
        undoStack: stack.slice(0, -1),
        redoStack: [
          ...s.project.redoStack,
          {
            type: action.type,
            timestamp: Date.now(),
            previousState: {
              chunks: JSON.parse(JSON.stringify(s.project.chunks)),
              sections: JSON.parse(JSON.stringify(s.project.sections)),
              ...(currentClipboardSnapshot ? { clipboardItems: currentClipboardSnapshot } : {}),
              ...(action.previousState.sectionConfigs ? { sectionConfigs: JSON.parse(JSON.stringify(s.project.sectionConfigs)) } : {}),
            },
          },
        ],
        updatedAt: new Date(),
      },
      take: { chunkIds: [], originalPosition: null, moved: false },
    }));
  },

  redo: () => {
    const redoState = get();
    const stack = redoState.project.redoStack;
    if (stack.length === 0) return;
    const action = stack[stack.length - 1];

    // If this action has a clipboard snapshot, capture current clipboard for undo and restore
    let currentClipboardSnapshot: import('../types/clipboard').ClipboardItem[] | undefined;
    if (action.previousState.clipboardItems) {
      currentClipboardSnapshot = useClipboardStore.getState().snapshotItems();
      useClipboardStore.getState().restoreItems(action.previousState.clipboardItems);
    }

    set((s) => ({
      project: {
        ...s.project,
        chunks: action.previousState.chunks,
        sections: action.previousState.sections,
        ...(action.previousState.sectionConfigs ? { sectionConfigs: action.previousState.sectionConfigs } : {}),
        redoStack: stack.slice(0, -1),
        undoStack: [
          ...s.project.undoStack,
          {
            type: action.type,
            timestamp: Date.now(),
            previousState: {
              chunks: JSON.parse(JSON.stringify(s.project.chunks)),
              sections: JSON.parse(JSON.stringify(s.project.sections)),
              ...(currentClipboardSnapshot ? { clipboardItems: currentClipboardSnapshot } : {}),
              ...(action.previousState.sectionConfigs ? { sectionConfigs: JSON.parse(JSON.stringify(s.project.sectionConfigs)) } : {}),
            },
          },
        ],
        updatedAt: new Date(),
      },
      take: { chunkIds: [], originalPosition: null, moved: false },
    }));
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 2: Rich Styling
  // ═══════════════════════════════════════════════════════════════════════════

  styleChunks: (ids, style) => {
    get().pushUndo('restyle');
    set((s) => ({
      project: {
        ...s.project,
        chunks: s.project.chunks.map((c) =>
          ids.includes(c.id) ? { ...c, style, color: style.color } : c
        ),
        updatedAt: new Date(),
      },
    }));
  },

  setSectionStyle: (sectionId, style) => {
    get().pushUndo('section-style');
    set((s) => ({
      project: {
        ...s.project,
        sections: s.project.sections.map((sec) =>
          sec.id === sectionId ? { ...sec, backgroundStyle: style } : sec
        ),
        updatedAt: new Date(),
      },
    }));
  },

  setSectionStyles: (sectionIds, style) => {
    get().pushUndo('section-style');
    const idSet = new Set(sectionIds);
    set((s) => ({
      project: {
        ...s.project,
        sections: s.project.sections.map((sec) =>
          idSet.has(sec.id) ? { ...sec, backgroundStyle: style } : sec
        ),
        updatedAt: new Date(),
      },
    }));
  },

  addRecentColor: (hex) => {
    set((s) => {
      const recents = s.project.settings.recentColors.filter((r) => r.hex !== hex);
      recents.unshift({ hex, usedAt: Date.now() });
      if (recents.length > 20) recents.length = 20;
      return {
        project: {
          ...s.project,
          settings: { ...s.project.settings, recentColors: recents },
        },
      };
    });
  },

  toggleFavoriteColor: (hex) => {
    set((s) => {
      const favs = s.project.settings.favoriteColors;
      const exists = favs.some((f) => f.hex === hex);
      return {
        project: {
          ...s.project,
          settings: {
            ...s.project.settings,
            favoriteColors: exists
              ? favs.filter((f) => f.hex !== hex)
              : [...favs, { hex }],
          },
        },
      };
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 2: Filter
  // ═══════════════════════════════════════════════════════════════════════════

  setFilter: (criteria) => {
    set((s) => ({
      project: {
        ...s.project,
        settings: {
          ...s.project.settings,
          filter: { active: criteria.length > 0, criteria },
        },
      },
    }));
  },

  clearFilter: () => {
    set((s) => ({
      project: {
        ...s.project,
        settings: {
          ...s.project.settings,
          filter: { active: false, criteria: [] },
        },
      },
    }));
  },

  toggleFilterCriterion: (criterion) => {
    set((s) => {
      const existing = s.project.settings.filter.criteria;
      const idx = existing.findIndex((c) =>
        c.type === criterion.type &&
        c.colorHex === criterion.colorHex &&
        c.textureId === criterion.textureId &&
        c.formId === criterion.formId &&
        c.tag === criterion.tag
      );
      const newCriteria = idx >= 0
        ? existing.filter((_, i) => i !== idx)
        : [...existing, criterion];
      return {
        project: {
          ...s.project,
          settings: {
            ...s.project.settings,
            filter: { active: newCriteria.length > 0, criteria: newCriteria },
          },
        },
      };
    });
  },

  getFilteredChunkIds: () => {
    const state = get();
    const { filter } = state.project.settings;
    if (!filter.active || filter.criteria.length === 0) return new Set<string>();

    const matching = new Set<string>();
    for (const chunk of state.project.chunks) {
      if (chunk.isDeleted) continue;
      for (const crit of filter.criteria) {
        if (crit.type === 'color' && crit.colorHex) {
          const chunkColor = chunk.style?.color ?? chunk.color;
          if (chunkColor === crit.colorHex) { matching.add(chunk.id); break; }
        }
        if (crit.type === 'texture' && crit.textureId) {
          if (chunk.style?.texture?.builtinId === crit.textureId) { matching.add(chunk.id); break; }
        }
        if (crit.type === 'form' && crit.formId) {
          if (chunk.formId === crit.formId) { matching.add(chunk.id); break; }
        }
        if (crit.type === 'tag' && crit.tag) {
          if ((chunk.tags ?? []).includes(crit.tag)) { matching.add(chunk.id); break; }
        }
      }
    }
    return matching;
  },

  extractFilteredChunks: (targetSectionName) => {
    const state = get();
    const matchingIds = state.getFilteredChunkIds();
    if (matchingIds.size === 0) return;

    state.pushUndo('filter-extract');
    const newSection = state.addSection(targetSectionName);

    set((s) => {
      let orderIdx = 0;
      const updatedChunks = s.project.chunks.map((c) => {
        if (matchingIds.has(c.id)) {
          return { ...c, sectionId: newSection.id, orderIndex: orderIdx++ };
        }
        return c;
      });

      // Renumber source sections
      const affectedSections = new Set(
        s.project.chunks.filter((c) => matchingIds.has(c.id)).map((c) => c.sectionId)
      );
      for (const secId of affectedSections) {
        let idx = 0;
        updatedChunks
          .filter((c) => c.sectionId === secId && !c.isDeleted)
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .forEach((c) => {
            const target = updatedChunks.find((u) => u.id === c.id);
            if (target) target.orderIndex = idx++;
          });
      }

      return {
        project: { ...s.project, chunks: updatedChunks, updatedAt: new Date() },
      };
    });
  },

  copyFilteredChunks: (targetSectionName) => {
    const state = get();
    const matchingIds = state.getFilteredChunkIds();
    if (matchingIds.size === 0) return;

    state.pushUndo('filter-copy');
    const newSection = state.addSection(targetSectionName);

    set((s) => {
      let orderIdx = 0;
      const copies: Chunk[] = [];
      for (const chunk of s.project.chunks) {
        if (matchingIds.has(chunk.id)) {
          copies.push({
            ...chunk,
            id: uuid(),
            sectionId: newSection.id,
            orderIndex: orderIdx++,
            waveformData: null,
          });
        }
      }
      return {
        project: {
          ...s.project,
          chunks: [...s.project.chunks, ...copies],
          updatedAt: new Date(),
        },
      };
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 2: SFX
  // ═══════════════════════════════════════════════════════════════════════════

  setSfxMappings: (mappings) => {
    set((s) => ({
      project: {
        ...s.project,
        settings: { ...s.project.settings, sfxMappings: mappings },
      },
    }));
  },

  addSfxMapping: (mapping) => {
    set((s) => ({
      project: {
        ...s.project,
        settings: {
          ...s.project.settings,
          sfxMappings: [...s.project.settings.sfxMappings, mapping],
        },
      },
    }));
  },

  removeSfxMapping: (id) => {
    set((s) => ({
      project: {
        ...s.project,
        settings: {
          ...s.project.settings,
          sfxMappings: s.project.settings.sfxMappings.filter((m) => m.id !== id),
        },
      },
    }));
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 2: TTS
  // ═══════════════════════════════════════════════════════════════════════════

  setTtsConfig: (partial) => {
    set((s) => ({
      project: {
        ...s.project,
        settings: {
          ...s.project.settings,
          ttsConfig: migrateTtsConfig({ ...s.project.settings.ttsConfig, ...partial }),
        },
      },
    }));
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 2: Templates
  // ═══════════════════════════════════════════════════════════════════════════

  createTemplate: (name) => {
    const state = get();
    const template: ColorKeyTemplate = {
      id: uuid(),
      name,
      builtIn: false,
      colorKey: JSON.parse(JSON.stringify(state.project.colorKey.colors)),
      styles: {},
      sfxMappings: JSON.parse(JSON.stringify(state.project.settings.sfxMappings)),
    };
    // Capture styles from color key entries
    for (const entry of state.project.colorKey.colors) {
      if (entry.style) {
        template.styles[entry.hex] = JSON.parse(JSON.stringify(entry.style));
      }
    }
    set((s) => ({
      project: {
        ...s.project,
        templates: [...s.project.templates, template],
      },
    }));
  },

  updateTemplate: (id, updates) => {
    set((s) => ({
      project: {
        ...s.project,
        templates: s.project.templates.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        ),
      },
    }));
  },

  deleteTemplate: (id) => {
    set((s) => ({
      project: {
        ...s.project,
        templates: s.project.templates.filter((t) => t.id !== id),
      },
    }));
  },

  duplicateTemplate: (id) => {
    const state = get();
    const orig = state.project.templates.find((t) => t.id === id);
    if (!orig) return;
    const dup: ColorKeyTemplate = {
      ...JSON.parse(JSON.stringify(orig)),
      id: uuid(),
      name: `${orig.name} (Copy)`,
      builtIn: false,
    };
    set((s) => ({
      project: {
        ...s.project,
        templates: [...s.project.templates, dup],
      },
    }));
  },

  applyTemplate: (id, mode = 'both') => {
    const state = get();
    const template = state.project.templates.find((t) => t.id === id)
      || BUILTIN_TEMPLATES.find((t) => t.id === id);
    if (!template) return;
    set((s) => ({
      project: {
        ...s.project,
        ...(mode !== 'sounds' && {
          colorKey: {
            ...s.project.colorKey,
            colors: JSON.parse(JSON.stringify(template.colorKey)),
          },
        }),
        settings: {
          ...s.project.settings,
          ...(mode !== 'colors' && {
            sfxMappings: JSON.parse(JSON.stringify(template.sfxMappings)),
          }),
        },
      },
    }));
  },

  exportTemplate: (id) => {
    const template = get().project.templates.find((t) => t.id === id)
      || BUILTIN_TEMPLATES.find((t) => t.id === id);
    if (!template) return '{}';
    return JSON.stringify(template, null, 2);
  },

  importTemplate: (json) => {
    try {
      const parsed = JSON.parse(json) as ColorKeyTemplate;
      if (!parsed.name || !parsed.colorKey) throw new Error('Invalid template');
      const template: ColorKeyTemplate = {
        ...parsed,
        id: uuid(),
        builtIn: false,
      };
      set((s) => ({
        project: {
          ...s.project,
          templates: [...s.project.templates, template],
        },
      }));
    } catch (err) {
      console.error('Failed to import template:', err);
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 2: Color Key Management
  // ═══════════════════════════════════════════════════════════════════════════

  updateColorKeyEntry: (index, updates) => {
    set((s) => {
      const colors = [...s.project.colorKey.colors];
      if (index >= 0 && index < colors.length) {
        colors[index] = { ...colors[index], ...updates };
      }
      return {
        project: {
          ...s.project,
          colorKey: { ...s.project.colorKey, colors },
        },
      };
    });
  },

  addColorKeyEntry: (entry) => {
    set((s) => ({
      project: {
        ...s.project,
        colorKey: {
          ...s.project.colorKey,
          colors: [...s.project.colorKey.colors, entry],
        },
      },
    }));
  },

  removeColorKeyEntry: (index) => {
    set((s) => ({
      project: {
        ...s.project,
        colorKey: {
          ...s.project.colorKey,
          colors: s.project.colorKey.colors.filter((_, i) => i !== index),
        },
      },
    }));
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 3: Forms & Schemes
  // ═══════════════════════════════════════════════════════════════════════════

  applyForm: (ids, formId) => {
    get().pushUndo('apply-form');
    const form = get().project.scheme.forms.find((f) => f.id === formId);
    set((s) => ({
      project: {
        ...s.project,
        chunks: s.project.chunks.map((c) =>
          ids.includes(c.id)
            ? {
                ...c,
                formId,
                // Also sync legacy color for backward compat
                color: form?.color?.hex ?? c.color,
                style: form?.color
                  ? {
                      color: form.color.hex,
                      alpha: form.color.alpha,
                      texture: form.texture?.textureRef ?? c.style?.texture ?? null,
                      gradient: form.color.gradient ?? null,
                    }
                  : c.style,
              }
            : c
        ),
        updatedAt: new Date(),
      },
    }));
  },

  clearForm: (ids) => {
    get().pushUndo('apply-form');
    set((s) => ({
      project: {
        ...s.project,
        chunks: s.project.chunks.map((c) =>
          ids.includes(c.id)
            ? { ...c, formId: null, color: null, style: null }
            : c
        ),
        updatedAt: new Date(),
      },
    }));
  },

  paintForm: (id, formId) => {
    const form = get().project.scheme.forms.find((f) => f.id === formId);
    set((s) => ({
      project: {
        ...s.project,
        chunks: s.project.chunks.map((c) =>
          c.id === id
            ? {
                ...c,
                formId,
                color: form?.color?.hex ?? c.color,
              }
            : c
        ),
      },
    }));
  },

  setActiveScheme: (schemeId) => {
    const state = get();
    const scheme =
      state.project.schemes.find((s) => s.id === schemeId) ??
      ALL_BUILTIN_SCHEMES.find((s) => s.id === schemeId);
    if (!scheme) return;

    get().pushUndo('change-scheme');
    set((s) => ({
      project: {
        ...s.project,
        scheme,
        // Add to list if not already there
        schemes: s.project.schemes.some((sc) => sc.id === scheme.id)
          ? s.project.schemes
          : [...s.project.schemes, scheme],
        updatedAt: new Date(),
      },
    }));
  },

  createScheme: (name) => {
    const newScheme: Scheme = {
      id: uuid(),
      name,
      builtIn: false,
      forms: [],
    };
    set((s) => ({
      project: {
        ...s.project,
        schemes: [...s.project.schemes, newScheme],
      },
    }));
    return newScheme;
  },

  updateScheme: (id, updates) => {
    set((s) => ({
      project: {
        ...s.project,
        schemes: s.project.schemes.map((sc) =>
          sc.id === id ? { ...sc, ...updates } : sc
        ),
        // Also update active scheme if it's the one being edited
        scheme: s.project.scheme.id === id
          ? { ...s.project.scheme, ...updates }
          : s.project.scheme,
        updatedAt: new Date(),
      },
    }));
  },

  deleteScheme: (id) => {
    const state = get();
    if (state.project.scheme.id === id) return; // Can't delete active scheme
    set((s) => ({
      project: {
        ...s.project,
        schemes: s.project.schemes.filter((sc) => sc.id !== id),
      },
    }));
  },

  duplicateScheme: (id) => {
    const state = get();
    const source =
      state.project.schemes.find((s) => s.id === id) ??
      ALL_BUILTIN_SCHEMES.find((s) => s.id === id);
    if (!source) return;

    const copy: Scheme = {
      ...JSON.parse(JSON.stringify(source)),
      id: uuid(),
      name: `${source.name} (Copy)`,
      builtIn: false,
    };
    set((s) => ({
      project: {
        ...s.project,
        schemes: [...s.project.schemes, copy],
      },
    }));
  },

  addFormToScheme: (schemeId, form) => {
    get().pushUndo('update-form');
    set((s) => ({
      project: {
        ...s.project,
        schemes: s.project.schemes.map((sc) =>
          sc.id === schemeId ? { ...sc, forms: [...sc.forms, form] } : sc
        ),
        scheme: s.project.scheme.id === schemeId
          ? { ...s.project.scheme, forms: [...s.project.scheme.forms, form] }
          : s.project.scheme,
        updatedAt: new Date(),
      },
    }));
  },

  updateFormInScheme: (schemeId, formId, updates) => {
    get().pushUndo('update-form');
    const updateForms = (forms: Form[]) =>
      forms.map((f) => (f.id === formId ? { ...f, ...updates } : f));
    set((s) => ({
      project: {
        ...s.project,
        schemes: s.project.schemes.map((sc) =>
          sc.id === schemeId ? { ...sc, forms: updateForms(sc.forms) } : sc
        ),
        scheme: s.project.scheme.id === schemeId
          ? { ...s.project.scheme, forms: updateForms(s.project.scheme.forms) }
          : s.project.scheme,
        updatedAt: new Date(),
      },
    }));
  },

  removeFormFromScheme: (schemeId, formId) => {
    get().pushUndo('update-form');
    const removeForms = (forms: Form[]) => forms.filter((f) => f.id !== formId);
    set((s) => ({
      project: {
        ...s.project,
        schemes: s.project.schemes.map((sc) =>
          sc.id === schemeId ? { ...sc, forms: removeForms(sc.forms) } : sc
        ),
        scheme: s.project.scheme.id === schemeId
          ? { ...s.project.scheme, forms: removeForms(s.project.scheme.forms) }
          : s.project.scheme,
        updatedAt: new Date(),
      },
    }));
  },

  setDefaultAttributes: (updates) => {
    set((s) => ({
      project: {
        ...s.project,
        settings: {
          ...s.project.settings,
          defaultAttributes: {
            ...s.project.settings.defaultAttributes,
            ...updates,
          },
        },
        updatedAt: new Date(),
      },
    }));
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 3: Section Forms & Schemes
  // ═══════════════════════════════════════════════════════════════════════════

  applySectionForm: (sectionIds, formId) => {
    get().pushUndo('apply-section-form');
    set((s) => ({
      project: {
        ...s.project,
        sections: s.project.sections.map((sec) =>
          sectionIds.includes(sec.id) ? { ...sec, sectionFormId: formId } : sec
        ),
        updatedAt: new Date(),
      },
    }));
  },

  clearSectionForm: (sectionIds) => {
    get().pushUndo('apply-section-form');
    set((s) => ({
      project: {
        ...s.project,
        sections: s.project.sections.map((sec) =>
          sectionIds.includes(sec.id) ? { ...sec, sectionFormId: null } : sec
        ),
        updatedAt: new Date(),
      },
    }));
  },

  setActiveSectionScheme: (schemeId) => {
    const state = get();
    const sectionScheme =
      state.project.sectionSchemes.find((s) => s.id === schemeId) ??
      ALL_BUILTIN_SECTION_SCHEMES.find((s) => s.id === schemeId);
    if (!sectionScheme) return;

    get().pushUndo('change-section-scheme');
    set((s) => ({
      project: {
        ...s.project,
        sectionScheme,
        sectionSchemes: s.project.sectionSchemes.some((sc) => sc.id === sectionScheme.id)
          ? s.project.sectionSchemes
          : [...s.project.sectionSchemes, sectionScheme],
        updatedAt: new Date(),
      },
    }));
  },

  createSectionScheme: (name) => {
    const newScheme: SectionScheme = {
      id: uuid(),
      name,
      builtIn: false,
      forms: [],
    };
    set((s) => ({
      project: {
        ...s.project,
        sectionSchemes: [...s.project.sectionSchemes, newScheme],
      },
    }));
    return newScheme;
  },

  updateSectionScheme: (id, updates) => {
    set((s) => ({
      project: {
        ...s.project,
        sectionSchemes: s.project.sectionSchemes.map((sc) =>
          sc.id === id ? { ...sc, ...updates } : sc
        ),
        sectionScheme: s.project.sectionScheme.id === id
          ? { ...s.project.sectionScheme, ...updates }
          : s.project.sectionScheme,
        updatedAt: new Date(),
      },
    }));
  },

  deleteSectionScheme: (id) => {
    const state = get();
    if (state.project.sectionScheme.id === id) return; // Can't delete active
    set((s) => ({
      project: {
        ...s.project,
        sectionSchemes: s.project.sectionSchemes.filter((sc) => sc.id !== id),
      },
    }));
  },

  duplicateSectionScheme: (id) => {
    const state = get();
    const source =
      state.project.sectionSchemes.find((s) => s.id === id) ??
      ALL_BUILTIN_SECTION_SCHEMES.find((s) => s.id === id);
    if (!source) return;

    const copy: SectionScheme = {
      ...JSON.parse(JSON.stringify(source)),
      id: uuid(),
      name: `${source.name} (Copy)`,
      builtIn: false,
    };
    set((s) => ({
      project: {
        ...s.project,
        sectionSchemes: [...s.project.sectionSchemes, copy],
      },
    }));
  },

  addSectionFormToScheme: (schemeId, form) => {
    get().pushUndo('update-section-form');
    set((s) => ({
      project: {
        ...s.project,
        sectionSchemes: s.project.sectionSchemes.map((sc) =>
          sc.id === schemeId ? { ...sc, forms: [...sc.forms, form] } : sc
        ),
        sectionScheme: s.project.sectionScheme.id === schemeId
          ? { ...s.project.sectionScheme, forms: [...s.project.sectionScheme.forms, form] }
          : s.project.sectionScheme,
        updatedAt: new Date(),
      },
    }));
  },

  updateSectionFormInScheme: (schemeId, formId, updates) => {
    get().pushUndo('update-section-form');
    const updateForms = (forms: SectionForm[]) =>
      forms.map((f) => (f.id === formId ? { ...f, ...updates } : f));
    set((s) => ({
      project: {
        ...s.project,
        sectionSchemes: s.project.sectionSchemes.map((sc) =>
          sc.id === schemeId ? { ...sc, forms: updateForms(sc.forms) } : sc
        ),
        sectionScheme: s.project.sectionScheme.id === schemeId
          ? { ...s.project.sectionScheme, forms: updateForms(s.project.sectionScheme.forms) }
          : s.project.sectionScheme,
        updatedAt: new Date(),
      },
    }));
  },

  removeSectionFormFromScheme: (schemeId, formId) => {
    get().pushUndo('update-section-form');
    const removeForms = (forms: SectionForm[]) => forms.filter((f) => f.id !== formId);
    set((s) => ({
      project: {
        ...s.project,
        sectionSchemes: s.project.sectionSchemes.map((sc) =>
          sc.id === schemeId ? { ...sc, forms: removeForms(sc.forms) } : sc
        ),
        sectionScheme: s.project.sectionScheme.id === schemeId
          ? { ...s.project.sectionScheme, forms: removeForms(s.project.sectionScheme.forms) }
          : s.project.sectionScheme,
        updatedAt: new Date(),
      },
    }));
  },

  // ─── Scheme templates (localStorage-backed) ─────────────────────────────

  addScheme: (scheme) => {
    set((s) => ({
      project: {
        ...s.project,
        schemes: [...s.project.schemes, scheme],
        updatedAt: new Date(),
      },
    }));
  },

  addSectionScheme: (scheme) => {
    set((s) => ({
      project: {
        ...s.project,
        sectionSchemes: [...s.project.sectionSchemes, scheme],
        updatedAt: new Date(),
      },
    }));
  },

  saveSchemeAsTemplate: (schemeId, newName, overwriteTemplateId) => {
    const state = get();
    const scheme =
      state.project.schemes.find((s) => s.id === schemeId) ??
      ALL_BUILTIN_SCHEMES.find((s) => s.id === schemeId);
    if (!scheme) return;

    const templates = readSchemeTemplates();
    const clone: Scheme = JSON.parse(JSON.stringify(scheme));
    clone.builtIn = false;

    if (overwriteTemplateId) {
      const idx = templates.findIndex((t) => t.id === overwriteTemplateId);
      if (idx >= 0) {
        clone.id = overwriteTemplateId;
        clone.name = newName ?? clone.name;
        templates[idx] = clone;
      }
    } else {
      clone.id = uuid();
      clone.name = newName ?? clone.name;
      templates.push(clone);
    }
    writeSchemeTemplates(templates);
  },

  loadSchemeTemplate: (templateId) => {
    const templates = readSchemeTemplates();
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;

    const clone: Scheme = JSON.parse(JSON.stringify(tpl));
    clone.id = uuid();
    clone.builtIn = false;
    // Give each form a fresh ID
    clone.forms = clone.forms.map((f) => ({ ...f, id: uuid() }));

    set((s) => ({
      project: {
        ...s.project,
        schemes: [...s.project.schemes, clone],
        scheme: clone,
        updatedAt: new Date(),
      },
    }));
  },

  getSavedTemplateNames: () => {
    return readSchemeTemplates().map((t) => ({ id: t.id, name: t.name }));
  },

  deleteSchemeTemplate: (templateId) => {
    const templates = readSchemeTemplates().filter((t) => t.id !== templateId);
    writeSchemeTemplates(templates);
  },

  // ─── Project Schemes ────────────────────────────────────────────────────────

  createProjectScheme: (name, chunkSchemeId, sectionSchemeId) => {
    const newScheme: ProjectScheme = {
      id: uuid(),
      name,
      builtIn: false,
      chunkSchemeId,
      sectionSchemeId,
    };
    set((s) => ({
      project: {
        ...s.project,
        projectSchemes: [...s.project.projectSchemes, newScheme],
      },
    }));
    return newScheme;
  },

  addProjectScheme: (scheme) => {
    set((s) => ({
      project: {
        ...s.project,
        projectSchemes: [...s.project.projectSchemes, scheme],
        updatedAt: new Date(),
      },
    }));
  },

  setActiveProjectScheme: (id) => {
    if (id === null) {
      // Switch to independent mode
      set((s) => ({
        project: {
          ...s.project,
          projectScheme: null,
          updatedAt: new Date(),
        },
      }));
      return;
    }

    const state = get();
    const projectScheme =
      state.project.projectSchemes.find((s) => s.id === id) ??
      ALL_BUILTIN_PROJECT_SCHEMES.find((s) => s.id === id);
    if (!projectScheme) return;

    // Activate both the chunk scheme and section scheme
    get().pushUndo('change-project-scheme');
    set((s) => ({
      project: {
        ...s.project,
        projectScheme,
        projectSchemes: s.project.projectSchemes.some((ps) => ps.id === projectScheme.id)
          ? s.project.projectSchemes
          : [...s.project.projectSchemes, projectScheme],
        updatedAt: new Date(),
      },
    }));
    // Switch child schemes
    get().setActiveScheme(projectScheme.chunkSchemeId);
    get().setActiveSectionScheme(projectScheme.sectionSchemeId);
  },

  updateProjectScheme: (id, updates) => {
    set((s) => ({
      project: {
        ...s.project,
        projectSchemes: s.project.projectSchemes.map((ps) =>
          ps.id === id ? { ...ps, ...updates } : ps
        ),
        projectScheme: s.project.projectScheme?.id === id
          ? { ...s.project.projectScheme, ...updates }
          : s.project.projectScheme,
        updatedAt: new Date(),
      },
    }));
  },

  deleteProjectScheme: (id) => {
    const state = get();
    if (state.project.projectScheme?.id === id) return; // Can't delete active
    set((s) => ({
      project: {
        ...s.project,
        projectSchemes: s.project.projectSchemes.filter((ps) => ps.id !== id),
      },
    }));
  },

  duplicateProjectScheme: (id) => {
    const state = get();
    const source =
      state.project.projectSchemes.find((s) => s.id === id) ??
      ALL_BUILTIN_PROJECT_SCHEMES.find((s) => s.id === id);
    if (!source) return;

    const copy: ProjectScheme = {
      ...source,
      id: uuid(),
      name: `${source.name} (Copy)`,
      builtIn: false,
    };
    set((s) => ({
      project: {
        ...s.project,
        projectSchemes: [...s.project.projectSchemes, copy],
      },
    }));
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 2: Tags
  // ═══════════════════════════════════════════════════════════════════════════

  tagChunks: (ids, tags) => {
    if (ids.length === 0 || tags.length === 0) return;
    get().pushUndo('tag-chunks');
    set((s) => {
      // Add new tags to library
      const libSet = new Set(s.project.tagLibrary);
      tags.forEach(t => libSet.add(t));
      return {
        project: {
          ...s.project,
          chunks: s.project.chunks.map((c) =>
            ids.includes(c.id)
              ? { ...c, tags: [...new Set([...(c.tags ?? []), ...tags])] }
              : c
          ),
          tagLibrary: [...libSet],
          updatedAt: new Date(),
        },
      };
    });
  },

  untagChunks: (ids, tags) => {
    if (ids.length === 0 || tags.length === 0) return;
    get().pushUndo('tag-chunks');
    const tagSet = new Set(tags);
    set((s) => ({
      project: {
        ...s.project,
        chunks: s.project.chunks.map((c) =>
          ids.includes(c.id)
            ? { ...c, tags: (c.tags ?? []).filter(t => !tagSet.has(t)) }
            : c
        ),
        updatedAt: new Date(),
      },
    }));
  },

  tagSections: (ids, tags) => {
    if (ids.length === 0 || tags.length === 0) return;
    get().pushUndo('tag-sections');
    set((s) => {
      const libSet = new Set(s.project.tagLibrary);
      tags.forEach(t => libSet.add(t));
      return {
        project: {
          ...s.project,
          sections: s.project.sections.map((sec) =>
            ids.includes(sec.id)
              ? { ...sec, tags: [...new Set([...(sec.tags ?? []), ...tags])] }
              : sec
          ),
          tagLibrary: [...libSet],
          updatedAt: new Date(),
        },
      };
    });
  },

  untagSections: (ids, tags) => {
    if (ids.length === 0 || tags.length === 0) return;
    get().pushUndo('tag-sections');
    const tagSet = new Set(tags);
    set((s) => ({
      project: {
        ...s.project,
        sections: s.project.sections.map((sec) =>
          ids.includes(sec.id)
            ? { ...sec, tags: (sec.tags ?? []).filter(t => !tagSet.has(t)) }
            : sec
        ),
        updatedAt: new Date(),
      },
    }));
  },

  addTagToLibrary: (tag) => {
    set((s) => {
      if (s.project.tagLibrary.includes(tag)) return s;
      return {
        project: {
          ...s.project,
          tagLibrary: [...s.project.tagLibrary, tag],
        },
      };
    });
  },

  removeTagFromLibrary: (tag) => {
    set((s) => ({
      project: {
        ...s.project,
        tagLibrary: s.project.tagLibrary.filter(t => t !== tag),
        // Also remove from all chunks and sections
        chunks: s.project.chunks.map(c => ({
          ...c,
          tags: (c.tags ?? []).filter(t => t !== tag),
        })),
        sections: s.project.sections.map(sec => ({
          ...sec,
          tags: (sec.tags ?? []).filter(t => t !== tag),
        })),
      },
    }));
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 2: Selection Checkmarks
  // ═══════════════════════════════════════════════════════════════════════════

  setCheckSelectionMode: (on) => {
    if (!on) {
      // Turning off mode also clears all checks
      set({ checkSelectionMode: false, checkedChunkIds: new Set(), checkedSectionIds: new Set() });
    } else {
      set({ checkSelectionMode: true });
    }
  },

  toggleCheckChunk: (id) => {
    set((s) => {
      const next = new Set(s.checkedChunkIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { checkedChunkIds: next };
    });
  },

  toggleCheckSection: (id) => {
    set((s) => {
      const next = new Set(s.checkedSectionIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { checkedSectionIds: next };
    });
  },

  checkAllSelected: () => {
    set((s) => ({
      checkedChunkIds: new Set([...s.checkedChunkIds, ...s.selection.selectedChunkIds]),
      checkedSectionIds: new Set([...s.checkedSectionIds, ...s.selection.selectedSectionIds]),
    }));
  },

  uncheckAll: () => {
    set({ checkedChunkIds: new Set(), checkedSectionIds: new Set() });
  },

  applyToChecked: (action, payload) => {
    const state = get();
    const chunkIds = Array.from(state.checkedChunkIds);
    const sectionIds = Array.from(state.checkedSectionIds);

    switch (action) {
      case 'style':
        if (chunkIds.length > 0 && payload) state.styleChunks(chunkIds, payload as ChunkStyle);
        break;
      case 'form':
        if (chunkIds.length > 0 && payload) state.applyForm(chunkIds, payload as string);
        break;
      case 'sectionForm':
        if (sectionIds.length > 0 && payload) state.applySectionForm(sectionIds, payload as string);
        break;
      case 'delete':
        if (chunkIds.length > 0) state.deleteChunks(chunkIds);
        break;
      case 'tag':
        if (payload) {
          const tags = payload as string[];
          if (chunkIds.length > 0) state.tagChunks(chunkIds, tags);
          if (sectionIds.length > 0) state.tagSections(sectionIds, tags);
        }
        break;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 2: Paintbrush (Scheme-Aware Scope Painting)
  // ═══════════════════════════════════════════════════════════════════════════

  setPaintbrushMode: (mode) => {
    set({ paintbrushMode: mode });
  },

  applyPaintbrush: (targetId, targetType) => {
    const state = get();
    const mode = state.paintbrushMode;
    if (!mode) return;

    const { project } = state;

    // ── Phase A: Resolve target chunkIds[] and sectionIds[] from scope ──
    let chunkIds: string[] = [];
    let sectionIds: string[] = [];

    switch (mode.scope) {
      case 'single-chunk': {
        if (targetType === 'chunk') chunkIds = [targetId];
        break;
      }
      case 'single-section': {
        if (targetType === 'section') {
          sectionIds = [targetId];
          chunkIds = project.chunks.filter(c => !c.isDeleted && c.sectionId === targetId).map(c => c.id);
        }
        break;
      }
      case 'form-of-chunk': {
        const filterFormId = mode.scopeFilterFormId;
        if (!filterFormId) return;
        chunkIds = project.chunks.filter(c => !c.isDeleted && c.formId === filterFormId).map(c => c.id);
        break;
      }
      case 'form-of-section': {
        const filterSfId = mode.scopeFilterSectionFormId;
        if (!filterSfId) return;
        sectionIds = project.sections
          .filter(s => s.sectionFormId === filterSfId && (s.status ?? 'active') === 'active')
          .map(s => s.id);
        const secSet = new Set(sectionIds);
        chunkIds = project.chunks.filter(c => !c.isDeleted && secSet.has(c.sectionId)).map(c => c.id);
        break;
      }
      case 'form-of-chunk-in-section': {
        if (targetType !== 'section') return;
        const filterFormId2 = mode.scopeFilterFormId;
        if (!filterFormId2) return;
        sectionIds = [targetId];
        chunkIds = project.chunks
          .filter(c => !c.isDeleted && c.sectionId === targetId && c.formId === filterFormId2)
          .map(c => c.id);
        break;
      }
      case 'form-of-chunk-in-section-form': {
        const filterFormId3 = mode.scopeFilterFormId;
        const filterSfId2 = mode.scopeFilterSectionFormId;
        if (!filterFormId3 || !filterSfId2) return;
        const matchingSections = new Set(
          project.sections
            .filter(s => s.sectionFormId === filterSfId2 && (s.status ?? 'active') === 'active')
            .map(s => s.id)
        );
        sectionIds = [...matchingSections];
        chunkIds = project.chunks
          .filter(c => !c.isDeleted && c.formId === filterFormId3 && matchingSections.has(c.sectionId))
          .map(c => c.id);
        break;
      }
    }

    // ── Phase B: Dispatch based on action type ──
    const action = mode.action;
    switch (action.type) {
      case 'apply-form': {
        if (chunkIds.length > 0) state.applyForm(chunkIds, action.formId);
        if (sectionIds.length > 0) state.applySectionForm(sectionIds, action.formId);
        break;
      }
      case 'apply-tags': {
        if (chunkIds.length > 0) state.tagChunks(chunkIds, action.tags);
        if (sectionIds.length > 0) state.tagSections(sectionIds, action.tags);
        break;
      }
      case 'remove-tags': {
        if (chunkIds.length > 0) state.untagChunks(chunkIds, action.tags);
        if (sectionIds.length > 0) state.untagSections(sectionIds, action.tags);
        break;
      }
      case 'reset-attribute': {
        if (chunkIds.length > 0) state.resetChunkAttribute(chunkIds, action.attribute);
        if (sectionIds.length > 0) state.resetSectionAttribute(sectionIds, action.attribute);
        break;
      }
    }
  },

  resetChunkAttribute: (ids, attribute) => {
    if (ids.length === 0) return;
    get().pushUndo('apply-form');
    set((s) => ({
      project: {
        ...s.project,
        chunks: s.project.chunks.map((c) => {
          if (!ids.includes(c.id)) return c;
          switch (attribute) {
            case 'form':
            case 'shape':
              return { ...c, formId: null, color: null, style: null };
            case 'color':
              return { ...c, color: null, style: c.style ? { ...c.style, color: '#D1D5DB', gradient: null } : null };
            case 'tags':
              return { ...c, tags: [] };
            case 'section-form':
              return c; // no-op for chunks
          }
        }),
        updatedAt: new Date(),
      },
    }));
  },

  resetSectionAttribute: (ids, attribute) => {
    if (ids.length === 0) return;
    get().pushUndo('apply-section-form');
    set((s) => ({
      project: {
        ...s.project,
        sections: s.project.sections.map((sec) => {
          if (!ids.includes(sec.id)) return sec;
          switch (attribute) {
            case 'section-form':
              return { ...sec, sectionFormId: null };
            case 'tags':
              return { ...sec, tags: [] };
            case 'color':
              return { ...sec, backgroundColor: null, backgroundStyle: null };
            case 'form':
            case 'shape':
              return sec; // no-op for sections
          }
        }),
        updatedAt: new Date(),
      },
    }));
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 2.5: Virtual Clipboard (Cut/Copy/Paste)
  // ═══════════════════════════════════════════════════════════════════════════

  clipboardCut: () => {
    const state = get();
    const selectedIds = Array.from(state.selection.selectedChunkIds);
    if (selectedIds.length === 0) return;

    const chunks = state.project.chunks.filter(c => selectedIds.includes(c.id) && !c.isDeleted);
    if (chunks.length === 0) return;

    // Add to clipboard history store
    useClipboardStore.getState().addItem(
      chunks.map(c => ({ ...c })),
      'cut',
      chunks[0].sectionId,
    );

    // Keep legacy clipboard in sync for any remaining direct references
    set({
      clipboard: {
        chunks: chunks.map(c => ({ ...c })),
        sourceSectionId: chunks[0].sectionId,
        mode: 'cut',
      },
    });
  },

  clipboardCopy: () => {
    const state = get();
    const selectedIds = Array.from(state.selection.selectedChunkIds);
    if (selectedIds.length === 0) return;

    const chunks = state.project.chunks.filter(c => selectedIds.includes(c.id) && !c.isDeleted);
    if (chunks.length === 0) return;

    // Add to clipboard history store
    useClipboardStore.getState().addItem(
      chunks.map(c => ({ ...c })),
      'copy',
      chunks[0].sectionId,
    );

    // Keep legacy clipboard in sync
    set({
      clipboard: {
        chunks: chunks.map(c => ({ ...c })),
        sourceSectionId: chunks[0].sectionId,
        mode: 'copy',
      },
    });
  },

  clipboardPaste: (specificItemId?: string) => {
    const state = get();
    const cbStore = useClipboardStore.getState();

    // Get the item to paste — either a specific item or the current paste target
    const item = specificItemId
      ? cbStore.pasteSpecificItem(specificItemId)
      : cbStore.getItemToPaste();
    if (!item) return;

    const { playback, project } = state;

    // Determine target section: insertion point section, or current chunk's section, or first section
    const targetSectionId =
      playback.insertionPoint?.sectionId ??
      (playback.currentChunkId
        ? project.chunks.find(c => c.id === playback.currentChunkId)?.sectionId
        : null) ??
      project.sections.find(s => (s.status ?? 'active') === 'active')?.id;
    if (!targetSectionId) return;

    // Determine insertion order index
    const existingInSection = project.chunks
      .filter(c => c.sectionId === targetSectionId && !c.isDeleted)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    let insertAt = playback.insertionPoint?.orderIndex ?? existingInSection.length;

    // Snapshot clipboard before paste so undo can restore consumed cut items
    const clipboardSnapshot = cbStore.snapshotItems();
    state.pushUndo('move', clipboardSnapshot);

    if (item.mode === 'cut') {
      // Move: delete originals, insert at target
      const origIds = item.chunks.map(c => c.id);
      set((s) => {
        // Remove originals
        let updatedChunks = s.project.chunks.map(c =>
          origIds.includes(c.id) ? { ...c, isDeleted: true } : c
        );
        // Bump existing chunks at target to make room
        updatedChunks = updatedChunks.map(c =>
          c.sectionId === targetSectionId && !c.isDeleted && c.orderIndex >= insertAt
            ? { ...c, orderIndex: c.orderIndex + item.chunks.length }
            : c
        );
        // Insert clipboard chunks at target
        const pasted = item.chunks.map((c, i) => ({
          ...c,
          id: uuid(),
          sectionId: targetSectionId,
          orderIndex: insertAt + i,
          waveformData: null,
        }));
        return {
          project: {
            ...s.project,
            chunks: [...updatedChunks, ...pasted],
            updatedAt: new Date(),
          },
          clipboard: { chunks: [], sourceSectionId: null, mode: null },
          selection: {
            ...s.selection,
            selectedChunkIds: new Set(pasted.map(c => c.id)),
            anchorChunkId: pasted[0]?.id ?? null,
          },
        };
      });
      // Cut items are consumed after paste
      cbStore.removeItem(item.id);
    } else {
      // Copy: duplicate at target
      set((s) => {
        let updatedChunks = s.project.chunks.map(c =>
          c.sectionId === targetSectionId && !c.isDeleted && c.orderIndex >= insertAt
            ? { ...c, orderIndex: c.orderIndex + item.chunks.length }
            : c
        );
        const pasted = item.chunks.map((c, i) => ({
          ...c,
          id: uuid(),
          sectionId: targetSectionId,
          orderIndex: insertAt + i,
          waveformData: null,
        }));
        return {
          project: {
            ...s.project,
            chunks: [...updatedChunks, ...pasted],
            updatedAt: new Date(),
          },
          selection: {
            ...s.selection,
            selectedChunkIds: new Set(pasted.map(c => c.id)),
            anchorChunkId: pasted[0]?.id ?? null,
          },
        };
      });
    }

    // Advance cursor for sequential paste mode
    if (cbStore.pasteMode === 'sequential' && !specificItemId) {
      cbStore.advancePasteCursor();
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 2.5: Drag-and-Drop Chunk Reorder
  // ═══════════════════════════════════════════════════════════════════════════

  moveChunksToPosition: (chunkIds, targetSectionId, targetOrderIndex) => {
    if (chunkIds.length === 0) return;
    const state = get();
    const movedSet = new Set(chunkIds);

    state.pushUndo('move');

    set((s) => {
      const chunks = [...s.project.chunks];

      // Gather chunks being moved (preserve order)
      const moved = chunks
        .filter(c => movedSet.has(c.id) && !c.isDeleted)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      if (moved.length === 0) return s;

      // Track source sections for renumbering
      const sourceSections = new Set(moved.map(c => c.sectionId));

      // Remove moved chunks from their current positions
      const remaining = chunks.map(c =>
        movedSet.has(c.id) ? { ...c, sectionId: '__moving__' } : c
      );

      // Bump target section chunks at/after insert position
      const updated = remaining.map(c =>
        c.sectionId === targetSectionId && !c.isDeleted && c.orderIndex >= targetOrderIndex
          ? { ...c, orderIndex: c.orderIndex + moved.length }
          : c
      );

      // Place moved chunks at target
      const finalChunks = updated.map(c => {
        if (c.sectionId === '__moving__') {
          const movedIdx = moved.findIndex(m => m.id === c.id);
          if (movedIdx >= 0) {
            return {
              ...c,
              sectionId: targetSectionId,
              orderIndex: targetOrderIndex + movedIdx,
            };
          }
        }
        return c;
      });

      // Renumber all affected sections
      const sectionsToRenumber = new Set([...sourceSections, targetSectionId]);
      for (const secId of sectionsToRenumber) {
        const secChunks = finalChunks
          .filter(c => c.sectionId === secId && !c.isDeleted)
          .sort((a, b) => a.orderIndex - b.orderIndex);
        secChunks.forEach((c, i) => {
          const idx = finalChunks.findIndex(fc => fc.id === c.id);
          if (idx >= 0) finalChunks[idx] = { ...finalChunks[idx], orderIndex: i };
        });
      }

      return {
        project: { ...s.project, chunks: finalChunks, updatedAt: new Date() },
        selection: {
          ...s.selection,
          selectedChunkIds: movedSet,
          anchorChunkId: moved[0]?.id ?? null,
        },
      };
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 6: Configuration System
  // ═══════════════════════════════════════════════════════════════════════════

  initSectionConfig: (sectionId) => {
    const { project } = get();
    if (project.sectionConfigs[sectionId]) return;

    // Build initial version from existing chunks
    const sectionChunks = project.chunks
      .filter(c => c.sectionId === sectionId && !c.isDeleted)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    if (sectionChunks.length === 0) return;

    const audioBufferId = sectionChunks[0].audioBufferId;
    const startTime = Math.min(...sectionChunks.map(c => c.startTime));
    const endTime = Math.max(...sectionChunks.map(c => c.endTime));

    const boundaries = boundariesFromChunks(project.chunks, sectionId);
    const initialConfig = createConfiguration(
      'Initial',
      boundaries,
      PRESET_SILENCE_DETECTION.criteria,
      'auto',
      PRESET_SILENCE_DETECTION.id,
    );

    const version: SectionVersion = {
      id: uuid(),
      sectionId,
      audioRanges: [{ audioBufferId, startTime, endTime }],
      configurations: [initialConfig],
      activeConfigIndex: 0,
      createdAt: Date.now(),
      source: 'import',
    };

    const configState: SectionConfigState = {
      sectionId,
      versions: [version],
      activeVersionIndex: 0,
      previewConfig: null,
    };

    set((s) => ({
      project: {
        ...s.project,
        sectionConfigs: { ...s.project.sectionConfigs, [sectionId]: configState },
      },
    }));
  },

  addVersion: (sectionId, audioRanges, source) => {
    const { project } = get();
    const configState = project.sectionConfigs[sectionId];
    if (!configState) {
      get().initSectionConfig(sectionId);
      return;
    }

    const version: SectionVersion = {
      id: uuid(),
      sectionId,
      audioRanges,
      configurations: [],
      activeConfigIndex: -1,
      createdAt: Date.now(),
      source,
    };

    set((s) => {
      const cs = s.project.sectionConfigs[sectionId];
      if (!cs) return s;
      return {
        project: {
          ...s.project,
          sectionConfigs: {
            ...s.project.sectionConfigs,
            [sectionId]: {
              ...cs,
              versions: [...cs.versions, version],
              activeVersionIndex: cs.versions.length,
            },
          },
        },
      };
    });
  },

  addConfiguration: (sectionId, versionId, config) => {
    set((s) => {
      const cs = s.project.sectionConfigs[sectionId];
      if (!cs) return s;
      const versions = cs.versions.map(v =>
        v.id === versionId
          ? { ...v, configurations: [...v.configurations, config], activeConfigIndex: v.configurations.length }
          : v,
      );
      return {
        project: {
          ...s.project,
          sectionConfigs: {
            ...s.project.sectionConfigs,
            [sectionId]: { ...cs, versions },
          },
        },
      };
    });
  },

  switchConfiguration: (sectionId, configIndex) => {
    const { project } = get();
    const cs = project.sectionConfigs[sectionId];
    if (!cs) return;

    const version = cs.versions[cs.activeVersionIndex];
    if (!version || configIndex < 0 || configIndex >= version.configurations.length) return;
    if (configIndex === version.activeConfigIndex) return;

    const config = version.configurations[configIndex];
    const audioRange = version.audioRanges[0];
    if (!audioRange) return;

    get().pushUndo('switch-configuration');

    // Find audio buffer for waveform computation
    const bufRef = project.audioBuffers.find(b => b.id === audioRange.audioBufferId);
    const channelData = bufRef?.decodedBuffer?.getChannelData(0) ?? null;
    const sampleRate = bufRef?.decodedBuffer?.sampleRate ?? 44100;

    // Remove old chunks for this section
    const oldChunkIds = project.chunks
      .filter(c => c.sectionId === sectionId && !c.isDeleted)
      .map(c => c.id);

    // Generate new chunks from boundaries
    const newChunks = chunksFromBoundaries(
      config.boundaries,
      audioRange,
      sectionId,
      0,
      channelData,
      sampleRate,
      config.chunkOverrides,
    );

    // Remap word-chunk mappings
    const updatedMappings = remapWordsForSection(
      sectionId,
      newChunks,
      project.transcription.words,
      project.transcription.wordChunkMappings,
      oldChunkIds,
    );

    set((s) => {
      const remainingChunks = s.project.chunks.filter(
        c => c.sectionId !== sectionId || c.isDeleted,
      );
      const cs2 = s.project.sectionConfigs[sectionId];
      if (!cs2) return s;

      const updatedVersions = cs2.versions.map((v, i) =>
        i === cs2.activeVersionIndex
          ? { ...v, activeConfigIndex: configIndex }
          : v,
      );

      return {
        project: {
          ...s.project,
          chunks: [...remainingChunks, ...newChunks],
          transcription: {
            ...s.project.transcription,
            wordChunkMappings: updatedMappings,
          },
          sectionConfigs: {
            ...s.project.sectionConfigs,
            [sectionId]: { ...cs2, versions: updatedVersions, previewConfig: null },
          },
          updatedAt: new Date(),
        },
      };
    });
  },

  switchVersion: (sectionId, versionIndex) => {
    const { project } = get();
    const cs = project.sectionConfigs[sectionId];
    if (!cs || versionIndex < 0 || versionIndex >= cs.versions.length) return;
    if (versionIndex === cs.activeVersionIndex) return;

    get().pushUndo('switch-version');

    const version = cs.versions[versionIndex];
    const config = version.configurations[version.activeConfigIndex];
    const audioRange = version.audioRanges[0];
    if (!audioRange) return;

    const bufRef = project.audioBuffers.find(b => b.id === audioRange.audioBufferId);
    const channelData = bufRef?.decodedBuffer?.getChannelData(0) ?? null;
    const sampleRate = bufRef?.decodedBuffer?.sampleRate ?? 44100;

    const oldChunkIds = project.chunks
      .filter(c => c.sectionId === sectionId && !c.isDeleted)
      .map(c => c.id);

    const newChunks = config
      ? chunksFromBoundaries(config.boundaries, audioRange, sectionId, 0, channelData, sampleRate, config.chunkOverrides)
      : [];

    const updatedMappings = remapWordsForSection(
      sectionId, newChunks, project.transcription.words,
      project.transcription.wordChunkMappings, oldChunkIds,
    );

    set((s) => {
      const remainingChunks = s.project.chunks.filter(c => c.sectionId !== sectionId || c.isDeleted);
      return {
        project: {
          ...s.project,
          chunks: [...remainingChunks, ...newChunks],
          transcription: { ...s.project.transcription, wordChunkMappings: updatedMappings },
          sectionConfigs: {
            ...s.project.sectionConfigs,
            [sectionId]: { ...s.project.sectionConfigs[sectionId]!, activeVersionIndex: versionIndex, previewConfig: null },
          },
          updatedAt: new Date(),
        },
      };
    });
  },

  cycleConfiguration: (sectionId, direction) => {
    const { project } = get();
    const cs = project.sectionConfigs[sectionId];
    if (!cs) return;
    const version = cs.versions[cs.activeVersionIndex];
    if (!version || version.configurations.length <= 1) return;

    let next = version.activeConfigIndex + direction;
    if (next < 0) next = version.configurations.length - 1;
    if (next >= version.configurations.length) next = 0;

    get().switchConfiguration(sectionId, next);
  },

  deleteConfiguration: (sectionId, versionId, configId) => {
    set((s) => {
      const cs = s.project.sectionConfigs[sectionId];
      if (!cs) return s;
      const versions = cs.versions.map(v => {
        if (v.id !== versionId) return v;
        const filtered = v.configurations.filter(c => c.id !== configId);
        return {
          ...v,
          configurations: filtered,
          activeConfigIndex: Math.min(v.activeConfigIndex, Math.max(0, filtered.length - 1)),
        };
      });
      return {
        project: {
          ...s.project,
          sectionConfigs: { ...s.project.sectionConfigs, [sectionId]: { ...cs, versions } },
        },
      };
    });
  },

  renameConfiguration: (sectionId, versionId, configId, name) => {
    set((s) => {
      const cs = s.project.sectionConfigs[sectionId];
      if (!cs) return s;
      const versions = cs.versions.map(v => {
        if (v.id !== versionId) return v;
        return {
          ...v,
          configurations: v.configurations.map(c => c.id === configId ? { ...c, name } : c),
        };
      });
      return {
        project: {
          ...s.project,
          sectionConfigs: { ...s.project.sectionConfigs, [sectionId]: { ...cs, versions } },
        },
      };
    });
  },

  setPreviewConfig: (sectionId, config) => {
    set((s) => {
      const cs = s.project.sectionConfigs[sectionId];
      if (!cs) return s;
      return {
        project: {
          ...s.project,
          sectionConfigs: {
            ...s.project.sectionConfigs,
            [sectionId]: { ...cs, previewConfig: config },
          },
        },
      };
    });
  },

  commitPreview: (sectionId) => {
    const { project } = get();
    const cs = project.sectionConfigs[sectionId];
    if (!cs || !cs.previewConfig) return;

    const version = cs.versions[cs.activeVersionIndex];
    if (!version) return;

    // Add the preview as a new configuration and switch to it
    get().addConfiguration(sectionId, version.id, cs.previewConfig);
    // switchConfiguration will be triggered by addConfiguration setting activeConfigIndex
    const newIndex = version.configurations.length; // it was appended
    get().switchConfiguration(sectionId, newIndex);
  },

  applyDivisionPreset: (sectionId, presetId) => {
    const { project } = get();
    const preset = project.divisionPresets.find(p => p.id === presetId);
    if (!preset) return;

    // Ensure config state exists
    if (!project.sectionConfigs[sectionId]) {
      get().initSectionConfig(sectionId);
    }

    const cs = get().project.sectionConfigs[sectionId];
    if (!cs) return;
    const version = cs.versions[cs.activeVersionIndex];
    if (!version) return;
    const audioRange = version.audioRanges[0];
    if (!audioRange) return;

    const bufRef = project.audioBuffers.find(b => b.id === audioRange.audioBufferId);
    const channelData = bufRef?.decodedBuffer?.getChannelData(0) ?? null;
    const sampleRate = bufRef?.decodedBuffer?.sampleRate ?? 44100;
    const words = project.transcription.words;

    // Compute boundaries from criteria
    const allBoundaries: BoundaryPoint[] = [];
    for (const criterion of preset.criteria) {
      if (!criterion.enabled) continue;
      const weighted = computeCriterionBoundaries(
        criterion, channelData, sampleRate, audioRange, words,
      ).map(b => ({ ...b, confidence: b.confidence * criterion.weight }));
      allBoundaries.push(...weighted);
    }

    const merged = mergeBoundaries(allBoundaries);
    const config = createConfiguration(preset.name, merged, preset.criteria, 'user', preset.id);

    get().addConfiguration(sectionId, version.id, config);
    get().switchConfiguration(sectionId, version.configurations.length);
  },

  applyCustomDivision: (sectionId, criteria) => {
    const { project } = get();
    if (!project.sectionConfigs[sectionId]) {
      get().initSectionConfig(sectionId);
    }

    const cs = get().project.sectionConfigs[sectionId];
    if (!cs) return;
    const version = cs.versions[cs.activeVersionIndex];
    if (!version) return;
    const audioRange = version.audioRanges[0];
    if (!audioRange) return;

    const bufRef = project.audioBuffers.find(b => b.id === audioRange.audioBufferId);
    const channelData = bufRef?.decodedBuffer?.getChannelData(0) ?? null;
    const sampleRate = bufRef?.decodedBuffer?.sampleRate ?? 44100;
    const words = project.transcription.words;

    const allBoundaries: BoundaryPoint[] = [];
    for (const criterion of criteria) {
      if (!criterion.enabled) continue;
      const weighted = computeCriterionBoundaries(
        criterion, channelData, sampleRate, audioRange, words,
      ).map(b => ({ ...b, confidence: b.confidence * criterion.weight }));
      allBoundaries.push(...weighted);
    }

    const merged = mergeBoundaries(allBoundaries);
    const config = createConfiguration('Custom', merged, criteria, 'user');

    get().addConfiguration(sectionId, version.id, config);
    get().switchConfiguration(sectionId, version.configurations.length);
  },

  applyWordPerChunk: (sectionId) => {
    const { project } = get();
    if (!project.sectionConfigs[sectionId]) {
      get().initSectionConfig(sectionId);
    }

    const cs = get().project.sectionConfigs[sectionId];
    if (!cs) return;
    const version = cs.versions[cs.activeVersionIndex];
    if (!version) return;
    const audioRange = version.audioRanges[0];
    if (!audioRange) return;

    const words = project.transcription.words;
    const boundaries = computeWordBoundaries(words, audioRange);
    const config = createConfiguration('One Word Per Chunk', boundaries, [{ type: 'word-level', enabled: true, weight: 1, params: {} }], 'user', 'preset-one-word');

    get().addConfiguration(sectionId, version.id, config);
    get().switchConfiguration(sectionId, version.configurations.length);
  },

  addDivisionPreset: (preset) => {
    set((s) => ({
      project: {
        ...s.project,
        divisionPresets: [...s.project.divisionPresets, preset],
      },
    }));
  },

  updateDivisionPreset: (id, updates) => {
    set((s) => ({
      project: {
        ...s.project,
        divisionPresets: s.project.divisionPresets.map(p =>
          p.id === id ? { ...p, ...updates } : p,
        ),
      },
    }));
  },

  deleteDivisionPreset: (id) => {
    set((s) => ({
      project: {
        ...s.project,
        divisionPresets: s.project.divisionPresets.filter(p => p.id !== id),
      },
    }));
  },
}));

// ─── Helper: Compute boundaries for a single criterion ─────────────────────

function computeCriterionBoundaries(
  criterion: DivisionCriterion,
  channelData: Float32Array | null,
  sampleRate: number,
  audioRange: { audioBufferId: string; startTime: number; endTime: number },
  words: import('../types/transcription').TranscribedWord[],
): BoundaryPoint[] {
  // Delegate to the orchestrator with a single-criterion list
  return computeBoundaries([criterion], channelData, sampleRate, audioRange, words, 0);
}

// ─── localStorage helpers for scheme templates ────────────────────────────

const SCHEME_TEMPLATES_KEY = 'voxium_scheme_templates';

function readSchemeTemplates(): Scheme[] {
  try {
    const raw = localStorage.getItem(SCHEME_TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeSchemeTemplates(templates: Scheme[]): void {
  localStorage.setItem(SCHEME_TEMPLATES_KEY, JSON.stringify(templates));
}
