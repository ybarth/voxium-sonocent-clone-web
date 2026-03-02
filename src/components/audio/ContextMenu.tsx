import { useEffect, useRef, useCallback } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { importMultipleFiles } from '../../utils/importAudio';

interface ContextMenuProps {
  x: number;
  y: number;
  sectionId: string;
  orderIndex: number;
  onClose: () => void;
}

export function ContextMenu({ x, y, sectionId, orderIndex, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importModeRef = useRef<'section' | 'subsection'>('section');
  const take = useProjectStore((s) => s.take);
  const isRecording = useProjectStore((s) => s.playback.isRecording);
  const moveTakeToPosition = useProjectStore((s) => s.moveTakeToPosition);
  const splitSectionAtChunk = useProjectStore((s) => s.splitSectionAtChunk);

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
        backgroundColor: '#1e1e2e',
        border: '1px solid #2a2a3e',
        borderRadius: '6px',
        padding: '4px 0',
        minWidth: '200px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
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

function CtxMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: '6px 14px',
        background: 'none',
        border: 'none',
        color: '#e0e0e0',
        fontSize: '12px',
        textAlign: 'left',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = '#2a2a3e'; }}
      onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      {label}
    </button>
  );
}

function CtxMenuDivider() {
  return <div style={{ height: '1px', backgroundColor: '#2a2a3e', margin: '4px 0' }} />;
}
