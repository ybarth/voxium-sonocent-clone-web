import { memo, useCallback } from 'react';
import type { TranscribedWord, TextViewMode, ConfidenceLevel } from '../../types/transcription';
import { CONFIDENCE_COLORS, getConfidenceLevel } from '../../types/transcription';
import type { TranscriptionSettings, Speaker } from '../../types/transcription';

interface WordSpanProps {
  word: TranscribedWord;
  chunkId: string;
  isActive: boolean; // currently playing word
  isHighlighted: boolean; // within highlighted range (clause/sentence/etc)
  viewMode: TextViewMode;
  settings: TranscriptionSettings;
  speakers: Speaker[];
  onClick?: (wordId: string, chunkId: string) => void;
  onContextMenu?: (e: React.MouseEvent, wordId: string) => void;
}

export const WordSpan = memo(function WordSpan({
  word,
  chunkId,
  isActive,
  isHighlighted,
  viewMode,
  settings,
  speakers,
  onClick,
  onContextMenu,
}: WordSpanProps) {
  const handleClick = useCallback(() => {
    onClick?.(word.id, chunkId);
  }, [word.id, chunkId, onClick]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu?.(e, word.id);
  }, [word.id, onContextMenu]);

  // Determine background color based on view mode
  let backgroundColor = 'transparent';
  if (viewMode === 'confidence') {
    const effectiveConfidence = (word.contextualConfidence ?? 0) > 0
      ? word.contextualConfidence
      : word.confidence;
    const level: ConfidenceLevel = getConfidenceLevel(effectiveConfidence, settings);
    backgroundColor = CONFIDENCE_COLORS[level];
  } else if (viewMode === 'speaker' && word.speakerId) {
    const speaker = speakers.find(s => s.id === word.speakerId);
    if (speaker) {
      backgroundColor = `${speaker.color}33`; // 20% opacity
    }
  }

  // Active word highlight
  const activeStyle = isActive
    ? { backgroundColor: '#3B82F6', color: '#ffffff', borderRadius: '2px' }
    : {};

  // Highlighted range (e.g., sentence)
  const highlightStyle = isHighlighted && !isActive
    ? { backgroundColor: 'rgba(59, 130, 246, 0.15)' }
    : {};

  // Low confidence underline
  const hasFlag = (word.flags?.length ?? 0) > 0;
  const textDecoration = hasFlag ? 'underline wavy rgba(245, 158, 11, 0.6)' : 'none';

  return (
    <span
      data-word-id={word.id}
      data-chunk-id={chunkId}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      style={{
        cursor: 'pointer',
        padding: '1px 0',
        borderRadius: '2px',
        textDecoration,
        backgroundColor,
        transition: 'background-color 0.1s',
        ...highlightStyle,
        ...activeStyle,
      }}
    >
      {word.text}
    </span>
  );
});
