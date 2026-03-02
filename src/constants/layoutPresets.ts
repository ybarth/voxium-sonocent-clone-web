import type { DockviewApi, AddPanelPositionOptions } from 'dockview';
import type { LayoutPresetId, PaneId } from '../types/layout';
import { PANE_CONFIG } from '../types/layout';

export function addPane(api: DockviewApi, paneId: PaneId, position?: AddPanelPositionOptions) {
  const config = PANE_CONFIG[paneId];
  api.addPanel({
    id: paneId,
    component: paneId,
    title: config.title,
    params: { paneId, icon: config.icon },
    position,
  });
}

function clearAll(api: DockviewApi) {
  api.clear();
}

/**
 * Classic: Current layout — Audio/Text (left) + Annotations/File (right)
 *
 * ┌──────────┬───────────┐
 * │  Audio   │Annotations│
 * ├──────────┤───────────┤
 * │   Text   │   File    │
 * └──────────┴───────────┘
 */
function applyClassic(api: DockviewApi) {
  addPane(api, 'audio');
  addPane(api, 'annotations', { referencePanel: 'audio', direction: 'right' });
  addPane(api, 'text', { referencePanel: 'audio', direction: 'below' });
  addPane(api, 'file', { referencePanel: 'annotations', direction: 'below' });

  // Adjust sizes: left column wider (65%), audio taller (65%)
  const audioPanel = api.getPanel('audio');
  const textPanel = api.getPanel('text');
  if (audioPanel?.group && textPanel?.group) {
    try {
      audioPanel.group.api.setSize({ width: 650 });
      audioPanel.group.api.setSize({ height: 400 });
    } catch { /* best-effort sizing */ }
  }
}

/**
 * Lecture: Recording focus — Audio/Text wide + Annotations narrow right
 *
 * ┌─────────────┬──────┐
 * │    Audio     │Annot.│
 * ├─────────────┤──────┤
 * │    Text      │ File │
 * └─────────────┴──────┘
 */
function applyLecture(api: DockviewApi) {
  addPane(api, 'audio');
  addPane(api, 'annotations', { referencePanel: 'audio', direction: 'right' });
  addPane(api, 'text', { referencePanel: 'audio', direction: 'below' });
  addPane(api, 'file', { referencePanel: 'annotations', direction: 'below' });

  const annotationsPanel = api.getPanel('annotations');
  if (annotationsPanel?.group) {
    try {
      annotationsPanel.group.api.setSize({ width: 220 });
    } catch { /* best-effort */ }
  }
}

/**
 * Transcript Review: Editing focus — Text wide + Audio/Annotations right
 *
 * ┌──────────┬──────────┐
 * │          │  Audio   │
 * │   Text   ├──────────┤
 * │          │Annotations│
 * └──────────┴──────────┘
 */
function applyTranscriptReview(api: DockviewApi) {
  addPane(api, 'text');
  addPane(api, 'audio', { referencePanel: 'text', direction: 'right' });
  addPane(api, 'annotations', { referencePanel: 'audio', direction: 'below' });
  addPane(api, 'file', { referencePanel: 'annotations', direction: 'below' });

  const textPanel = api.getPanel('text');
  if (textPanel?.group) {
    try {
      textPanel.group.api.setSize({ width: 650 });
    } catch { /* best-effort */ }
  }
}

/**
 * Research: 2x2 grid for cross-referencing
 *
 * ┌──────────┬──────────┐
 * │  Audio   │   File   │
 * ├──────────┤──────────┤
 * │   Text   │Annotations│
 * └──────────┴──────────┘
 */
function applyResearch(api: DockviewApi) {
  addPane(api, 'audio');
  addPane(api, 'file', { referencePanel: 'audio', direction: 'right' });
  addPane(api, 'text', { referencePanel: 'audio', direction: 'below' });
  addPane(api, 'annotations', { referencePanel: 'file', direction: 'below' });
}

/**
 * Minimal: Pure recording — Audio full + Annotations/Text/File tabbed at bottom
 *
 * ┌──────────────────────┐
 * │        Audio          │
 * ├──────────────────────┤
 * │ [Annotations|Text|File] │
 * └──────────────────────┘
 */
function applyMinimal(api: DockviewApi) {
  addPane(api, 'audio');
  addPane(api, 'annotations', { referencePanel: 'audio', direction: 'below' });
  addPane(api, 'text', { referencePanel: 'annotations', direction: 'within' });
  addPane(api, 'file', { referencePanel: 'annotations', direction: 'within' });

  const audioPanel = api.getPanel('audio');
  if (audioPanel?.group) {
    try {
      audioPanel.group.api.setSize({ height: 500 });
    } catch { /* best-effort */ }
  }
}

const PRESET_BUILDERS: Record<LayoutPresetId, (api: DockviewApi) => void> = {
  classic: applyClassic,
  lecture: applyLecture,
  'transcript-review': applyTranscriptReview,
  research: applyResearch,
  minimal: applyMinimal,
};

export function applyPreset(api: DockviewApi, presetId: LayoutPresetId) {
  clearAll(api);
  PRESET_BUILDERS[presetId](api);
}
