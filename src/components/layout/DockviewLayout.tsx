import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  DockviewReact,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
  type IDockviewPanelHeaderProps,
  type DockviewApi,
} from 'dockview';
import { AudioPane } from '../audio/AudioPane';
import { PlaceholderPane } from './PlaceholderPane';
import { PaneWrapper } from './PaneWrapper';
import { TextPane } from '../text/TextPane';
import { ConfigurationPanel } from '../configuration/ConfigurationPanel';
import { useProjectStore } from '../../stores/projectStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { applyPreset } from '../../constants/layoutPresets';
import type { PaneId } from '../../types/layout';

const DOCKVIEW_LAYOUT_KEY = 'voxium-dockview-layout';

// ── Panel Components ────────────────────────────────────────────────

function AudioPanel(_props: IDockviewPanelProps) {
  return (
    <PaneWrapper paneId="audio">
      <AudioPane />
    </PaneWrapper>
  );
}

function TextPanel(_props: IDockviewPanelProps) {
  return (
    <PaneWrapper paneId="text">
      <TextPane />
    </PaneWrapper>
  );
}

function AnnotationsPanel(_props: IDockviewPanelProps) {
  return (
    <PaneWrapper paneId="annotations">
      <PlaceholderPane
        title="Annotations"
        description="Free-form notes linked to audio chunks"
        icon="💬"
      />
    </PaneWrapper>
  );
}

function FilePanel(_props: IDockviewPanelProps) {
  return (
    <PaneWrapper paneId="file">
      <PlaceholderPane
        title="File Pane"
        description="PDF & Markdown viewer with cross-pane linking"
        icon="📄"
      />
    </PaneWrapper>
  );
}

function ConfigPanel(_props: IDockviewPanelProps) {
  return (
    <div style={{ height: '100%', overflow: 'auto', backgroundColor: '#0f0f1a' }}>
      <ConfigurationPanel />
    </div>
  );
}

// ── Custom Tab Component ────────────────────────────────────────────

function PaneTab(props: IDockviewPanelHeaderProps) {
  const paneId = props.params?.paneId as PaneId | undefined;
  const icon = props.params?.icon as string | undefined;
  const focusedPaneId = useProjectStore((s) => s.selection.focusedPaneId);
  const isFocused = paneId ? focusedPaneId === paneId : false;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        width: '100%',
        height: '100%',
        fontSize: '12px',
        fontWeight: 600,
        color: isFocused ? '#93c5fd' : '#606070',
        borderBottom: `2px solid ${isFocused ? '#3B82F6' : '#1a1a2e'}`,
        boxSizing: 'border-box',
        backgroundColor: '#0f0f1a',
        cursor: 'inherit',
      }}
    >
      {icon && <span style={{ fontSize: '14px' }}>{icon}</span>}
      <span>{props.api.title}</span>
    </div>
  );
}

// ── Main Dockview Container ─────────────────────────────────────────

export function DockviewLayout() {
  const locked = useLayoutStore((s) => s.locked);
  const activePreset = useLayoutStore((s) => s.activePreset);
  const setDockviewApi = useLayoutStore((s) => s.setDockviewApi);
  const clearHiddenPanes = useLayoutStore((s) => s.clearHiddenPanes);
  const apiRef = useRef<DockviewApi | null>(null);
  const prevPresetRef = useRef<string>(activePreset);

  const components = useMemo(
    () => ({
      audio: AudioPanel,
      text: TextPanel,
      annotations: AnnotationsPanel,
      file: FilePanel,
      config: ConfigPanel,
    }),
    []
  );

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      const api = event.api;
      apiRef.current = api;
      setDockviewApi(api);

      // Try to restore saved layout
      const saved = useLayoutStore.getState().getSavedLayout();
      if (saved) {
        try {
          api.fromJSON(saved as Parameters<DockviewApi['fromJSON']>[0]);
          return;
        } catch (e) {
          console.warn('Failed to restore saved layout, applying default preset:', e);
        }
      }

      // Apply default preset
      applyPreset(api, useLayoutStore.getState().activePreset);
    },
    [setDockviewApi]
  );

  // Apply preset when it changes (from LayoutToolbar)
  useEffect(() => {
    const api = apiRef.current;
    if (api && activePreset !== prevPresetRef.current) {
      prevPresetRef.current = activePreset;
      applyPreset(api, activePreset);
      clearHiddenPanes();

      // If locked, persist the new preset layout immediately
      if (useLayoutStore.getState().locked) {
        try {
          const json = api.toJSON();
          localStorage.setItem(DOCKVIEW_LAYOUT_KEY, JSON.stringify(json));
        } catch { /* best-effort */ }
      }
    }
  }, [activePreset]);

  return (
    <DockviewReact
      components={components}
      defaultTabComponent={PaneTab}
      onReady={onReady}
      locked={locked}
      disableDnd={locked}
      singleTabMode="fullwidth"
      className="dockview-theme-custom"
    />
  );
}
