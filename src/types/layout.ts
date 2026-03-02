export type PaneId = 'audio' | 'text' | 'annotations' | 'file';

export type LayoutPresetId =
  | 'classic'
  | 'lecture'
  | 'transcript-review'
  | 'research'
  | 'minimal';

export interface LayoutPreset {
  id: LayoutPresetId;
  name: string;
  description: string;
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  { id: 'classic', name: 'Classic', description: 'Audio/Text + Annotations/File' },
  { id: 'lecture', name: 'Lecture', description: 'Recording focus — wide audio' },
  { id: 'transcript-review', name: 'Transcript Review', description: 'Editing focus — wide text' },
  { id: 'research', name: 'Research', description: '2x2 grid for cross-referencing' },
  { id: 'minimal', name: 'Minimal', description: 'Pure recording — audio only' },
];

export const PANE_CONFIG: Record<PaneId, { title: string; icon: string }> = {
  audio: { title: 'Audio', icon: '🎧' },
  text: { title: 'Text', icon: '📝' },
  annotations: { title: 'Annotations', icon: '💬' },
  file: { title: 'File', icon: '📄' },
};
