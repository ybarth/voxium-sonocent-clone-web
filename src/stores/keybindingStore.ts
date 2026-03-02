import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type PresetId,
  type KeybindingMap,
  type KeyDescriptor,
  PRESETS,
  normalizeDescriptor,
} from '../commands/keybindingPresets';

interface KeybindingStore {
  activePresetId: PresetId;
  customBindings: Partial<KeybindingMap>;
  showTooltips: boolean;

  setPreset: (presetId: PresetId) => void;
  setBinding: (commandId: string, descriptor: KeyDescriptor) => void;
  clearBinding: (commandId: string) => void;
  resetToPreset: (presetId: PresetId) => void;
  setShowTooltips: (show: boolean) => void;
  getResolvedBindings: () => KeybindingMap;
  getConflicts: () => Map<string, string[]>;
  getReverseMap: () => Map<string, string>;
}

function resolveBindings(presetId: PresetId, custom: Partial<KeybindingMap>): KeybindingMap {
  const base = PRESETS[presetId === 'custom' ? 'ableton' : presetId];
  return { ...base, ...custom };
}

export const useKeybindingStore = create<KeybindingStore>()(
  persist(
    (set, get) => ({
      activePresetId: 'ableton' as PresetId,
      customBindings: {},
      showTooltips: true,

      setPreset: (presetId) => set({ activePresetId: presetId, customBindings: {} }),

      setBinding: (commandId, descriptor) =>
        set((s) => ({
          customBindings: { ...s.customBindings, [commandId]: descriptor },
          activePresetId: 'custom' as PresetId,
        })),

      clearBinding: (commandId) =>
        set((s) => {
          const next = { ...s.customBindings };
          delete next[commandId];
          return { customBindings: next };
        }),

      resetToPreset: (presetId) => set({ activePresetId: presetId, customBindings: {} }),

      setShowTooltips: (show) => set({ showTooltips: show }),

      getResolvedBindings: () => {
        const { activePresetId, customBindings } = get();
        return resolveBindings(activePresetId, customBindings);
      },

      getConflicts: () => {
        const bindings = get().getResolvedBindings();
        const keyToCommands = new Map<string, string[]>();
        for (const [cmdId, binding] of Object.entries(bindings)) {
          const norm = normalizeDescriptor(binding);
          const list = keyToCommands.get(norm) ?? [];
          list.push(cmdId);
          keyToCommands.set(norm, list);
        }
        const conflicts = new Map<string, string[]>();
        for (const [key, cmds] of keyToCommands) {
          if (cmds.length > 1) conflicts.set(key, cmds);
        }
        return conflicts;
      },

      getReverseMap: () => {
        const bindings = get().getResolvedBindings();
        const reverse = new Map<string, string>();
        for (const [cmdId, binding] of Object.entries(bindings)) {
          const norm = normalizeDescriptor(binding);
          // First command wins (earlier in object iteration order)
          if (!reverse.has(norm)) {
            reverse.set(norm, cmdId);
          }
        }
        return reverse;
      },
    }),
    {
      name: 'voxium-keybindings',
      partialize: (state) => ({
        activePresetId: state.activePresetId,
        customBindings: state.customBindings,
        showTooltips: state.showTooltips,
      }),
    }
  )
);
