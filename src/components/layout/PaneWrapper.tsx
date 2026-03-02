import { useProjectStore } from '../../stores/projectStore';
import type { PaneId } from '../../types/layout';

interface PaneWrapperProps {
  paneId: PaneId;
  children: React.ReactNode;
}

/**
 * Shared wrapper for all dockview panels.
 * Handles focus tracking (click → setFocusedPane) so individual
 * pane components don't need to wire this up themselves.
 *
 * The pane header (icon + title) is rendered by the custom dockview
 * tab component (PaneTab in DockviewLayout), not here.
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
      {children}
    </div>
  );
}
