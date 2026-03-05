import { Component, type ReactNode } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import type { PaneId } from '../../types/layout';

interface PaneWrapperProps {
  paneId: PaneId;
  children: React.ReactNode;
}

// Error boundary to prevent individual pane crashes from blanking the whole app
class PaneErrorBoundary extends Component<
  { paneId: string; children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`Pane "${this.props.paneId}" crashed:`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '20px', backgroundColor: '#0d0d18', color: '#808090',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px', color: '#ff6b6b' }}>
            Pane Error
          </div>
          <div style={{ fontSize: '11px', opacity: 0.7, maxWidth: '240px', marginBottom: '12px' }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '4px 14px', fontSize: '11px', cursor: 'pointer',
              backgroundColor: '#1a1a2e', color: '#a0a0b0',
              border: '1px solid #2a2a3e', borderRadius: '4px',
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Shared wrapper for all dockview panels.
 * Handles focus tracking (click → setFocusedPane) so individual
 * pane components don't need to wire this up themselves.
 * Includes error boundary to isolate pane crashes.
 */
export function PaneWrapper({ paneId, children }: PaneWrapperProps) {
  const setFocusedPane = useProjectStore((s) => s.setFocusedPane);

  return (
    <div
      onClick={() => setFocusedPane(paneId)}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <PaneErrorBoundary paneId={paneId}>
        {children}
      </PaneErrorBoundary>
    </div>
  );
}
