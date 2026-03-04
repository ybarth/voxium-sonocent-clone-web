import { useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import type { ClarificationQuery } from '../../types/transcription';

export function ClarificationPanel() {
  const clarifications = useProjectStore(s => s.project.transcription.clarifications);
  const resolveClarification = useProjectStore(s => s.resolveClarification);
  const dismissClarification = useProjectStore(s => s.dismissClarification);
  const updateWord = useProjectStore(s => s.updateWord);
  const classicMode = useProjectStore(s => s.project.settings.classicMode);

  const unresolvedQueries = clarifications.filter(q => !q.resolved);

  const [isCollapsed, setIsCollapsed] = useState(false);

  if (unresolvedQueries.length === 0) return null;

  const bg = classicMode ? '#f8f9fa' : '#0f0f1a';
  const border = classicMode ? '#d0d3d8' : '#1a1a2e';
  const text = classicMode ? '#1a1a2a' : '#d0d0e0';
  const dimText = classicMode ? '#808090' : '#606070';

  const handleResolve = (query: ClarificationQuery, resolvedText: string) => {
    resolveClarification(query.id, resolvedText);
    updateWord(query.wordId, {
      text: resolvedText,
      source: 'edited',
    });
  };

  return (
    <div
      style={{
        borderTop: `1px solid ${border}`,
        backgroundColor: bg,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '6px 12px',
          background: 'none',
          border: 'none',
          color: '#f59e0b',
          fontSize: '11px',
          fontWeight: 700,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span>{unresolvedQueries.length} Clarification{unresolvedQueries.length !== 1 ? 's' : ''}</span>
        <span style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
          v
        </span>
      </button>

      {!isCollapsed && (
        <div style={{ maxHeight: '200px', overflow: 'auto', padding: '0 12px 8px' }}>
          {unresolvedQueries.map(query => (
            <ClarificationItem
              key={query.id}
              query={query}
              classicMode={classicMode}
              text={text}
              dimText={dimText}
              border={border}
              onResolve={handleResolve}
              onDismiss={() => dismissClarification(query.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ClarificationItem({
  query,
  classicMode,
  text,
  dimText,
  border,
  onResolve,
  onDismiss,
}: {
  query: ClarificationQuery;
  classicMode: boolean;
  text: string;
  dimText: string;
  border: string;
  onResolve: (query: ClarificationQuery, text: string) => void;
  onDismiss: () => void;
}) {
  const [customText, setCustomText] = useState('');

  return (
    <div
      style={{
        padding: '6px 8px',
        marginBottom: '4px',
        backgroundColor: classicMode ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.08)',
        borderRadius: '4px',
        border: `1px solid ${classicMode ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.2)'}`,
      }}
    >
      <div style={{ fontSize: '11px', color: text, marginBottom: '4px' }}>
        {query.question}
      </div>
      <div style={{ fontSize: '10px', color: dimText, marginBottom: '4px', fontStyle: 'italic' }}>
        Context: {query.context}
      </div>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
        {query.suggestions.map((suggestion, i) => (
          <button
            key={i}
            onClick={() => onResolve(query, suggestion)}
            style={{
              padding: '2px 8px',
              fontSize: '10px',
              border: `1px solid ${border}`,
              borderRadius: '3px',
              background: classicMode ? '#ffffff' : '#1a1a2e',
              color: text,
              cursor: 'pointer',
            }}
          >
            {suggestion}
          </button>
        ))}
        <input
          type="text"
          value={customText}
          onChange={e => setCustomText(e.target.value)}
          placeholder="Custom..."
          onKeyDown={e => {
            if (e.key === 'Enter' && customText.trim()) {
              onResolve(query, customText.trim());
            }
          }}
          style={{
            padding: '2px 6px',
            fontSize: '10px',
            border: `1px solid ${border}`,
            borderRadius: '3px',
            background: classicMode ? '#ffffff' : '#1a1a2e',
            color: text,
            width: '80px',
            outline: 'none',
          }}
        />
        <button
          onClick={onDismiss}
          style={{
            padding: '2px 6px',
            fontSize: '9px',
            border: 'none',
            background: 'none',
            color: dimText,
            cursor: 'pointer',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
