import { useEffect, useRef, useCallback } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { importMultipleFiles } from '../../utils/importAudio';
import type { StyleEditorTarget } from '../color/StyleEditor';
import type { ChunkStyle } from '../../types';

interface ContextMenuProps {
  x: number;
  y: number;
  sectionId: string;
  orderIndex: number;
  onClose: () => void;
  onEditStyle?: (target: StyleEditorTarget, initialStyle: ChunkStyle | null, initialColor: string) => void;
}

export function ContextMenu({ x, y, sectionId, orderIndex, onClose, onEditStyle }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importModeRef = useRef<'section' | 'subsection'>('section');
  const take = useProjectStore((s) => s.take);
  const isRecording = useProjectStore((s) => s.playback.isRecording);
  const moveTakeToPosition = useProjectStore((s) => s.moveTakeToPosition);
  const splitSectionAtChunk = useProjectStore((s) => s.splitSectionAtChunk);

  const selectedChunkIds = useProjectStore((s) => s.selection.selectedChunkIds);
  const chunks = useProjectStore((s) => s.project.chunks);
  const cm = useProjectStore((s) => s.project.settings.classicMode);
  const clipboardCut = useProjectStore((s) => s.clipboardCut);
  const clipboardCopy = useProjectStore((s) => s.clipboardCopy);
  const clipboardPaste = useProjectStore((s) => s.clipboardPaste);
  const clipboardMode = useProjectStore((s) => s.clipboard.mode);
  const deleteChunks = useProjectStore((s) => s.deleteChunks);

  const showMoveTake = take.chunkIds.length > 0 && !isRecording;

  // Check if cursor is in this section for split
  const cursorChunk = useProjectStore((s) => {
    const chunk = s.project.chunks.find((c) => c.id === s.playback.currentChunkId);
    return chunk?.sectionId === sectionId ? chunk : null;
  });

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
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

  const handleMoveTake = () => {
    moveTakeToPosition(sectionId, orderIndex);
    onClose();
  };

  const handleSplitHere = () => {
    if (cursorChunk) {
      splitSectionAtChunk(sectionId, cursorChunk.orderIndex);
    }
    onClose();
  };

  const handleImportAsSections = () => {
    importModeRef.current = 'section';
    fileInputRef.current?.click();
  };

  const handleImportAsSubsections = () => {
    importModeRef.current = 'subsection';
    fileInputRef.current?.click();
  };

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    await importMultipleFiles(Array.from(files), {
      afterSectionId: sectionId,
      parentId: importModeRef.current === 'subsection' ? sectionId : null,
      asSubsections: importModeRef.current === 'subsection',
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  }, [sectionId, onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        backgroundColor: cm ? '#ffffff' : '#1e1e2e',
        border: cm ? '1px solid #d0d3d8' : '1px solid #2a2a3e',
        borderRadius: '6px',
        padding: '4px 0',
        minWidth: '200px',
        boxShadow: cm ? '0 4px 16px rgba(0,0,0,0.15)' : '0 4px 16px rgba(0,0,0,0.5)',
        zIndex: 1000,
      }}
    >
      {showMoveTake && (
        <CtxMenuItem
          label={`Move take here (${take.chunkIds.length} chunk${take.chunkIds.length !== 1 ? 's' : ''})`}
          onClick={handleMoveTake}
        />
      )}

      {cursorChunk && (
        <CtxMenuItem label="Split Section Here" onClick={handleSplitHere} />
      )}

      {(showMoveTake || cursorChunk) && <CtxMenuDivider />}

      {onEditStyle && selectedChunkIds.size > 0 && (() => {
        const ids = Array.from(selectedChunkIds);
        const firstChunk = chunks.find((c) => c.id === ids[0]);
        const initialStyle = firstChunk?.style ?? null;
        const initialColor = firstChunk?.color ?? '#3B82F6';
        return (
          <>
            <CtxMenuItem
              label={`Edit Style\u2026 (${ids.length} chunk${ids.length !== 1 ? 's' : ''})`}
              onClick={() => {
                onEditStyle({ type: 'chunks', ids }, initialStyle, initialColor);
                onClose();
              }}
            />
            <CtxMenuDivider />
          </>
        );
      })()}

      {/* Cut / Copy / Paste / Delete */}
      {selectedChunkIds.size > 0 && (
        <CtxMenuItem
          label={`Cut (${selectedChunkIds.size} chunk${selectedChunkIds.size !== 1 ? 's' : ''})`}
          shortcut="Ctrl+X"
          onClick={() => { clipboardCut(); onClose(); }}
        />
      )}
      {selectedChunkIds.size > 0 && (
        <CtxMenuItem
          label={`Copy (${selectedChunkIds.size} chunk${selectedChunkIds.size !== 1 ? 's' : ''})`}
          shortcut="Ctrl+C"
          onClick={() => { clipboardCopy(); onClose(); }}
        />
      )}
      {clipboardMode && (
        <CtxMenuItem
          label="Paste"
          shortcut="Ctrl+V"
          onClick={() => { clipboardPaste(); onClose(); }}
        />
      )}
      {selectedChunkIds.size > 0 && (
        <CtxMenuItem
          label={`Delete (${selectedChunkIds.size} chunk${selectedChunkIds.size !== 1 ? 's' : ''})`}
          shortcut="Del"
          danger
          onClick={() => { deleteChunks(Array.from(selectedChunkIds)); onClose(); }}
        />
      )}

      {(selectedChunkIds.size > 0 || clipboardMode) && <CtxMenuDivider />}

      <CtxMenuItem label="Import as Section(s) Here" onClick={handleImportAsSections} />
      <CtxMenuItem label="Import as Subsection(s)" onClick={handleImportAsSubsections} />

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}

function CtxMenuItem({ label, onClick, shortcut, danger }: { label: string; onClick: () => void; shortcut?: string; danger?: boolean }) {
  const cm = useProjectStore((s) => s.project.settings.classicMode);
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '6px 14px',
        background: 'none',
        border: 'none',
        color: danger ? '#f87171' : cm ? '#2a2a3a' : '#e0e0e0',
        fontSize: '12px',
        textAlign: 'left',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = cm ? '#e8e9ec' : '#2a2a3e'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      <span>{label}</span>
      {shortcut && (
        <span style={{ fontSize: '10px', color: cm ? '#9ca0a8' : '#606070', marginLeft: '16px' }}>
          {shortcut}
        </span>
      )}
    </button>
  );
}

function CtxMenuDivider() {
  return <div style={{ height: '1px', backgroundColor: '#2a2a3e', margin: '4px 0' }} />;
}
