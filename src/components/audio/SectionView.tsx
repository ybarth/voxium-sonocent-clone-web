import { useState, useRef } from 'react';
import type { Section, Chunk } from '../../types';
import { ChunkBar } from './ChunkBar';
import { useProjectStore } from '../../stores/projectStore';

interface SectionViewProps {
  section: Section;
  chunks: Chunk[];
  globalChunkOffset: number;
  currentChunkId: string | null;
  cursorPosition: number;
  onChunkClick: (chunkId: string, fraction: number, e: React.MouseEvent) => void;
}

export function SectionView({
  section,
  chunks,
  globalChunkOffset,
  currentChunkId,
  cursorPosition,
  onChunkClick,
}: SectionViewProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedChunkIds = useProjectStore((s) => s.selection.selectedChunkIds);
  const renameSection = useProjectStore((s) => s.renameSection);

  const handleDoubleClick = () => {
    setIsEditingName(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleNameSubmit = () => {
    const value = inputRef.current?.value.trim();
    if (value) renameSection(section.id, value);
    setIsEditingName(false);
  };

  const selectedCount = chunks.filter((c) => selectedChunkIds.has(c.id)).length;

  return (
    <div
      style={{
        marginBottom: '6px',
        backgroundColor: section.backgroundColor ?? '#1a1a2e',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
      {/* Section header */}
      <div
        style={{
          padding: '4px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backgroundColor: 'rgba(255,255,255,0.03)',
        }}
        onDoubleClick={handleDoubleClick}
      >
        {isEditingName ? (
          <input
            ref={inputRef}
            defaultValue={section.name}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
              if (e.key === 'Escape') setIsEditingName(false);
            }}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '4px',
              padding: '2px 8px',
              color: '#e0e0e0',
              fontSize: '13px',
              fontWeight: 600,
              outline: 'none',
            }}
          />
        ) : (
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#a0a0b0',
              cursor: 'default',
            }}
          >
            {section.name}
          </span>
        )}
        <span style={{ fontSize: '11px', color: '#606070', marginLeft: 'auto' }}>
          {chunks.length} chunk{chunks.length !== 1 ? 's' : ''}
          {selectedCount > 0 && (
            <span style={{ color: '#3B82F6', marginLeft: '6px' }}>
              ({selectedCount} selected)
            </span>
          )}
        </span>
      </div>

      {/* Chunk flow layout */}
      <div
        style={{
          padding: '4px 6px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          minHeight: '32px',
        }}
      >
        {chunks.length === 0 ? (
          <div
            style={{
              color: '#505060',
              fontSize: '12px',
              fontStyle: 'italic',
              padding: '20px',
              width: '100%',
              textAlign: 'center',
            }}
          >
            No audio chunks. Import or record audio to get started.
          </div>
        ) : (
          chunks.map((chunk, idx) => (
            <ChunkBar
              key={chunk.id}
              chunk={chunk}
              chunkNumber={globalChunkOffset + idx + 1}
              sectionChunkNumber={idx + 1}
              isSelected={selectedChunkIds.has(chunk.id)}
              isCurrent={chunk.id === currentChunkId}
              cursorPosition={chunk.id === currentChunkId ? cursorPosition : 0}
              onChunkClick={onChunkClick}
            />
          ))
        )}
      </div>
    </div>
  );
}
