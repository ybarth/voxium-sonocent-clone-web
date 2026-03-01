import { useEffect, useRef } from 'react';
import { useProjectStore } from '../../stores/projectStore';

interface ContextMenuProps {
  x: number;
  y: number;
  sectionId: string;
  orderIndex: number;
  onClose: () => void;
}

export function ContextMenu({ x, y, sectionId, orderIndex, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const take = useProjectStore((s) => s.take);
  const isRecording = useProjectStore((s) => s.playback.isRecording);
  const moveTakeToPosition = useProjectStore((s) => s.moveTakeToPosition);

  const showMoveTake = take.chunkIds.length > 0 && !isRecording;

  useEffect(() => {
    if (!showMoveTake) {
      onClose();
      return;
    }
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose, showMoveTake]);

  if (!showMoveTake) return null;

  const handleMoveTake = () => {
    moveTakeToPosition(sectionId, orderIndex);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        backgroundColor: '#1e1e2e',
        border: '1px solid #2a2a3e',
        borderRadius: '6px',
        padding: '4px 0',
        minWidth: '160px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        zIndex: 1000,
      }}
    >
      <button
        onClick={handleMoveTake}
        style={{
          display: 'block',
          width: '100%',
          padding: '6px 14px',
          background: 'none',
          border: 'none',
          color: '#e0e0e0',
          fontSize: '12px',
          textAlign: 'left',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.backgroundColor = '#2a2a3e';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.backgroundColor = 'transparent';
        }}
      >
        Move take here ({take.chunkIds.length} chunk{take.chunkIds.length !== 1 ? 's' : ''})
      </button>
    </div>
  );
}
