import { useCallback, useMemo, useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import type { TextViewMode, HighlightGranularity, TranscriptionScope } from '../../types/transcription';

interface TextPaneToolbarProps {
  onTranscribe: (scope: TranscriptionScope) => void;
  isTranscribing: boolean;
  showChunkBorders: boolean;
  onToggleChunkBorders: () => void;
}

export function TextPaneToolbar({
  onTranscribe,
  isTranscribing,
  showChunkBorders,
  onToggleChunkBorders,
}: TextPaneToolbarProps) {
  const viewMode = useProjectStore(s => s.project.transcription.viewMode);
  const setTextViewMode = useProjectStore(s => s.setTextViewMode);
  const highlightGranularities = useProjectStore(s => s.project.transcription.highlightGranularities);
  const setHighlightGranularity = useProjectStore(s => s.setHighlightGranularity);
  const selectedChunkIds = useProjectStore(s => s.selection.selectedChunkIds);
  const selectedSectionIds = useProjectStore(s => s.selection.selectedSectionIds);
  const chunks = useProjectStore(s => s.project.chunks);
  const classicMode = useProjectStore(s => s.project.settings.classicMode);
  const words = useProjectStore(s => s.project.transcription.words);
  const mappings = useProjectStore(s => s.project.transcription.wordChunkMappings);
  const staleChunkIds = useProjectStore(s => s.project.transcription.staleChunkIds);

  const [scopeType, setScopeType] = useState<'selection' | 'section' | 'project'>('selection');

  // Auto-switch scope when sections are selected but no chunks are
  const effectiveScope = useMemo(() => {
    if (scopeType === 'selection' && selectedChunkIds.size === 0 && selectedSectionIds.size > 0) {
      return 'section' as const;
    }
    return scopeType;
  }, [scopeType, selectedChunkIds.size, selectedSectionIds.size]);

  // Resolve chunk IDs for the current scope
  const resolvedChunkIds = useMemo(() => {
    if (effectiveScope === 'selection') {
      return Array.from(selectedChunkIds);
    }
    if (effectiveScope === 'section') {
      const sectionIdSet = selectedSectionIds;
      return chunks
        .filter(c => sectionIdSet.has(c.sectionId) && !c.isDeleted)
        .map(c => c.id);
    }
    return [];
  }, [effectiveScope, selectedChunkIds, selectedSectionIds, chunks]);

  // Count how many of the resolved chunks already have transcription
  const transcribedSelectedCount = useMemo(() => {
    const transcribedChunkIds = new Set(mappings.map(m => m.chunkId));
    return resolvedChunkIds.filter(id => transcribedChunkIds.has(id)).length;
  }, [resolvedChunkIds, mappings]);

  const hasAnyTranscription = words.length > 0;

  const handleTranscribe = useCallback(() => {
    if (effectiveScope === 'selection' || effectiveScope === 'section') {
      if (resolvedChunkIds.length === 0) return;
      onTranscribe({ type: 'chunk', chunkIds: resolvedChunkIds });
    } else if (effectiveScope === 'project') {
      onTranscribe({ type: 'project' });
    }
  }, [effectiveScope, resolvedChunkIds, onTranscribe]);

  const handleRetranscribe = useCallback(() => {
    // Re-transcribe: send only chunks that already have transcription data
    const transcribedChunkIds = new Set(mappings.map(m => m.chunkId));

    if (effectiveScope === 'selection' || effectiveScope === 'section') {
      const ids = resolvedChunkIds.filter(id => transcribedChunkIds.has(id));
      if (ids.length === 0) return;
      onTranscribe({ type: 'chunk', chunkIds: ids });
    } else if (effectiveScope === 'project') {
      onTranscribe({ type: 'project' });
    }
  }, [effectiveScope, resolvedChunkIds, mappings, onTranscribe]);

  const handleRetranscribeStale = useCallback(() => {
    if (staleChunkIds.length === 0) return;
    onTranscribe({ type: 'chunk', chunkIds: [...staleChunkIds] });
  }, [staleChunkIds, onTranscribe]);

  const toggleGranularity = useCallback((g: HighlightGranularity) => {
    const current = new Set(highlightGranularities);
    if (current.has(g)) {
      current.delete(g);
      if (current.size === 0) current.add('word');
    } else {
      current.add(g);
    }
    setHighlightGranularity(Array.from(current));
  }, [highlightGranularities, setHighlightGranularity]);

  const bg = classicMode ? '#f8f9fa' : '#0f0f1a';
  const border = classicMode ? '#d0d3d8' : '#1a1a2e';
  const text = classicMode ? '#2a2a3a' : '#a0a0b0';
  const textDim = classicMode ? '#808090' : '#505060';

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 8px',
    fontSize: '10px',
    fontWeight: 600,
    border: `1px solid ${active ? '#3B82F6' : border}`,
    borderRadius: '4px',
    background: active ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
    color: active ? '#93c5fd' : text,
    cursor: 'pointer',
  });

  const canTranscribe = effectiveScope === 'project' || resolvedChunkIds.length > 0;
  const canRetranscribe = effectiveScope === 'project'
    ? hasAnyTranscription
    : transcribedSelectedCount > 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderBottom: `1px solid ${border}`,
        backgroundColor: bg,
        flexWrap: 'wrap',
      }}
    >
      {/* Transcribe button */}
      <button
        onClick={handleTranscribe}
        disabled={isTranscribing || !canTranscribe}
        style={{
          padding: '4px 10px',
          fontSize: '11px',
          fontWeight: 600,
          border: 'none',
          borderRadius: '4px',
          backgroundColor: isTranscribing ? '#1e40af' : '#3B82F6',
          color: '#ffffff',
          cursor: isTranscribing ? 'wait' : 'pointer',
          opacity: !canTranscribe ? 0.5 : 1,
        }}
      >
        {isTranscribing ? 'Transcribing...' : 'Transcribe'}
      </button>

      {/* Re-transcribe button */}
      <button
        onClick={handleRetranscribe}
        disabled={isTranscribing || !canRetranscribe}
        title="Re-transcribe chunks that already have transcription data"
        style={{
          padding: '4px 10px',
          fontSize: '11px',
          fontWeight: 600,
          border: `1px solid ${border}`,
          borderRadius: '4px',
          backgroundColor: 'transparent',
          color: canRetranscribe ? '#f59e0b' : textDim,
          cursor: canRetranscribe && !isTranscribing ? 'pointer' : 'default',
          opacity: !canRetranscribe ? 0.4 : 1,
        }}
      >
        Re-transcribe{scopeType === 'selection' && transcribedSelectedCount > 0 ? ` (${transcribedSelectedCount})` : ''}
      </button>

      {/* Stale chunks alert */}
      {staleChunkIds.length > 0 && (
        <button
          onClick={handleRetranscribeStale}
          disabled={isTranscribing}
          title="Audio was changed in these chunks — click to re-transcribe"
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 600,
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '4px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#f87171',
            cursor: isTranscribing ? 'wait' : 'pointer',
            animation: 'pulse 2s infinite',
          }}
        >
          {staleChunkIds.length} stale — re-transcribe
        </button>
      )}

      {/* Scope selector */}
      <select
        value={effectiveScope}
        onChange={e => setScopeType(e.target.value as 'selection' | 'section' | 'project')}
        style={{
          background: classicMode ? '#ffffff' : '#1a1a2e',
          border: `1px solid ${border}`,
          borderRadius: '4px',
          color: text,
          fontSize: '10px',
          padding: '3px 6px',
          cursor: 'pointer',
        }}
      >
        <option value="selection">Selected Chunks ({selectedChunkIds.size})</option>
        <option value="section">Selected Sections ({selectedSectionIds.size}{selectedSectionIds.size > 0 ? ` \u2192 ${resolvedChunkIds.length} chunks` : ''})</option>
        <option value="project">Entire Project</option>
      </select>

      <div style={{ width: '1px', height: '16px', backgroundColor: border }} />

      {/* View mode */}
      <span style={{ fontSize: '10px', color: textDim }}>View:</span>
      {(['clean', 'confidence', 'speaker'] as TextViewMode[]).map(mode => (
        <button
          key={mode}
          onClick={() => setTextViewMode(mode)}
          style={btnStyle(viewMode === mode)}
        >
          {mode.charAt(0).toUpperCase() + mode.slice(1)}
        </button>
      ))}

      {/* Chunk color borders toggle */}
      <button
        onClick={onToggleChunkBorders}
        title="Show colored borders matching audio chunk colors"
        style={btnStyle(showChunkBorders)}
      >
        Chunk Colors
      </button>

      <div style={{ width: '1px', height: '16px', backgroundColor: border }} />

      {/* Highlight granularity */}
      <span style={{ fontSize: '10px', color: textDim }}>Highlight:</span>
      {(['word', 'sentence', 'chunk'] as HighlightGranularity[]).map(g => (
        <button
          key={g}
          onClick={() => toggleGranularity(g)}
          style={btnStyle(highlightGranularities.includes(g))}
        >
          {g.charAt(0).toUpperCase() + g.slice(1)}
        </button>
      ))}
    </div>
  );
}
