import { useCallback, useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { usePlayback } from '../../hooks/usePlayback';
import { SectionView } from './SectionView';
import { ContextMenu } from './ContextMenu';
import { TakeBanner } from './TakeBanner';
import { importAudioFile } from '../../utils/importAudio';

interface ContextMenuState {
  x: number;
  y: number;
  sectionId: string;
  orderIndex: number;
}

export function AudioPane() {
  const project = useProjectStore((s) => s.project);
  const currentChunkId = useProjectStore((s) => s.playback.currentChunkId);
  const insertionPoint = useProjectStore((s) => s.playback.insertionPoint);
  const selectChunk = useProjectStore((s) => s.selectChunk);
  const placeCursorInChunk = useProjectStore((s) => s.placeCursorInChunk);

  const { seekToChunk, cursorPosition } = usePlayback();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const orderedSections = [...project.sections].sort(
    (a, b) => a.orderIndex - b.orderIndex
  );

  const handleChunkClick = useCallback(
    (chunkId: string, fraction: number, e: React.MouseEvent) => {
      const mode = e.shiftKey ? 'range' : (e.ctrlKey || e.metaKey) ? 'toggle' : 'replace';
      selectChunk(chunkId, mode);
      placeCursorInChunk(chunkId, fraction);
      const chunk = project.chunks.find((c) => c.id === chunkId);
      if (chunk) {
        const offsetInChunk = (chunk.endTime - chunk.startTime) * fraction;
        seekToChunk(chunkId, offsetInChunk);
      }
    },
    [selectChunk, placeCursorInChunk, seekToChunk, project.chunks]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, sectionId: string, orderIndex: number) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, sectionId, orderIndex });
    },
    []
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('audio/')
    );
    for (const file of files) {
      importAudioFile(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  let globalOffset = 0;

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      style={{
        flex: 1,
        overflow: 'auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <TakeBanner />
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {orderedSections.map((section) => {
          const sectionChunks = project.chunks
            .filter((c) => c.sectionId === section.id && !c.isDeleted)
            .sort((a, b) => a.orderIndex - b.orderIndex);

          const offset = globalOffset;
          globalOffset += sectionChunks.length;

          return (
            <SectionView
              key={section.id}
              section={section}
              chunks={sectionChunks}
              globalChunkOffset={offset}
              currentChunkId={currentChunkId}
              cursorPosition={cursorPosition}
              insertionPoint={insertionPoint}
              onChunkClick={handleChunkClick}
              onContextMenu={handleContextMenu}
            />
          );
        })}

        {project.chunks.filter((c) => !c.isDeleted).length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              color: '#505060',
              textAlign: 'center',
              border: '2px dashed #303040',
              borderRadius: '12px',
              margin: '20px',
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '16px', opacity: 0.5 }}>
              🎵
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              Drop audio files here
            </div>
            <div style={{ fontSize: '13px' }}>
              or use the Import button / Record button in the toolbar
            </div>
            <div style={{ fontSize: '11px', marginTop: '8px', opacity: 0.6 }}>
              Supports: mp3, wav, m4a, ogg, webm, flac
            </div>
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          sectionId={contextMenu.sectionId}
          orderIndex={contextMenu.orderIndex}
          onClose={handleCloseContextMenu}
        />
      )}
    </div>
  );
}
