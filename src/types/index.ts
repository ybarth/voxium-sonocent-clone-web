// Core data model from AudioCanvas v1 spec §14

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
  isDeleted: boolean;
  waveformData: number[] | null; // Pre-computed peak data for rendering
}

export interface Section {
  id: string;
  name: string;
  orderIndex: number;
  backgroundColor: string | null;
}

export interface ColorKey {
  id: string;
  name: string;
  colors: ColorKeyEntry[];
}

export interface ColorKeyEntry {
  hex: string;
  label: string;
  shortcutKey: number; // 1-9, 0 for default
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
}

export type UndoActionType =
  | 'split'
  | 'merge'
  | 'delete'
  | 'move'
  | 'recolor'
  | 'add-section'
  | 'rename-section'
  | 'delete-section'
  | 'import-audio';

export interface UndoAction {
  type: UndoActionType;
  timestamp: number;
  previousState: {
    chunks: Chunk[];
    sections: Section[];
  };
}

// Default color key based on spec §4A & §4G
export const DEFAULT_COLORS: ColorKeyEntry[] = [
  { hex: '#EF4444', label: 'Key Point', shortcutKey: 1 },
  { hex: '#F97316', label: 'Example', shortcutKey: 2 },
  { hex: '#EAB308', label: 'Question', shortcutKey: 3 },
  { hex: '#22C55E', label: 'Important', shortcutKey: 4 },
  { hex: '#06B6D4', label: 'Definition', shortcutKey: 5 },
  { hex: '#3B82F6', label: 'Reference', shortcutKey: 6 },
  { hex: '#8B5CF6', label: 'Review', shortcutKey: 7 },
  { hex: '#EC4899', label: 'Action Item', shortcutKey: 8 },
  { hex: '#6B7280', label: 'Skip', shortcutKey: 9 },
];

export const DEFAULT_CHUNK_COLOR = '#D1D5DB';

export const DEFAULT_SETTINGS: ProjectSettings = {
  playbackSpeed: 1.0,
  volume: 1.0,
  zoomLevel: 1.0,
  visualMode: 'waveform',
  chunkNumberDisplay: 'section-relative',
  silenceThresholdDb: -40,
  minSilenceDurationMs: 300,
  minChunkDurationMs: 500,
};
