import { useEffect, useRef } from 'react';
import { useProjectStore } from '../../stores/projectStore';

interface TextContextMenuProps {
  wordId: string;
  x: number;
  y: number;
  onClose: () => void;
  onShowAlternatives: (wordId: string, x: number, y: number) => void;
  onRetranscribe?: (chunkId: string) => void;
}

export function TextContextMenu({
  wordId,
  x,
  y,
  onClose,
  onShowAlternatives,
  onRetranscribe,
}: TextContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const words = useProjectStore(s => s.project.transcription.words);
  const mappings = useProjectStore(s => s.project.transcription.wordChunkMappings);
  const deleteWords = useProjectStore(s => s.deleteWords);
  const classicMode = useProjectStore(s => s.project.settings.classicMode);

  const word = words.find(w => w.id === wordId);
  const mapping = mappings.find(m => m.wordId === wordId);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
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
  }, [onClose]);

  if (!word) return null;

  const bg = classicMode ? '#ffffff' : '#1e1e2e';
  const border = classicMode ? '#d0d3d8' : '#2a2a3e';
  const text = classicMode ? '#2a2a3a' : '#e0e0e0';

  const itemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '6px 14px',
    background: 'none',
    border: 'none',
    color: text,
    fontSize: '12px',
    textAlign: 'left',
    cursor: 'pointer',
  };

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        backgroundColor: bg,
        border: `1px solid ${border}`,
        borderRadius: '6px',
        padding: '4px 0',
        minWidth: '180px',
        boxShadow: classicMode ? '0 4px 16px rgba(0,0,0,0.15)' : '0 4px 16px rgba(0,0,0,0.5)',
        zIndex: 1050,
      }}
    >
      <button
        onClick={() => { onShowAlternatives(wordId, x, y); onClose(); }}
        style={itemStyle}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = classicMode ? '#e8e9ec' : '#2a2a3e'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        Alternatives for "{word.text}"
      </button>

      {mapping && onRetranscribe && (
        <button
          onClick={() => { onRetranscribe(mapping.chunkId); onClose(); }}
          style={itemStyle}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = classicMode ? '#e8e9ec' : '#2a2a3e'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          Re-transcribe chunk
        </button>
      )}

      <div style={{ height: '1px', backgroundColor: border, margin: '4px 0' }} />

      <button
        onClick={() => { deleteWords([wordId]); onClose(); }}
        style={{ ...itemStyle, color: '#f87171' }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = classicMode ? '#e8e9ec' : '#2a2a3e'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        Delete word
      </button>
    </div>
  );
}
