import { useCallback, useEffect, useRef } from 'react';
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
  type PanelImperativeHandle,
} from 'react-resizable-panels';
import { ColorKeySidebar } from '../sidebar/ColorKeySidebar';
import { Toolbar } from '../toolbar/Toolbar';
import { StatusBar } from './StatusBar';
import { DockviewLayout } from './DockviewLayout';
import { useLayoutStore } from '../../stores/layoutStore';

export function AppLayout() {
  const sidebarRef = useRef<PanelImperativeHandle>(null);
  const setSidebarPanelApi = useLayoutStore((s) => s.setSidebarPanelApi);
  const setSidebarCollapsed = useLayoutStore((s) => s.setSidebarCollapsed);

  useEffect(() => {
    if (sidebarRef.current) {
      setSidebarPanelApi(sidebarRef.current);
    }
  }, [setSidebarPanelApi]);

  const handleSidebarResize = useCallback(() => {
    if (sidebarRef.current) {
      setSidebarCollapsed(sidebarRef.current.isCollapsed());
    }
  }, [setSidebarCollapsed]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#0d0d18',
        color: '#e0e0e0',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
      }}
    >
      <Toolbar />

      <PanelGroup orientation="horizontal" style={{ flex: 1, minHeight: 0 }}>
        {/* Left sidebar - Color Key */}
        <Panel
          panelRef={sidebarRef}
          defaultSize="14%"
          minSize="120px"
          maxSize="30%"
          collapsible
          onResize={handleSidebarResize}
        >
          <div
            style={{
              height: '100%',
              overflow: 'auto',
              backgroundColor: '#0f0f1a',
              borderRight: '1px solid #1a1a2e',
            }}
          >
            <ColorKeySidebar />
          </div>
        </Panel>
        <PanelResizeHandle
          style={{
            width: '4px',
            backgroundColor: '#1a1a2e',
            cursor: 'col-resize',
            transition: 'background-color 0.15s',
          }}
        />

        {/* Main content area - managed by dockview */}
        <Panel defaultSize="86%" minSize="50%">
          <DockviewLayout />
        </Panel>
      </PanelGroup>

      <StatusBar />
    </div>
  );
}
