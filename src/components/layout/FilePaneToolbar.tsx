/**
 * FilePaneToolbar — import button, view toggle, asset selector, progress bar.
 */

import { useCallback, useRef } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import type { DocumentAsset, DocumentImportJobStatus } from '../../types/document';

interface FilePaneToolbarProps {
  selectedAssetId: string | null;
  onSelectAsset: (id: string) => void;
  onImportClick: (files: File[]) => void;
  viewMode: 'original' | 'plain';
  onToggleViewMode: () => void;
}

const STATUS_LABELS: Record<DocumentImportJobStatus, string> = {
  'pending': 'Queued...',
  'parsing': 'Parsing document...',
  'ai-dividing': 'AI analyzing sections...',
  'ai-chunking': 'AI dividing chunks...',
  'ai-expressivity': 'Generating expressivity...',
  'building-words': 'Building words...',
  'generating-tts': 'Generating TTS...',
  'building-coords': 'Building coordinates...',
  'completed': 'Complete',
  'failed': 'Failed',
};

export function FilePaneToolbar({
  selectedAssetId,
  onSelectAsset,
  onImportClick,
  viewMode,
  onToggleViewMode,
}: FilePaneToolbarProps) {
  const classicMode = useProjectStore(s => s.project.settings.classicMode);
  const assets = useProjectStore(s => s.project.documentAssets);
  const jobs = useProjectStore(s => s.project.documentImportJobs);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeJobs = jobs.filter(j => j.status !== 'completed' && j.status !== 'failed');

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) onImportClick(files);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [onImportClick]);

  const bg = classicMode ? '#f8f9fa' : '#0f0f1a';
  const border = classicMode ? '#d0d3d8' : '#1a1a2e';
  const text = classicMode ? '#2a2a3a' : '#a0a0b0';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 8px',
        backgroundColor: bg,
        borderBottom: `1px solid ${border}`,
        fontSize: '11px',
        color: text,
        minHeight: '32px',
      }}
    >
      {/* Import button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: '3px 10px',
          fontSize: '11px',
          backgroundColor: classicMode ? '#e8eaed' : '#1a1a2e',
          color: text,
          border: `1px solid ${border}`,
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Import Document
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.epub,.rtf,.md,.markdown,.txt"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* View mode toggle */}
      <button
        onClick={onToggleViewMode}
        style={{
          padding: '3px 8px',
          fontSize: '10px',
          backgroundColor: 'transparent',
          color: text,
          border: `1px solid ${border}`,
          borderRadius: '4px',
          cursor: 'pointer',
          opacity: 0.7,
        }}
      >
        {viewMode === 'original' ? 'Original' : 'Plain'}
      </button>

      {/* Asset selector */}
      {assets.length > 1 && (
        <select
          value={selectedAssetId || ''}
          onChange={e => onSelectAsset(e.target.value)}
          style={{
            padding: '2px 6px',
            fontSize: '10px',
            backgroundColor: classicMode ? '#e8eaed' : '#1a1a2e',
            color: text,
            border: `1px solid ${border}`,
            borderRadius: '4px',
            flex: 1,
            minWidth: 0,
          }}
        >
          {assets.map(a => (
            <option key={a.id} value={a.id}>
              {a.originalFileName}
            </option>
          ))}
        </select>
      )}

      {/* Progress for active imports */}
      {activeJobs.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
          <span style={{ fontSize: '10px', opacity: 0.7 }}>
            {STATUS_LABELS[activeJobs[0].status]}
          </span>
          <div
            style={{
              width: '60px',
              height: '4px',
              backgroundColor: classicMode ? '#d0d3d8' : '#1a1a2e',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${(activeJobs[0].progress * 100).toFixed(0)}%`,
                height: '100%',
                backgroundColor: '#3B82F6',
                borderRadius: '2px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
