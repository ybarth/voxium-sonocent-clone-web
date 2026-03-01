import { useCallback } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { usePlayback } from '../../hooks/usePlayback';
import { SectionView } from './SectionView';
import { importAudioFile } from '../../utils/importAudio';

export function AudioPane() {
  const project = useProjectStore((s) => s.project);
  const currentChunkId = useProjectStore((s) => s.playback.currentChunkId);
  const selectChunk = useProjectStore((s) => s.selectChunk);
  const placeCursorInChunk = useProjectStore((s) => s.placeCursorInChunk);
  const setFocusedPane = useProjectStore((s) => s.setFocusedPane);

  const { seekToChunk, cursorPosition } = usePlayback();

  const orderedSections = [...project.sections].sort(
    (a, b) => a.orderIndex - b.orderIndex
  );

  const handleChunkClick = useCallback(
    (chunkId: string, fraction: number, e: React.MouseEvent) => {
      // Determine selection mode
      const mode = e.shiftKey ? 'range' : (e.ctrlKey || e.metaKey) ? 'toggle' : 'replace';
      selectChunk(chunkId, mode);
      // Place cursor at the exact click position within the chunk
      placeCursorInChunk(chunkId, fraction);
      // Seek playback engine to this point
      const chunk = project.chunks.find((c) => c.id === chunkId);
      if (chunk) {
        const offsetInChunk = (chunk.endTime - chunk.startTime) * fraction;
        seekToChunk(chunkId, offsetInChunk);
      }
    },
    [selectChunk, placeCursorInChunk, seekToChunk, project.chunks]
  );

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
      onClick={() => setFocusedPane('audio')}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '8px',
        minHeight: 0,
      }}
    >
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
            onChunkClick={handleChunkClick}
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
  );
}
