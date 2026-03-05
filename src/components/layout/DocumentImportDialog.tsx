/**
 * DocumentImportDialog — modal for configuring document import options.
 */

import { useState, useCallback } from 'react';
import type { DocumentImportOptions } from '../../types/document';
import { KOKORO_VOICES } from '../../utils/headTtsProvider';
import { useProjectStore } from '../../stores/projectStore';

interface DocumentImportDialogProps {
  files: File[];
  onConfirm: (options: DocumentImportOptions) => void;
  onCancel: () => void;
}

export function DocumentImportDialog({ files, onConfirm, onCancel }: DocumentImportDialogProps) {
  const classicMode = useProjectStore(s => s.project.settings.classicMode);

  const [divisionMode, setDivisionMode] = useState<DocumentImportOptions['divisionMode']>('ai-topic');
  const [chunkingMode, setChunkingMode] = useState<DocumentImportOptions['chunkingMode']>('ai-prosody');
  const [useCouncil, setUseCouncil] = useState(false);
  const [voiceId, setVoiceId] = useState<string>('af_bella');

  const handleConfirm = useCallback(() => {
    onConfirm({
      divisionMode,
      chunkingMode,
      useCouncil,
      voiceId,
    });
  }, [divisionMode, chunkingMode, useCouncil, voiceId, onConfirm]);

  const bg = classicMode ? '#ffffff' : '#13131f';
  const border = classicMode ? '#d0d3d8' : '#2a2a3e';
  const text = classicMode ? '#1a1a2a' : '#d0d0e0';
  const textDim = classicMode ? '#808090' : '#606070';
  const inputBg = classicMode ? '#f5f6f8' : '#0d0d18';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: bg,
          border: `1px solid ${border}`,
          borderRadius: '8px',
          padding: '20px',
          width: '400px',
          maxWidth: '90vw',
          color: text,
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600 }}>
          Import Document{files.length > 1 ? 's' : ''}
        </h3>

        <div style={{ fontSize: '11px', color: textDim, marginBottom: '16px' }}>
          {files.map(f => f.name).join(', ')}
        </div>

        {/* Division Mode */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '11px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>
            Section Division
          </label>
          <select
            value={divisionMode}
            onChange={e => setDivisionMode(e.target.value as any)}
            style={{
              width: '100%', padding: '6px 8px', fontSize: '11px',
              backgroundColor: inputBg, color: text, border: `1px solid ${border}`,
              borderRadius: '4px',
            }}
          >
            <option value="ai-topic">AI Topic Analysis</option>
            <option value="heading-structure">Heading Structure</option>
            <option value="paragraph-groups">Paragraph Groups</option>
          </select>
        </div>

        {/* Chunking Mode */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '11px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>
            Chunk Division
          </label>
          <select
            value={chunkingMode}
            onChange={e => setChunkingMode(e.target.value as any)}
            style={{
              width: '100%', padding: '6px 8px', fontSize: '11px',
              backgroundColor: inputBg, color: text, border: `1px solid ${border}`,
              borderRadius: '4px',
            }}
          >
            <option value="ai-prosody">AI Prosody</option>
            <option value="sentence">Sentence</option>
            <option value="paragraph">Paragraph</option>
          </select>
        </div>

        {/* Council toggle */}
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            id="council-toggle"
            checked={useCouncil}
            onChange={e => setUseCouncil(e.target.checked)}
          />
          <label htmlFor="council-toggle" style={{ fontSize: '11px' }}>
            Use AI Council (multi-model consensus)
          </label>
        </div>

        {/* Voice selector */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>
            TTS Voice
          </label>
          <select
            value={voiceId}
            onChange={e => setVoiceId(e.target.value)}
            style={{
              width: '100%', padding: '6px 8px', fontSize: '11px',
              backgroundColor: inputBg, color: text, border: `1px solid ${border}`,
              borderRadius: '4px',
            }}
          >
            {KOKORO_VOICES.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 14px', fontSize: '11px',
              backgroundColor: 'transparent', color: textDim,
              border: `1px solid ${border}`, borderRadius: '4px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{
              padding: '6px 14px', fontSize: '11px',
              backgroundColor: '#3B82F6', color: '#fff',
              border: 'none', borderRadius: '4px', cursor: 'pointer',
            }}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
