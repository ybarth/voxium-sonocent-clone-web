import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DockviewApi } from 'dockview';
import type { LayoutPresetId, PaneId } from '../types/layout';
import { addPane } from '../constants/layoutPresets';

const ALL_PANES: PaneId[] = ['audio', 'text', 'annotations', 'file'];

const DOCKVIEW_LAYOUT_KEY = 'voxium-dockview-layout';

interface SidebarApi {
  collapse: () => void;
  expand: () => void;
  isCollapsed: () => boolean;
}

interface LayoutStore {
  // Persisted state
  locked: boolean;
  activePreset: LayoutPresetId;
  sidebarCollapsed: boolean;
  hiddenPanes: PaneId[];

  // Runtime refs (not persisted)
  dockviewApi: DockviewApi | null;
  sidebarPanelApi: SidebarApi | null;

  // Actions
  setLocked: (locked: boolean) => void;
  toggleLocked: () => void;
  setActivePreset: (preset: LayoutPresetId) => void;
  setDockviewApi: (api: DockviewApi) => void;
  setSidebarPanelApi: (api: SidebarApi) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  togglePane: (paneId: PaneId) => void;
  clearHiddenPanes: () => void;
  persistLayout: () => void;
  getSavedLayout: () => object | null;
}

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set, get) => ({
      locked: true,
      activePreset: 'classic',
      sidebarCollapsed: false,
      hiddenPanes: [],
      dockviewApi: null,
      sidebarPanelApi: null,

      setLocked: (locked) => {
        if (locked) {
          // Persist layout when locking
          const api = get().dockviewApi;
          if (api) {
            try {
              const json = api.toJSON();
              localStorage.setItem(DOCKVIEW_LAYOUT_KEY, JSON.stringify(json));
            } catch (e) {
              console.warn('Failed to persist layout:', e);
            }
          }
        }
        set({ locked });
      },

      toggleLocked: () => {
        get().setLocked(!get().locked);
      },

      setActivePreset: (preset) => set({ activePreset: preset }),

      setDockviewApi: (api) => set({ dockviewApi: api }),

      setSidebarPanelApi: (api) => set({ sidebarPanelApi: api }),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      toggleSidebar: () => {
        const api = get().sidebarPanelApi;
        if (!api) return;
        if (api.isCollapsed()) {
          api.expand();
        } else {
          api.collapse();
        }
      },

      togglePane: (paneId: PaneId) => {
        const { hiddenPanes, dockviewApi: api } = get();
        if (!api) return;

        const isHidden = hiddenPanes.includes(paneId);

        if (isHidden) {
          // Re-show: add pane to the right of the first visible panel
          const firstPanel = api.panels[0];
          const position = firstPanel
            ? { referencePanel: firstPanel.id, direction: 'right' as const }
            : undefined;
          addPane(api, paneId, position);
          set({ hiddenPanes: hiddenPanes.filter((id) => id !== paneId) });
        } else {
          // Hide: guard against hiding the last visible pane
          const visibleCount = ALL_PANES.length - hiddenPanes.length;
          if (visibleCount <= 1) return;

          const panel = api.getPanel(paneId);
          if (panel) {
            panel.api.close();
          }
          set({ hiddenPanes: [...hiddenPanes, paneId] });
        }
      },

      clearHiddenPanes: () => set({ hiddenPanes: [] }),

      persistLayout: () => {
        const api = get().dockviewApi;
        if (!api) return;
        try {
          const json = api.toJSON();
          localStorage.setItem(DOCKVIEW_LAYOUT_KEY, JSON.stringify(json));
        } catch (e) {
          console.warn('Failed to persist layout:', e);
        }
      },

      getSavedLayout: () => {
        try {
          const raw = localStorage.getItem(DOCKVIEW_LAYOUT_KEY);
          if (raw) return JSON.parse(raw);
        } catch {
          // ignore
        }
        return null;
      },
    }),
    {
      name: 'voxium-layout',
      partialize: (state) => ({
        locked: state.locked,
        activePreset: state.activePreset,
        sidebarCollapsed: state.sidebarCollapsed,
        hiddenPanes: state.hiddenPanes,
      }),
    }
  )
);
