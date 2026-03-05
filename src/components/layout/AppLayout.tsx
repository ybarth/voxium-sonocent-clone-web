import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
  type PanelImperativeHandle,
} from 'react-resizable-panels';
import { SchemeSidebar } from '../sidebar/SchemeSidebar';
import { Toolbar } from '../toolbar/Toolbar';
import { StatusBar } from './StatusBar';
import { ProcessingPanel } from './ProcessingPanel';
import { DockviewLayout } from './DockviewLayout';
import { useLayoutStore } from '../../stores/layoutStore';
import { useProjectStore } from '../../stores/projectStore';

export function AppLayout() {
  const sidebarRef = useRef<PanelImperativeHandle>(null);
  const setSidebarPanelApi = useLayoutStore((s) => s.setSidebarPanelApi);
  const setSidebarCollapsed = useLayoutStore((s) => s.setSidebarCollapsed);
  const classicMode = useProjectStore((s) => s.project.settings.classicMode);
  const [processingExpanded, setProcessingExpanded] = useState(true);
  const toggleProcessing = useCallback(() => setProcessingExpanded(p => !p), []);

  // Toggle body class for global CSS overrides
  useEffect(() => {
    document.body.classList.toggle('classic-mode', classicMode);
    return () => { document.body.classList.remove('classic-mode'); };
  }, [classicMode]);

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
        backgroundColor: classicMode ? '#f0f1f3' : '#0d0d18',
        color: classicMode ? '#1a1a2a' : '#e0e0e0',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
        transition: 'background-color 0.3s, color 0.3s',
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
              backgroundColor: classicMode ? '#e8e9ec' : '#0f0f1a',
              borderRight: classicMode ? '1px solid #d0d3d8' : '1px solid #1a1a2e',
              transition: 'background-color 0.3s, border-color 0.3s',
            }}
          >
            <SchemeSidebar />
          </div>
        </Panel>
        <PanelResizeHandle
          style={{
            width: '4px',
            backgroundColor: classicMode ? '#d0d3d8' : '#1a1a2e',
            cursor: 'col-resize',
            transition: 'background-color 0.15s',
          }}
        />

        {/* Main content area - managed by dockview */}
        <Panel defaultSize="86%" minSize="50%">
          <DockviewLayout />
        </Panel>
      </PanelGroup>

      <div style={{ position: 'relative' }}>
        <ProcessingPanel expanded={processingExpanded} onToggle={toggleProcessing} />
        <StatusBar onToggleProcessing={toggleProcessing} processingExpanded={processingExpanded} />
      </div>
    </div>
  );
}
