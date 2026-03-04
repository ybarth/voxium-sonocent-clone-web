import { memo, useMemo } from 'react';
import { ChunkParagraph } from './ChunkParagraph';
import type { Chunk, Section } from '../../types';
import type { TranscribedWord, WordChunkMapping, TextViewMode, TranscriptionSettings, Speaker } from '../../types/transcription';

interface SectionTranscriptProps {
  section: Section;
  chunks: Chunk[];
  words: TranscribedWord[];
  mappings: WordChunkMapping[];
  activeWordId: string | null;
  highlightedWordIds: Set<string>;
  viewMode: TextViewMode;
  settings: TranscriptionSettings;
  speakers: Speaker[];
  classicMode: boolean;
  showChunkBorders?: boolean;
  onWordClick?: (wordId: string, chunkId: string) => void;
  onWordContextMenu?: (e: React.MouseEvent, wordId: string) => void;
}

export const SectionTranscript = memo(function SectionTranscript({
  section,
  chunks,
  words,
  mappings,
  activeWordId,
  highlightedWordIds,
  viewMode,
  settings,
  speakers,
  classicMode,
  showChunkBorders = false,
  onWordClick,
  onWordContextMenu,
}: SectionTranscriptProps) {
  const sectionChunks = useMemo(
    () => chunks
      .filter(c => c.sectionId === section.id && !c.isDeleted)
      .sort((a, b) => a.orderIndex - b.orderIndex),
    [chunks, section.id]
  );

  if (sectionChunks.length === 0) return null;

  return (
    <div style={{ marginBottom: '12px' }}>
      {/* Section heading */}
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: classicMode ? '#808090' : '#606070',
          padding: '8px 8px 4px',
          borderBottom: classicMode ? '1px solid #e0e3e8' : '1px solid #1a1a2e',
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        {section.backgroundColor && (
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '2px',
              backgroundColor: section.backgroundColor,
              flexShrink: 0,
            }}
          />
        )}
        {section.name}
      </div>

      {/* Chunk paragraphs */}
      {sectionChunks.map((chunk, i) => (
        <ChunkParagraph
          key={chunk.id}
          chunkId={chunk.id}
          chunkIndex={i}
          chunkColor={chunk.color}
          showChunkBorder={showChunkBorders}
          words={words}
          mappings={mappings}
          activeWordId={activeWordId}
          highlightedWordIds={highlightedWordIds}
          viewMode={viewMode}
          settings={settings}
          speakers={speakers}
          classicMode={classicMode}
          onWordClick={onWordClick}
          onWordContextMenu={onWordContextMenu}
        />
      ))}
    </div>
  );
});
