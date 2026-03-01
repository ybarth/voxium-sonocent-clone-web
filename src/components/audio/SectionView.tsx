import { useState, useRef, useCallback } from 'react';
import type { Section, Chunk, InsertionPoint } from '../../types';
import { ChunkBar } from './ChunkBar';
import { useProjectStore } from '../../stores/projectStore';

interface SectionViewProps {
  section: Section;
  chunks: Chunk[];
  globalChunkOffset: number;
  currentChunkId: string | null;
  cursorPosition: number;
  insertionPoint: InsertionPoint | null;
  onChunkClick: (chunkId: string, fraction: number, e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, sectionId: string, orderIndex: number) => void;
}

export function SectionView({
  section,
  chunks,
  globalChunkOffset,
  currentChunkId,
  cursorPosition,
  insertionPoint,
  onChunkClick,
  onContextMenu,
}: SectionViewProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedChunkIds = useProjectStore((s) => s.selection.selectedChunkIds);
  const renameSection = useProjectStore((s) => s.renameSection);
  const placeCursorAtInsertionPoint = useProjectStore((s) => s.placeCursorAtInsertionPoint);
  const recordingHead = useProjectStore((s) => s.playback.recordingHead);
  const isRecording = useProjectStore((s) => s.playback.isRecording);

  const handleDoubleClick = () => {
    setIsEditingName(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleNameSubmit = () => {
    const value = inputRef.current?.value.trim();
    if (value) renameSection(section.id, value);
    setIsEditingName(false);
  };

  const handleEmptySpaceClick = useCallback(
    (e: React.MouseEvent) => {
      // Only trigger if click was on the container div itself, not a child chunk
      if (e.target === e.currentTarget) {
        placeCursorAtInsertionPoint(section.id, chunks.length);
      }
    },
    [section.id, chunks.length, placeCursorAtInsertionPoint]
  );

  const handleFlowContextMenu = useCallback(
    (e: React.MouseEvent) => {
      // If right-click is on the empty space (not a chunk), use end-of-section
      if (e.target === e.currentTarget) {
        e.preventDefault();
        onContextMenu(e, section.id, chunks.length);
      }
    },
    [section.id, chunks.length, onContextMenu]
  );

  const handleChunkContextMenu = useCallback(
    (e: React.MouseEvent, sectionId: string, orderIndex: number) => {
      e.preventDefault();
      onContextMenu(e, sectionId, orderIndex);
    },
    [onContextMenu]
  );

  const selectedCount = chunks.filter((c) => selectedChunkIds.has(c.id)).length;

  // During recording, show cursor at the recording head position.
  // Otherwise, show user's insertion cursor (only when no chunk is focused).
  const activeRecordingHead =
    isRecording && recordingHead && recordingHead.sectionId === section.id
      ? recordingHead
      : null;
  const activeInsertionPoint =
    !isRecording && insertionPoint && insertionPoint.sectionId === section.id && !currentChunkId
      ? insertionPoint
      : null;
  const cursorPoint = activeRecordingHead ?? activeInsertionPoint;
  const showInsertionCursor = !!cursorPoint;

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
        onClick={handleEmptySpaceClick}
        onContextMenu={handleFlowContextMenu}
        style={{
          padding: '4px 6px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          minHeight: '32px',
          cursor: 'text',
        }}
      >
        {chunks.length === 0 ? (
          showInsertionCursor ? (
            <div style={{ display: 'flex', alignItems: 'center', padding: '6px 0', minHeight: '20px' }}>
              <InsertionCursor />
            </div>
          ) : (
            <div
              style={{
                color: '#505060',
                fontSize: '12px',
                fontStyle: 'italic',
                padding: '20px',
                width: '100%',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              No audio chunks. Import or record audio to get started.
            </div>
          )
        ) : (
          chunks.map((chunk, idx) => (
            <InsertionWrapper
              key={chunk.id}
              showBefore={
                showInsertionCursor
                  ? cursorPoint!.orderIndex === chunk.orderIndex
                  : false
              }
            >
              <ChunkBar
                chunk={chunk}
                chunkNumber={globalChunkOffset + idx + 1}
                sectionChunkNumber={idx + 1}
                isSelected={selectedChunkIds.has(chunk.id)}
                isCurrent={chunk.id === currentChunkId}
                cursorPosition={chunk.id === currentChunkId ? cursorPosition : 0}
                onChunkClick={onChunkClick}
                onContextMenu={handleChunkContextMenu}
              />
            </InsertionWrapper>
          ))
        )}
        {/* Insertion cursor at end of section (only when section has chunks — empty section handled above) */}
        {showInsertionCursor && chunks.length > 0 && cursorPoint!.orderIndex >= chunks.length && (
          <InsertionCursor />
        )}
      </div>
    </div>
  );
}

function InsertionCursor() {
  return (
    <div
      style={{
        width: '2px',
        height: '16px',
        backgroundColor: '#F59E0B',
        boxShadow: '0 0 6px rgba(245,158,11,0.8)',
        borderRadius: '1px',
        animation: 'blink 1s step-end infinite',
        alignSelf: 'center',
        margin: '0 1px',
        flexShrink: 0,
      }}
    >
      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </div>
  );
}

function InsertionWrapper({
  children,
  showBefore,
}: {
  children: React.ReactNode;
  showBefore: boolean;
}) {
  return (
    <>
      {showBefore && <InsertionCursor />}
      {children}
    </>
  );
}
