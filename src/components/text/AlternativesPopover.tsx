import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { generateAlternatives } from '../../utils/alternativeGenerator';
import type { TranscribedWord, WordAlternative } from '../../types/transcription';

interface AlternativesPopoverProps {
  wordId: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function AlternativesPopover({ wordId, x, y, onClose }: AlternativesPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const words = useProjectStore(s => s.project.transcription.words);
  const updateWord = useProjectStore(s => s.updateWord);
  const classicMode = useProjectStore(s => s.project.settings.classicMode);

  const word = words.find(w => w.id === wordId);
  const [alternatives, setAlternatives] = useState<WordAlternative[]>(word?.alternatives ?? []);
  const [loading, setLoading] = useState(false);

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

  // Load alternatives on mount
  useEffect(() => {
    if (!word) return;
    setLoading(true);
    generateAlternatives(word, words)
      .then(setAlternatives)
      .finally(() => setLoading(false));
  }, [word?.id]);

  if (!word) return null;

  const handleSelect = (alt: WordAlternative) => {
    updateWord(wordId, {
      text: alt.text,
      source: 'edited',
      alternatives: [...word.alternatives, { text: word.text, confidence: word.confidence, category: 'lexical' }],
    });
    onClose();
  };

  const bg = classicMode ? '#ffffff' : '#1e1e2e';
  const border = classicMode ? '#d0d3d8' : '#2a2a3e';
  const text = classicMode ? '#1a1a2a' : '#e0e0e0';
  const dimText = classicMode ? '#808090' : '#606070';

  // Group by category
  const grouped = new Map<string, WordAlternative[]>();
  for (const alt of alternatives) {
    const list = grouped.get(alt.category) ?? [];
    list.push(alt);
    grouped.set(alt.category, list);
  }

  const categoryLabels: Record<string, string> = {
    lexical: 'Different Word',
    grammatical: 'Different Form',
    syntactical: 'Rephrasing',
    formatting: 'Formatting',
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
        borderRadius: '8px',
        padding: '8px 0',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        zIndex: 1100,
      }}
    >
      {/* Current word */}
      <div style={{ padding: '4px 12px', fontSize: '11px', color: dimText, borderBottom: `1px solid ${border}`, marginBottom: '4px' }}>
        Current: <strong style={{ color: text }}>{word.text}</strong>
        <span style={{ marginLeft: '8px' }}>({(word.confidence * 100).toFixed(0)}%)</span>
      </div>

      {loading ? (
        <div style={{ padding: '8px 12px', fontSize: '11px', color: dimText }}>
          Loading alternatives...
        </div>
      ) : alternatives.length === 0 ? (
        <div style={{ padding: '8px 12px', fontSize: '11px', color: dimText }}>
          No alternatives found
        </div>
      ) : (
        Array.from(grouped.entries()).map(([category, alts]) => (
          <div key={category}>
            <div style={{ padding: '4px 12px', fontSize: '9px', color: dimText, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {categoryLabels[category] ?? category}
            </div>
            {alts.map((alt, i) => (
              <button
                key={i}
                onClick={() => handleSelect(alt)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '5px 12px',
                  background: 'none',
                  border: 'none',
                  color: text,
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = classicMode ? '#e8e9ec' : '#2a2a3e'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <span>{alt.text}</span>
                <span style={{ fontSize: '10px', color: dimText }}>
                  {(alt.confidence * 100).toFixed(0)}%
                </span>
              </button>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
