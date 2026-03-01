import { useProjectStore } from '../../stores/projectStore';

interface PlaceholderPaneProps {
  id: 'text' | 'annotations' | 'file';
  title: string;
  description: string;
  icon: string;
}

export function PlaceholderPane({ id, title, description, icon }: PlaceholderPaneProps) {
  const setFocusedPane = useProjectStore((s) => s.setFocusedPane);
  const focusedPaneId = useProjectStore((s) => s.selection.focusedPaneId);
  const isFocused = focusedPaneId === id;

  return (
    <div
      onClick={() => setFocusedPane(id)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#0d0d18',
      }}
    >
      {/* Pane header */}
      <div
        style={{
          padding: '8px 12px',
          fontSize: '12px',
          fontWeight: 600,
          color: isFocused ? '#93c5fd' : '#606070',
          borderBottom: `2px solid ${isFocused ? '#3B82F6' : '#1a1a2e'}`,
          backgroundColor: '#0f0f1a',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'border-color 0.2s',
        }}
      >
        <span>{icon}</span>
        {title}
      </div>

      {/* Placeholder content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          color: '#404050',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '28px', marginBottom: '12px', opacity: 0.4 }}>
          {icon}
        </div>
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
          {title}
        </div>
        <div style={{ fontSize: '11px', opacity: 0.6, maxWidth: '200px' }}>
          {description}
        </div>
        <div
          style={{
            fontSize: '10px',
            marginTop: '12px',
            padding: '4px 10px',
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: '4px',
            color: '#505060',
          }}
        >
          Coming in Phase 3
        </div>
      </div>
    </div>
  );
}
