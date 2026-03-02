import { useEffect, useRef } from 'react';
import { useKeybindingStore } from '../stores/keybindingStore';
import { useProjectStore } from '../stores/projectStore';
import { COMMAND_REGISTRY } from '../commands/commandRegistry';
import { eventToDescriptor, normalizeDescriptor } from '../commands/keybindingPresets';
import { executeCommand, setTransportCallbacks } from '../commands/commandExecutor';
import { usePlayback } from './usePlayback';

export function useCommandKeybindings() {
  const { togglePlay, stop } = usePlayback();
  const togglePlayRef = useRef(togglePlay);
  const stopRef = useRef(stop);
  togglePlayRef.current = togglePlay;
  stopRef.current = stop;

  // Inject transport callbacks into the executor
  useEffect(() => {
    setTransportCallbacks({
      togglePlay: () => togglePlayRef.current(),
      stop: () => stopRef.current(),
    });
  }, []);

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

      const descriptor = eventToDescriptor(e);
      if (!descriptor) return; // Pure modifier press

      const normalized = normalizeDescriptor(descriptor);
      const reverseMap = useKeybindingStore.getState().getReverseMap();
      const commandId = reverseMap.get(normalized);
      if (!commandId) return;

      const def = COMMAND_REGISTRY[commandId];
      if (!def) return;

      // Audio-pane-only guard
      const focusedPane = useProjectStore.getState().selection.focusedPaneId;
      if (def.audioPaneOnly && focusedPane !== 'audio') {
        // Transport commands (Space) should still work from any pane
        if (commandId === 'transport.togglePlay' || commandId === 'transport.stop') {
          // Allow through
        } else {
          return;
        }
      }

      e.preventDefault();
      executeCommand(commandId);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
