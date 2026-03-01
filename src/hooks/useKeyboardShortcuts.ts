import { useEffect, useRef } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { usePlayback } from './usePlayback';

export function useKeyboardShortcuts() {
  const { togglePlay } = usePlayback();
  const togglePlayRef = useRef(togglePlay);
  togglePlayRef.current = togglePlay;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      const state = useProjectStore.getState();
      const { selection, project } = state;
      const selectedIds = Array.from(selection.selectedChunkIds);

      // Global: Ctrl+Space
      if (e.code === 'Space' && ctrl) {
        e.preventDefault();
        togglePlayRef.current();
        return;
      }

      // Global: Ctrl+Z
      if (ctrl && e.key === 'z' && !shift) {
        e.preventDefault();
        state.undo();
        return;
      }

      // Global: Ctrl+Y / Ctrl+Shift+Z
      if (ctrl && (e.key === 'y' || (e.key === 'z' && shift))) {
        e.preventDefault();
        state.redo();
        return;
      }

      // Global: Ctrl+Shift+W — toggle visual mode
      if (ctrl && shift && e.key === 'W') {
        e.preventDefault();
        state.updateSettings({
          visualMode: project.settings.visualMode === 'waveform' ? 'flat' : 'waveform',
        });
        return;
      }

      // Zoom: Ctrl/Cmd + + / - / 0
      if (ctrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        const nextZoom = (project.settings.zoomLevel ?? 1.0) * 1.2;
        state.updateSettings({ zoomLevel: Math.max(0.2, Math.min(5, nextZoom)) });
        return;
      }
      if (ctrl && e.key === '-') {
        e.preventDefault();
        const nextZoom = (project.settings.zoomLevel ?? 1.0) / 1.2;
        state.updateSettings({ zoomLevel: Math.max(0.2, Math.min(5, nextZoom)) });
        return;
      }
      if (ctrl && e.key === '0') {
        e.preventDefault();
        state.updateSettings({ zoomLevel: 1.0 });
        return;
      }

      // Non-audio-pane: only Space
      if (selection.focusedPaneId !== 'audio') {
        if (e.code === 'Space') {
          e.preventDefault();
          togglePlayRef.current();
        }
        return;
      }

      // --- Audio pane ---

      if (e.code === 'Space' && !ctrl) {
        e.preventDefault();
        togglePlayRef.current();
        return;
      }

      // Arrow left/right — navigate chunks; Shift extends selection
      if (e.key === 'ArrowLeft' && !ctrl) {
        e.preventDefault();
        state.navigateChunk('prev', shift);
        return;
      }
      if (e.key === 'ArrowRight' && !ctrl) {
        e.preventDefault();
        state.navigateChunk('next', shift);
        return;
      }

      // Ctrl+Arrow / PageUp/Down — section nav
      if ((e.key === 'ArrowLeft' && ctrl) || e.key === 'PageUp') {
        e.preventDefault();
        state.navigateSection('prev');
        return;
      }
      if ((e.key === 'ArrowRight' && ctrl) || e.key === 'PageDown') {
        e.preventDefault();
        state.navigateSection('next');
        return;
      }

      if (e.key === 'Home') {
        e.preventDefault();
        state.navigateToStart();
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        state.navigateToEnd();
        return;
      }

      // Delete
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        state.deleteChunks(selectedIds);
        return;
      }

      // Split — Ctrl+T — splits at the cursor position
      if (ctrl && e.key === 't') {
        e.preventDefault();
        state.splitChunkAtCursor();
        return;
      }

      // Merge — Ctrl+M
      if (ctrl && e.key === 'm') {
        e.preventDefault();
        if (selectedIds.length >= 2) {
          state.mergeChunks(selectedIds);
        }
        return;
      }

      // Select all — Ctrl+A / Ctrl+Shift+A
      if (ctrl && e.key === 'a') {
        e.preventDefault();
        if (shift) {
          state.selectAll();
        } else {
          const playback = state.playback;
          const currentChunk = project.chunks.find((c) => c.id === playback.currentChunkId);
          if (currentChunk) {
            state.selectAllInSection(currentChunk.sectionId);
          }
        }
        return;
      }

      // Color shortcuts 1-9, 0
      if (!ctrl && !shift && e.key >= '0' && e.key <= '9' && selectedIds.length > 0) {
        e.preventDefault();
        const num = parseInt(e.key);
        if (num === 0) {
          state.colorChunks(selectedIds, null);
        } else {
          const colorEntry = project.colorKey.colors.find((c) => c.shortcutKey === num);
          if (colorEntry) {
            state.colorChunks(selectedIds, colorEntry.hex);
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
