import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from 'react-resizable-panels';
import { AudioPane } from '../audio/AudioPane';
import { ColorKeySidebar } from '../sidebar/ColorKeySidebar';
import { Toolbar } from '../toolbar/Toolbar';
import { StatusBar } from './StatusBar';
import { PlaceholderPane } from './PlaceholderPane';
import { useProjectStore } from '../../stores/projectStore';

export function AppLayout() {
  const focusedPaneId = useProjectStore((s) => s.selection.focusedPaneId);
  const setFocusedPane = useProjectStore((s) => s.setFocusedPane);

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
        <Panel defaultSize="14%" minSize="120px" maxSize="30%">
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

        {/* Main content area */}
        <Panel defaultSize="62%" minSize="25%">
          <PanelGroup orientation="vertical">
            {/* Audio Pane (top - primary) */}
            <Panel defaultSize="65%" minSize="20%">
              <div
                onClick={() => setFocusedPane('audio')}
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderBottom: `2px solid ${
                    focusedPaneId === 'audio' ? '#3B82F6' : 'transparent'
                  }`,
                  transition: 'border-color 0.2s',
                }}
              >
                {/* Pane header */}
                <div
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color:
                      focusedPaneId === 'audio' ? '#93c5fd' : '#606070',
                    backgroundColor: '#0f0f1a',
                    borderBottom: '1px solid #1a1a2e',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{ fontSize: '14px' }}>🎧</span>
                  Audio
                </div>
                <AudioPane />
              </div>
            </Panel>

            <PanelResizeHandle
              style={{
                height: '4px',
                backgroundColor: '#1a1a2e',
                cursor: 'row-resize',
                transition: 'background-color 0.15s',
              }}
            />

            {/* Text Pane (bottom) */}
            <Panel defaultSize="35%" minSize="10%">
              <PlaceholderPane
                id="text"
                title="Text Pane"
                description="Linked transcript with bidirectional Audio ↔ Text sync"
                icon="📝"
              />
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle
          style={{
            width: '4px',
            backgroundColor: '#1a1a2e',
            cursor: 'col-resize',
            transition: 'background-color 0.15s',
          }}
        />

        {/* Right panel group - Annotations & File */}
        <Panel defaultSize="24%" minSize="120px" maxSize="40%">
          <PanelGroup orientation="vertical">
            <Panel defaultSize="50%" minSize="15%">
              <PlaceholderPane
                id="annotations"
                title="Annotations"
                description="Free-form notes linked to audio chunks"
                icon="💬"
              />
            </Panel>
            <PanelResizeHandle
              style={{
                height: '4px',
                backgroundColor: '#1a1a2e',
                cursor: 'row-resize',
              }}
            />
            <Panel defaultSize="50%" minSize="15%">
              <PlaceholderPane
                id="file"
                title="File Pane"
                description="PDF & Markdown viewer with cross-pane linking"
                icon="📄"
              />
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>

      <StatusBar />
    </div>
  );
}
