interface PlaceholderPaneProps {
  title: string;
  description: string;
  icon: string;
}

export function PlaceholderPane({ title, description, icon }: PlaceholderPaneProps) {
  return (
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
        height: '100%',
        backgroundColor: '#0d0d18',
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
  );
}
