// Maps command IDs to store actions.
// Playback toggle/stop need a callback injected from the hook since they
// involve the usePlayback hook (not accessible from plain functions).

import { useProjectStore } from '../stores/projectStore';

export type TransportCallbacks = {
  togglePlay: () => void;
  stop: () => void;
};

let transportCallbacks: TransportCallbacks | null = null;

export function setTransportCallbacks(cbs: TransportCallbacks) {
  transportCallbacks = cbs;
}

let settingsCallback: (() => void) | null = null;

export function setSettingsCallback(cb: () => void) {
  settingsCallback = cb;
}

export function executeCommand(commandId: string): boolean {
  const state = useProjectStore.getState();
  const { selection, project, playback } = state;
  const selectedIds = Array.from(selection.selectedChunkIds);

  switch (commandId) {
    // --- Navigation ---
    case 'chunk.prev':
      state.navigateChunk('prev');
      return true;
    case 'chunk.next':
      state.navigateChunk('next');
      return true;
    case 'chunk.first':
      state.navigateToStart();
      return true;
    case 'chunk.last':
      state.navigateToEnd();
      return true;
    case 'chunk.firstInSection':
      state.navigateToSectionStart();
      return true;
    case 'chunk.lastInSection':
      state.navigateToSectionEnd();
      return true;

    // --- Selection ---
    case 'selection.extendPrev':
      state.navigateChunk('prev', true);
      return true;
    case 'selection.extendNext':
      state.navigateChunk('next', true);
      return true;
    case 'selection.all':
      state.selectAll();
      return true;
    case 'selection.allInSection': {
      const currentChunk = project.chunks.find(c => c.id === playback.currentChunkId);
      if (currentChunk) state.selectAllInSection(currentChunk.sectionId);
      return true;
    }
    case 'selection.clear':
      state.clearSelection();
      return true;
    case 'selection.invert':
      state.invertSelection();
      return true;

    // --- Section ---
    case 'section.prev':
      state.navigateSection('prev');
      return true;
    case 'section.next':
      state.navigateSection('next');
      return true;
    case 'section.toggleCollapse': {
      const chunk = project.chunks.find(c => c.id === playback.currentChunkId);
      if (chunk) state.toggleSectionCollapse(chunk.sectionId);
      return true;
    }

    // --- Editing ---
    case 'edit.split':
      state.splitChunkAtCursor();
      return true;
    case 'edit.merge':
      if (selectedIds.length >= 2) state.mergeChunks(selectedIds);
      return true;
    case 'edit.mergeSections': {
      const sectionIds = Array.from(selection.selectedSectionIds);
      if (sectionIds.length >= 2) {
        state.mergeMultipleSections(sectionIds);
        state.clearSectionSelection();
      }
      return true;
    }
    case 'edit.delete':
      if (selectedIds.length > 0) state.deleteChunks(selectedIds);
      return true;
    case 'edit.duplicate':
      if (selectedIds.length > 0) state.duplicateChunks(selectedIds);
      return true;

    // --- Nudge ---
    case 'nudge.left':
      if (selectedIds.length > 0) state.nudgeChunks(selectedIds, -1);
      return true;
    case 'nudge.right':
      if (selectedIds.length > 0) state.nudgeChunks(selectedIds, 1);
      return true;
    case 'nudge.toSectionStart':
      if (selectedIds.length > 0) state.nudgeChunksToEdge(selectedIds, 'start');
      return true;
    case 'nudge.toSectionEnd':
      if (selectedIds.length > 0) state.nudgeChunksToEdge(selectedIds, 'end');
      return true;
    case 'nudge.toPrevSection':
      if (selectedIds.length > 0) state.moveChunksToSection(selectedIds, 'prev');
      return true;
    case 'nudge.toNextSection':
      if (selectedIds.length > 0) state.moveChunksToSection(selectedIds, 'next');
      return true;

    // --- Cursor (intra-chunk) ---
    case 'cursor.scrubLeft':
      state.scrubCursor(-0.1);
      return true;
    case 'cursor.scrubRight':
      state.scrubCursor(0.1);
      return true;
    case 'cursor.scrubLeftFine':
      state.scrubCursor(-0.02);
      return true;
    case 'cursor.scrubRightFine':
      state.scrubCursor(0.02);
      return true;
    case 'cursor.toChunkStart':
      if (playback.currentChunkId) state.placeCursorInChunk(playback.currentChunkId, 0);
      return true;
    case 'cursor.toChunkEnd':
      if (playback.currentChunkId) state.placeCursorInChunk(playback.currentChunkId, 1);
      return true;

    // --- Transport ---
    case 'transport.togglePlay':
      transportCallbacks?.togglePlay();
      return true;
    case 'transport.stop':
      transportCallbacks?.stop();
      return true;

    // --- View ---
    case 'view.zoomIn': {
      const nextZoom = (project.settings.zoomLevel ?? 1.0) * 1.2;
      state.updateSettings({ zoomLevel: Math.max(0.2, Math.min(5, nextZoom)) });
      return true;
    }
    case 'view.zoomOut': {
      const nextZoom = (project.settings.zoomLevel ?? 1.0) / 1.2;
      state.updateSettings({ zoomLevel: Math.max(0.2, Math.min(5, nextZoom)) });
      return true;
    }
    case 'view.zoomReset':
      state.updateSettings({ zoomLevel: 1.0 });
      return true;
    case 'view.toggleVisualMode':
      state.updateSettings({
        visualMode: project.settings.visualMode === 'waveform' ? 'flat' : 'waveform',
      });
      return true;

    // --- History ---
    case 'history.undo':
      state.undo();
      return true;
    case 'history.redo':
      state.redo();
      return true;

    // --- Color ---
    case 'color.apply1': case 'color.apply2': case 'color.apply3':
    case 'color.apply4': case 'color.apply5': case 'color.apply6':
    case 'color.apply7': case 'color.apply8': case 'color.apply9': {
      if (selectedIds.length === 0) return true;
      const num = parseInt(commandId.replace('color.apply', ''));
      const colorEntry = project.colorKey.colors.find(c => c.shortcutKey === num);
      if (colorEntry) state.colorChunks(selectedIds, colorEntry.hex);
      return true;
    }
    case 'color.clear':
      if (selectedIds.length > 0) state.colorChunks(selectedIds, null);
      return true;

    // --- Settings ---
    case 'app.openSettings':
      settingsCallback?.();
      return true;

    default:
      return false;
  }
}
