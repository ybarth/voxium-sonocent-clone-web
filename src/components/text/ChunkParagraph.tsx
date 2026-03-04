import { memo, useMemo } from 'react';
import { WordSpan } from './WordSpan';
import type { TranscribedWord, WordChunkMapping, TextViewMode, TranscriptionSettings, Speaker } from '../../types/transcription';

interface ChunkParagraphProps {
  chunkId: string;
  chunkIndex: number; // for display
  chunkColor?: string;
  showChunkBorder?: boolean;
  words: TranscribedWord[];
  mappings: WordChunkMapping[];
  activeWordId: string | null;
  highlightedWordIds: Set<string>;
  viewMode: TextViewMode;
  settings: TranscriptionSettings;
  speakers: Speaker[];
  classicMode: boolean;
  onWordClick?: (wordId: string, chunkId: string) => void;
  onWordContextMenu?: (e: React.MouseEvent, wordId: string) => void;
}

export const ChunkParagraph = memo(function ChunkParagraph({
  chunkId,
  chunkIndex,
  chunkColor,
  showChunkBorder = false,
  words,
  mappings,
  activeWordId,
  highlightedWordIds,
  viewMode,
  settings,
  speakers,
  classicMode,
  onWordClick,
  onWordContextMenu,
}: ChunkParagraphProps) {
  // Get words for this chunk, ordered by their start fraction
  const chunkWords = useMemo(() => {
    const chunkMappings = mappings
      .filter(m => m.chunkId === chunkId)
      .sort((a, b) => a.startFraction - b.startFraction);

    const wordMap = new Map(words.map(w => [w.id, w]));
    const seen = new Set<string>();
    const result: TranscribedWord[] = [];

    for (const m of chunkMappings) {
      if (seen.has(m.wordId)) continue;
      seen.add(m.wordId);
      const word = wordMap.get(m.wordId);
      if (word) result.push(word);
    }

    return result;
  }, [chunkId, words, mappings]);

  const borderColor = showChunkBorder && chunkColor
    ? chunkColor
    : classicMode ? '#d0d3d8' : '#2a2a3e';
  const borderWidth = showChunkBorder && chunkColor ? '3px' : '2px';

  if (chunkWords.length === 0) {
    return (
      <div
        style={{
          padding: '4px 8px',
          color: classicMode ? '#a0a5b0' : '#404050',
          fontSize: '12px',
          fontStyle: 'italic',
          borderLeft: `${borderWidth} solid ${borderColor}`,
          marginBottom: '2px',
        }}
      >
        Chunk {chunkIndex + 1} — no transcript
      </div>
    );
  }

  return (
    <div
      data-chunk-id={chunkId}
      style={{
        padding: '4px 8px',
        borderLeft: `${borderWidth} solid ${borderColor}`,
        marginBottom: '2px',
        lineHeight: '1.6',
        fontSize: '13px',
        color: classicMode ? '#1a1a2a' : '#d0d0e0',
      }}
    >
      {chunkWords.map((word, i) => (
        <span key={word.id}>
          {i > 0 && ' '}
          <WordSpan
            word={word}
            chunkId={chunkId}
            isActive={word.id === activeWordId}
            isHighlighted={highlightedWordIds.has(word.id)}
            viewMode={viewMode}
            settings={settings}
            speakers={speakers}
            onClick={onWordClick}
            onContextMenu={onWordContextMenu}
          />
        </span>
      ))}
    </div>
  );
});
