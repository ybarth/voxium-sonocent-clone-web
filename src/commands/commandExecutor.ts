// Maps command IDs to store actions.
// Playback toggle/stop need a callback injected from the hook since they
// involve the usePlayback hook (not accessible from plain functions).

import { useProjectStore } from '../stores/projectStore';
import { useLayoutStore } from '../stores/layoutStore';
import { useClipboardStore } from '../stores/clipboardStore';

export type TransportCallbacks = {
  togglePlay: () => void;
  stop: () => void;
};

let transportCallbacks: TransportCallbacks | null = null;

export function setTransportCallbacks(cbs: TransportCallbacks) {
  transportCallbacks = cbs;
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
    case 'transport.toggleLoop':
      state.updateSettings({ loopMode: !project.settings.loopMode });
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
    case 'color.apply10': case 'color.apply11': case 'color.apply12':
    case 'color.apply13': case 'color.apply14': case 'color.apply15':
    case 'color.apply16': case 'color.apply17': case 'color.apply18':
    case 'color.apply19': case 'color.apply20': {
      if (selectedIds.length === 0) return true;
      const idx = parseInt(commandId.replace('color.apply', '')) - 1; // 0-indexed
      const entry = project.colorKey.colors[idx];
      if (entry) state.colorChunks(selectedIds, entry.hex);
      return true;
    }
    case 'color.clear':
      if (selectedIds.length > 0) state.colorChunks(selectedIds, null);
      return true;

    // --- Style / Filter ---
    case 'style.openEditor':
      // This is handled by the UI layer (StyleEditor modal) rather than here
      // The command exists for keybinding registry purposes
      return true;
    case 'filter.clear':
      state.clearFilter();
      return true;
    case 'filter.toggle':
      // UI-layer toggle — the command exists for keybinding purposes
      return true;

    // --- Settings ---
    case 'app.openSettings':
      useLayoutStore.getState().setSettingsOpen(true);
      return true;

    // --- Forms (resolve via active scheme) ---
    case 'form.apply1': case 'form.apply2': case 'form.apply3':
    case 'form.apply4': case 'form.apply5': case 'form.apply6':
    case 'form.apply7': case 'form.apply8': case 'form.apply9': {
      if (selectedIds.length === 0) return true;
      const num = parseInt(commandId.replace('form.apply', ''));
      const form = project.scheme.forms.find((f) => f.shortcutKey === num);
      if (form) state.applyForm(selectedIds, form.id);
      return true;
    }
    case 'form.clear':
      if (selectedIds.length > 0) state.clearForm(selectedIds);
      return true;

    // Scheme/Forge — UI layer handles these
    case 'scheme.switch':
    case 'scheme.openManager':
    case 'forge.open':
      return true;

    // --- Clipboard ---
    case 'edit.cut':
      state.clipboardCut();
      return true;
    case 'edit.copy':
      state.clipboardCopy();
      return true;
    case 'edit.paste':
      state.clipboardPaste();
      return true;
    case 'clipboard.clearAll': {
      useClipboardStore.getState().clearAll();
      return true;
    }
    case 'clipboard.togglePasteMode': {
      const cb = useClipboardStore.getState();
      cb.setPasteMode(cb.pasteMode === 'sticky' ? 'sequential' : 'sticky');
      return true;
    }
    case 'clipboard.toggleInsertionPosition': {
      const cb = useClipboardStore.getState();
      cb.setInsertionPosition(cb.insertionPosition === 'top' ? 'bottom' : 'top');
      return true;
    }
    case 'clipboard.togglePanel':
      // Panel toggle is handled by UI layer (SchemeSidebar); command just exists for keybinding
      return true;
    case 'clipboard.togglePopup':
      useLayoutStore.getState().toggleClipboardPopup();
      return true;
    case 'clipboard.undo':
      useClipboardStore.getState().clipboardUndo();
      return true;
    case 'clipboard.redo':
      useClipboardStore.getState().clipboardRedo();
      return true;

    // --- Selection Checkmarks ---
    case 'selection.toggleCheck':
      if (playback.currentChunkId) state.toggleCheckChunk(playback.currentChunkId);
      return true;
    case 'selection.checkAllSelected':
      state.checkAllSelected();
      return true;
    case 'selection.uncheckAll':
      state.uncheckAll();
      return true;

    // --- Configuration ---
    case 'config.prevConfig': {
      const sectionId = getActiveSectionId(state);
      if (sectionId) state.cycleConfiguration(sectionId, -1);
      return true;
    }
    case 'config.nextConfig': {
      const sectionId = getActiveSectionId(state);
      if (sectionId) state.cycleConfiguration(sectionId, 1);
      return true;
    }
    case 'config.prevVersion': {
      const sectionId = getActiveSectionId(state);
      if (sectionId) {
        const cs = project.sectionConfigs[sectionId];
        if (cs && cs.activeVersionIndex > 0) {
          state.switchVersion(sectionId, cs.activeVersionIndex - 1);
        }
      }
      return true;
    }
    case 'config.nextVersion': {
      const sectionId = getActiveSectionId(state);
      if (sectionId) {
        const cs = project.sectionConfigs[sectionId];
        if (cs && cs.activeVersionIndex < cs.versions.length - 1) {
          state.switchVersion(sectionId, cs.activeVersionIndex + 1);
        }
      }
      return true;
    }

    default:
      return false;
  }
}

/** Get the section ID of the currently focused chunk or first selected section. */
function getActiveSectionId(state: ReturnType<typeof useProjectStore.getState>): string | null {
  if (state.selection.selectedSectionIds.size > 0) {
    return [...state.selection.selectedSectionIds][0];
  }
  if (state.playback.currentChunkId) {
    const chunk = state.project.chunks.find(c => c.id === state.playback.currentChunkId);
    if (chunk) return chunk.sectionId;
  }
  return null;
}
