import { useProjectStore } from '../../stores/projectStore';

export function TakeBanner() {
  const take = useProjectStore((s) => s.take);
  const clearTake = useProjectStore((s) => s.clearTake);
  const moveTakeBack = useProjectStore((s) => s.moveTakeBack);

  if (take.chunkIds.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
        fontSize: '12px',
        color: '#F59E0B',
      }}
    >
      <span>
        Take: {take.chunkIds.length} chunk{take.chunkIds.length !== 1 ? 's' : ''}
      </span>
      <span style={{ color: '#606070' }}>|</span>
      <span style={{ color: '#808090', fontSize: '11px' }}>
        Right-click to move
      </span>
      {take.moved && take.originalPosition && (
        <button
          onClick={moveTakeBack}
          style={{
            background: 'none',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '4px',
            color: '#F59E0B',
            fontSize: '11px',
            padding: '2px 8px',
            cursor: 'pointer',
          }}
        >
          Move back
        </button>
      )}
      <div style={{ flex: 1 }} />
      <button
        onClick={clearTake}
        style={{
          background: 'none',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '4px',
          color: '#808090',
          fontSize: '11px',
          padding: '2px 8px',
          cursor: 'pointer',
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
