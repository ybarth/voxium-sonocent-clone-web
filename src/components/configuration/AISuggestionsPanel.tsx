// AI Suggestions Panel — Request and display AI-generated division strategies

import { useState, useCallback } from 'react';
import { X, Sparkles, Eye, Check, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import type { AIDivisionSuggestion } from '../../types/configuration';
import { suggestDivisions } from '../../utils/aiDivisionSuggester';

interface AISuggestionsPanelProps {
  sectionId: string;
  onClose: () => void;
}

export function AISuggestionsPanel({ sectionId, onClose }: AISuggestionsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AIDivisionSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const project = useProjectStore((s) => s.project);
  const addConfiguration = useProjectStore((s) => s.addConfiguration);
  const switchConfiguration = useProjectStore((s) => s.switchConfiguration);
  const setPreviewConfig = useProjectStore((s) => s.setPreviewConfig);
  const initSectionConfig = useProjectStore((s) => s.initSectionConfig);

  const handleSuggest = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      // Get audio data for the section
      const sectionChunks = project.chunks
        .filter(c => c.sectionId === sectionId && !c.isDeleted)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      if (sectionChunks.length === 0) {
        setError('No chunks in this section.');
        setLoading(false);
        return;
      }

      const audioBufferId = sectionChunks[0].audioBufferId;
      const bufRef = project.audioBuffers.find(b => b.id === audioBufferId);
      if (!bufRef?.decodedBuffer) {
        setError('Audio buffer not available.');
        setLoading(false);
        return;
      }

      const channelData = bufRef.decodedBuffer.getChannelData(0);
      const sampleRate = bufRef.decodedBuffer.sampleRate;
      const startTime = Math.min(...sectionChunks.map(c => c.startTime));
      const endTime = Math.max(...sectionChunks.map(c => c.endTime));
      const words = project.transcription.words;

      const results = await suggestDivisions(channelData, sampleRate, startTime, endTime, words);
      setSuggestions(results);

      if (results.length === 0) {
        setError('No suggestions generated. Ensure an AI provider is configured.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions.');
    } finally {
      setLoading(false);
    }
  }, [project, sectionId]);

  const handlePreview = useCallback((suggestion: AIDivisionSuggestion) => {
    setPreviewConfig(sectionId, suggestion.configuration);
  }, [sectionId, setPreviewConfig]);

  const handleApply = useCallback((suggestion: AIDivisionSuggestion) => {
    // Ensure config state exists
    if (!project.sectionConfigs[sectionId]) {
      initSectionConfig(sectionId);
    }

    const cs = useProjectStore.getState().project.sectionConfigs[sectionId];
    if (!cs) return;
    const version = cs.versions[cs.activeVersionIndex];
    if (!version) return;

    addConfiguration(sectionId, version.id, suggestion.configuration);
    switchConfiguration(sectionId, version.configurations.length);
    setPreviewConfig(sectionId, null);
  }, [sectionId, project.sectionConfigs, initSectionConfig, addConfiguration, switchConfiguration, setPreviewConfig]);

  return (
    <div style={{
      border: '1px solid rgba(168, 85, 247, 0.2)',
      borderRadius: '6px',
      padding: '8px',
      backgroundColor: 'rgba(168, 85, 247, 0.05)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Sparkles size={12} /> AI Suggestions
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#606070', cursor: 'pointer', padding: '2px' }}>
          <X size={14} />
        </button>
      </div>

      {/* Suggest Button */}
      {suggestions.length === 0 && !loading && (
        <button
          onClick={handleSuggest}
          disabled={loading}
          style={{
            width: '100%',
            padding: '8px',
            fontSize: '12px',
            background: 'rgba(168, 85, 247, 0.2)',
            color: '#c084fc',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Sparkles size={14} /> Suggest Division Strategies
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div style={{
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: '#c084fc',
          fontSize: '11px',
        }}>
          <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
          Analyzing audio & generating strategies...
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '8px',
          fontSize: '11px',
          color: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '3px',
          marginBottom: '8px',
        }}>
          {error}
        </div>
      )}

      {/* Suggestion Cards */}
      {suggestions.map((suggestion) => {
        const isExpanded = expandedId === suggestion.id;
        return (
          <div
            key={suggestion.id}
            style={{
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '4px',
              marginBottom: '6px',
              backgroundColor: 'rgba(0,0,0,0.15)',
            }}
          >
            <div
              onClick={() => setExpandedId(isExpanded ? null : suggestion.id)}
              style={{
                padding: '6px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isExpanded ? <ChevronDown size={12} color="#808090" /> : <ChevronRight size={12} color="#808090" />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#c0c0d0' }}>{suggestion.name}</div>
                <div style={{ fontSize: '10px', color: '#808090' }}>
                  {suggestion.description} &middot; {suggestion.configuration.boundaries.length} boundaries
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); handlePreview(suggestion); }}
                  style={{
                    padding: '2px 6px', fontSize: '10px', background: 'rgba(255,255,255,0.05)',
                    color: '#a0a0b0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '2px',
                  }}
                >
                  <Eye size={10} /> Preview
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleApply(suggestion); }}
                  style={{
                    padding: '2px 6px', fontSize: '10px', background: '#3B82F6',
                    color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '2px',
                  }}
                >
                  <Check size={10} /> Apply
                </button>
              </div>
            </div>

            {/* Expanded reasoning */}
            {isExpanded && (
              <div style={{ padding: '4px 8px 8px 26px', fontSize: '10px', color: '#808090' }}>
                <div style={{ marginBottom: '4px' }}>
                  <strong style={{ color: '#a0a0b0' }}>Reasoning:</strong> {suggestion.reasoning}
                </div>
                {suggestion.signals.length > 0 && (
                  <div>
                    <strong style={{ color: '#a0a0b0' }}>Signals:</strong>{' '}
                    {suggestion.signals.map((s, i) => (
                      <span key={i} style={{
                        display: 'inline-block', padding: '0 4px', margin: '1px 2px',
                        borderRadius: '2px', backgroundColor: 'rgba(168, 85, 247, 0.15)',
                        color: '#c084fc', fontSize: '9px',
                      }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Regenerate button if suggestions exist */}
      {suggestions.length > 0 && !loading && (
        <button
          onClick={handleSuggest}
          style={{
            width: '100%',
            padding: '4px',
            fontSize: '10px',
            background: 'none',
            color: '#808090',
            border: '1px dashed rgba(255,255,255,0.1)',
            borderRadius: '3px',
            cursor: 'pointer',
            marginTop: '4px',
          }}
        >
          Regenerate suggestions
        </button>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
