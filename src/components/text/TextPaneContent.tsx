import { useRef, useEffect } from 'react';
import { SectionTranscript } from './SectionTranscript';
import { useProjectStore } from '../../stores/projectStore';
import { getFlatSectionOrder } from '../../utils/sectionTree';

interface TextPaneContentProps {
  activeWordId: string | null;
  highlightedWordIds: Set<string>;
  onWordClick?: (wordId: string, chunkId: string) => void;
  onWordContextMenu?: (e: React.MouseEvent, wordId: string) => void;
  showChunkBorders?: boolean;
}

export function TextPaneContent({
  activeWordId,
  highlightedWordIds,
  onWordClick,
  onWordContextMenu,
  showChunkBorders = false,
}: TextPaneContentProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sections = useProjectStore(s => s.project.sections);
  const chunks = useProjectStore(s => s.project.chunks);
  const words = useProjectStore(s => s.project.transcription.words);
  const mappings = useProjectStore(s => s.project.transcription.wordChunkMappings);
  const viewMode = useProjectStore(s => s.project.transcription.viewMode);
  const settings = useProjectStore(s => s.project.transcription.settings);
  const speakers = useProjectStore(s => s.project.transcription.speakers);
  const classicMode = useProjectStore(s => s.project.settings.classicMode);

  const activeSections = sections.filter(s => (s.status ?? 'active') === 'active');
  const orderedSections = getFlatSectionOrder(activeSections);

  // Auto-scroll to active word
  useEffect(() => {
    if (!activeWordId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-word-id="${activeWordId}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeWordId]);

  const hasWords = words.length > 0;

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '8px 12px',
      }}
    >
      {!hasWords ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: classicMode ? '#a0a5b0' : '#404050',
            fontSize: '13px',
            textAlign: 'center',
            gap: '8px',
          }}
        >
          <div style={{ fontSize: '28px', opacity: 0.5 }}>T</div>
          <div>No transcription yet</div>
          <div style={{ fontSize: '11px', color: classicMode ? '#b0b5c0' : '#303040' }}>
            Select chunks and click Transcribe to convert audio to text
          </div>
        </div>
      ) : (
        orderedSections.map(section => (
          <SectionTranscript
            key={section.id}
            section={section}
            chunks={chunks}
            words={words}
            mappings={mappings}
            activeWordId={activeWordId}
            highlightedWordIds={highlightedWordIds}
            viewMode={viewMode}
            settings={settings}
            speakers={speakers}
            classicMode={classicMode}
            showChunkBorders={showChunkBorders}
            onWordClick={onWordClick}
            onWordContextMenu={onWordContextMenu}
          />
        ))
      )}
    </div>
  );
}
