import { Lock, Unlock, PanelLeft, Layout } from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';
import { LAYOUT_PRESETS, PANE_CONFIG } from '../../types/layout';
import type { PaneId } from '../../types/layout';

const PANE_IDS = Object.keys(PANE_CONFIG) as PaneId[];

export function LayoutToolbar() {
  const locked = useLayoutStore((s) => s.locked);
  const toggleLocked = useLayoutStore((s) => s.toggleLocked);
  const activePreset = useLayoutStore((s) => s.activePreset);
  const setActivePreset = useLayoutStore((s) => s.setActivePreset);
  const sidebarCollapsed = useLayoutStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
  const hiddenPanes = useLayoutStore((s) => s.hiddenPanes);
  const togglePane = useLayoutStore((s) => s.togglePane);

  const visibleCount = PANE_IDS.length - hiddenPanes.length;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '5px 8px',
          backgroundColor: sidebarCollapsed ? '#1e3a5f' : 'transparent',
          border: '1px solid transparent',
          borderRadius: '5px',
          color: sidebarCollapsed ? '#93c5fd' : '#a0a0b0',
          cursor: 'pointer',
          fontSize: '11px',
          fontWeight: 500,
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          if (!sidebarCollapsed)
            (e.currentTarget as HTMLElement).style.backgroundColor = '#1a1a2e';
        }}
        onMouseLeave={(e) => {
          if (!sidebarCollapsed)
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }}
      >
        <PanelLeft size={14} />
      </button>

      {/* Pane visibility toggles */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          borderLeft: '1px solid #2a2a3e',
          borderRight: '1px solid #2a2a3e',
          paddingLeft: '4px',
          paddingRight: '4px',
          marginLeft: '2px',
          marginRight: '2px',
        }}
      >
        {PANE_IDS.map((paneId) => {
          const config = PANE_CONFIG[paneId];
          const isHidden = hiddenPanes.includes(paneId);
          const isLastVisible = !isHidden && visibleCount <= 1;

          return (
            <button
              key={paneId}
              onClick={() => togglePane(paneId)}
              disabled={isLastVisible}
              title={
                isLastVisible
                  ? `Cannot hide ${config.title} (last visible pane)`
                  : isHidden
                    ? `Show ${config.title}`
                    : `Hide ${config.title}`
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                padding: 0,
                backgroundColor: 'transparent',
                border: '1px solid transparent',
                borderRadius: '4px',
                fontSize: '13px',
                cursor: isLastVisible ? 'not-allowed' : 'pointer',
                opacity: isHidden ? 0.3 : 1,
                transition: 'all 0.15s',
                filter: isHidden ? 'grayscale(1)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isLastVisible)
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#1a1a2e';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              {config.icon}
            </button>
          );
        })}
      </div>

      {/* Layout preset dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Layout size={14} style={{ color: '#606070' }} />
        <select
          value={activePreset}
          onChange={(e) => setActivePreset(e.target.value as typeof activePreset)}
          title="Layout preset"
          style={{
            backgroundColor: '#1a1a2e',
            border: '1px solid #2a2a3e',
            borderRadius: '4px',
            color: '#a0a0b0',
            fontSize: '11px',
            padding: '4px 6px',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {LAYOUT_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Lock/unlock toggle */}
      <button
        onClick={toggleLocked}
        title={locked ? 'Unlock layout (allow rearranging)' : 'Lock layout (save arrangement)'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '5px 8px',
          backgroundColor: locked ? 'transparent' : '#1e3a5f',
          border: `1px solid ${locked ? 'transparent' : '#3B82F6'}`,
          borderRadius: '5px',
          color: locked ? '#a0a0b0' : '#93c5fd',
          cursor: 'pointer',
          fontSize: '11px',
          fontWeight: 500,
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor =
            locked ? '#1a1a2e' : '#1e4a7f';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor =
            locked ? 'transparent' : '#1e3a5f';
        }}
      >
        {locked ? <Lock size={14} /> : <Unlock size={14} />}
        <span>{locked ? 'Locked' : 'Unlocked'}</span>
      </button>
    </div>
  );
}
