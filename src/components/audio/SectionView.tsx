import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronRight, ChevronDown, ArrowUp, ArrowDown, MoreHorizontal, GripVertical,
} from 'lucide-react';
import type { Section, Chunk, InsertionPoint } from '../../types';
import { ChunkBar } from './ChunkBar';
import { useProjectStore } from '../../stores/projectStore';
import type { ModifierMode } from '../../hooks/useModifierKeys';

interface SectionViewProps {
  section: Section;
  chunks: Chunk[];
  globalChunkOffset: number;
  currentChunkId: string | null;
  cursorPosition: number;
  insertionPoint: InsertionPoint | null;
  modifierMode: ModifierMode;
  onChunkClick: (chunkId: string, fraction: number, e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, sectionId: string, orderIndex: number) => void;
  hasChildren?: boolean;
  onDragStart?: (sectionId: string) => void;
  onDragOver?: (e: React.DragEvent, sectionId: string) => void;
  onDragEnd?: () => void;
  onDropOnSection?: (targetSectionId: string) => void;
  isDragOver?: boolean;
}

export function SectionView({
  section,
  chunks,
  globalChunkOffset,
  currentChunkId,
  cursorPosition,
  insertionPoint,
  modifierMode,
  onChunkClick,
  onContextMenu,
  hasChildren = false,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDropOnSection,
  isDragOver = false,
}: SectionViewProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const selectedChunkIds = useProjectStore((s) => s.selection.selectedChunkIds);
  const isSectionSelected = useProjectStore((s) => s.selection.selectedSectionIds.has(section.id));
  const selectedSectionCount = useProjectStore((s) => s.selection.selectedSectionIds.size);
  const selectSection = useProjectStore((s) => s.selectSection);
  const renameSection = useProjectStore((s) => s.renameSection);
  const placeCursorAtInsertionPoint = useProjectStore((s) => s.placeCursorAtInsertionPoint);
  const recordingHead = useProjectStore((s) => s.playback.recordingHead);
  const isRecording = useProjectStore((s) => s.playback.isRecording);
  const toggleSectionCollapse = useProjectStore((s) => s.toggleSectionCollapse);
  const moveSectionUp = useProjectStore((s) => s.moveSectionUp);
  const moveSectionDown = useProjectStore((s) => s.moveSectionDown);

  const canCollapse = hasChildren || chunks.length > 0;

  const handleSectionHeaderClick = useCallback((e: React.MouseEvent) => {
    // Only handle selection if clicking the header background, not buttons/inputs
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;

    const mode = e.shiftKey ? 'range' : (e.ctrlKey || e.metaKey) ? 'toggle' : 'replace';
    selectSection(section.id, mode);
  }, [section.id, selectSection]);

  const handleDoubleClick = () => {
    setIsEditingName(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleNameSubmit = () => {
    const value = inputRef.current?.value.trim();
    if (value) renameSection(section.id, value);
    setIsEditingName(false);
  };

  const handleEmptySpaceClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        placeCursorAtInsertionPoint(section.id, chunks.length);
      }
    },
    [section.id, chunks.length, placeCursorAtInsertionPoint]
  );

  const handleFlowContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        e.preventDefault();
        onContextMenu(e, section.id, chunks.length);
      }
    },
    [section.id, chunks.length, onContextMenu]
  );

  const handleChunkContextMenu = useCallback(
    (e: React.MouseEvent, sectionId: string, orderIndex: number) => {
      e.preventDefault();
      onContextMenu(e, sectionId, orderIndex);
    },
    [onContextMenu]
  );

  const handleMenuToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (showMenu) {
      setShowMenu(false);
      setMenuPos(null);
    } else {
      const rect = menuBtnRef.current?.getBoundingClientRect();
      if (rect) {
        setMenuPos({ x: rect.right, y: rect.bottom + 4 });
      }
      setShowMenu(true);
    }
  }, [showMenu]);

  const handleCloseMenu = useCallback(() => {
    setShowMenu(false);
    setMenuPos(null);
  }, []);

  const selectedCount = chunks.filter((c) => selectedChunkIds.has(c.id)).length;

  const activeRecordingHead =
    isRecording && recordingHead && recordingHead.sectionId === section.id
      ? recordingHead
      : null;
  const activeInsertionPoint =
    !isRecording && insertionPoint && insertionPoint.sectionId === section.id && !currentChunkId
      ? insertionPoint
      : null;
  const cursorPoint = activeRecordingHead ?? activeInsertionPoint;
  const showInsertionCursor = !!cursorPoint;

  const totalDuration = chunks.reduce((sum, c) => sum + (c.endTime - c.startTime), 0);
  const formatDuration = (d: number) => {
    const m = Math.floor(d / 60);
    const s = Math.floor(d % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Drag-and-drop handlers for section reordering
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/x-section-id', section.id);
    onDragStart?.(section.id);
  }, [section.id, onDragStart]);

  const handleSectionDragOver = useCallback((e: React.DragEvent) => {
    // Only accept section drags (check dataTransfer types)
    if (e.dataTransfer.types.includes('text/x-section-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      onDragOver?.(e, section.id);
    }
  }, [section.id, onDragOver]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    onDropOnSection?.(section.id);
  }, [section.id, onDropOnSection]);

  const handleDragEndLocal = useCallback(() => {
    onDragEnd?.();
  }, [onDragEnd]);

  return (
    <>
      {/* Drop indicator above this section */}
      {isDragOver && (
        <div
          style={{
            height: '3px',
            backgroundColor: '#3B82F6',
            borderRadius: '2px',
            margin: `0 0 2px ${section.depth * 16}px`,
            boxShadow: '0 0 6px rgba(59,130,246,0.6)',
          }}
        />
      )}
      <div
        onDragOver={handleSectionDragOver}
        onDrop={handleDrop}
        style={{
          marginBottom: '6px',
          backgroundColor: section.backgroundColor ?? '#1a1a2e',
          borderRadius: '4px',
          overflow: 'hidden',
          marginLeft: `${section.depth * 16}px`,
          outline: isSectionSelected ? '2px solid #3B82F6' : 'none',
          outlineOffset: '-2px',
        }}
      >
        {/* Section header */}
        <div
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEndLocal}
          onClick={handleSectionHeaderClick}
          style={{
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            backgroundColor: isSectionSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.03)',
            cursor: 'grab',
          }}
          onDoubleClick={handleDoubleClick}
        >
          {/* Drag handle */}
          <div style={{ color: '#505060', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <GripVertical size={12} />
          </div>

          {/* Collapse/expand chevron */}
          {canCollapse ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleSectionCollapse(section.id); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                color: '#808090',
                cursor: 'pointer',
                padding: '2px',
                borderRadius: '3px',
                flexShrink: 0,
              }}
            >
              {section.isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          ) : (
            <div style={{ width: '18px', flexShrink: 0 }} />
          )}

          {isEditingName ? (
            <input
              ref={inputRef}
              defaultValue={section.name}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSubmit();
                if (e.key === 'Escape') setIsEditingName(false);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '4px',
                padding: '2px 8px',
                color: '#e0e0e0',
                fontSize: '13px',
                fontWeight: 600,
                outline: 'none',
              }}
            />
          ) : (
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#a0a0b0',
                cursor: 'default',
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {section.name}
            </span>
          )}

          <span style={{ fontSize: '11px', color: '#606070', marginLeft: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isSectionSelected && selectedSectionCount >= 2 && (
              <span style={{ color: '#3B82F6', fontSize: '10px' }}>
                {selectedSectionCount} sections &middot; Shift+M to merge
              </span>
            )}
            {chunks.length} chunk{chunks.length !== 1 ? 's' : ''}
            {selectedCount > 0 && (
              <span style={{ color: '#3B82F6' }}>
                ({selectedCount} sel)
              </span>
            )}

            {/* Move up/down buttons */}
            <button
              onClick={(e) => { e.stopPropagation(); moveSectionUp(section.id); }}
              title="Move section up"
              style={iconBtnStyle}
            >
              <ArrowUp size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); moveSectionDown(section.id); }}
              title="Move section down"
              style={iconBtnStyle}
            >
              <ArrowDown size={12} />
            </button>

            {/* Section menu */}
            <button
              ref={menuBtnRef}
              onClick={handleMenuToggle}
              title="Section options"
              style={iconBtnStyle}
            >
              <MoreHorizontal size={14} />
            </button>
          </span>
        </div>

        {/* Collapsed summary or chunk flow */}
        {section.isCollapsed ? (
          <div
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              color: '#606070',
              fontStyle: 'italic',
            }}
          >
            {chunks.length} chunk{chunks.length !== 1 ? 's' : ''} &middot; {formatDuration(totalDuration)}
          </div>
        ) : (
          <div
            onClick={handleEmptySpaceClick}
            onContextMenu={handleFlowContextMenu}
            style={{
              padding: '4px 6px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              minHeight: '32px',
              cursor: 'text',
            }}
          >
            {chunks.length === 0 ? (
              showInsertionCursor ? (
                <div style={{ display: 'flex', alignItems: 'center', padding: '6px 0', minHeight: '20px' }}>
                  <InsertionCursor />
                </div>
              ) : (
                <div
                  style={{
                    color: '#505060',
                    fontSize: '12px',
                    fontStyle: 'italic',
                    padding: '20px',
                    width: '100%',
                    textAlign: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  No audio chunks. Import or record audio to get started.
                </div>
              )
            ) : (
              chunks.map((chunk, idx) => (
                <InsertionWrapper
                  key={chunk.id}
                  showBefore={
                    showInsertionCursor
                      ? cursorPoint!.orderIndex === chunk.orderIndex
                      : false
                  }
                >
                  <ChunkBar
                    chunk={chunk}
                    chunkNumber={globalChunkOffset + idx + 1}
                    sectionChunkNumber={idx + 1}
                    isSelected={selectedChunkIds.has(chunk.id)}
                    isCurrent={chunk.id === currentChunkId}
                    cursorPosition={chunk.id === currentChunkId ? cursorPosition : 0}
                    modifierMode={modifierMode}
                    onChunkClick={onChunkClick}
                    onContextMenu={handleChunkContextMenu}
                  />
                </InsertionWrapper>
              ))
            )}
            {showInsertionCursor && chunks.length > 0 && cursorPoint!.orderIndex >= chunks.length && (
              <InsertionCursor />
            )}
          </div>
        )}
      </div>

      {/* Render menu via portal so it's never clipped */}
      {showMenu && menuPos && createPortal(
        <SectionMenu
          section={section}
          position={menuPos}
          onClose={handleCloseMenu}
        />,
        document.body
      )}
    </>
  );
}

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  background: 'none',
  border: 'none',
  color: '#606070',
  cursor: 'pointer',
  padding: '2px',
  borderRadius: '3px',
};

function SectionMenu({
  section,
  position,
  onClose,
}: {
  section: Section;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const sections = useProjectStore((s) => s.project.sections);
  const playback = useProjectStore((s) => s.playback);
  const moveSectionUp = useProjectStore((s) => s.moveSectionUp);
  const moveSectionDown = useProjectStore((s) => s.moveSectionDown);
  const nestSection = useProjectStore((s) => s.nestSection);
  const unnestSection = useProjectStore((s) => s.unnestSection);
  const splitSectionAtChunk = useProjectStore((s) => s.splitSectionAtChunk);
  const mergeSections = useProjectStore((s) => s.mergeSections);
  const mergeMultipleSections = useProjectStore((s) => s.mergeMultipleSections);
  const deleteSection = useProjectStore((s) => s.deleteSection);
  const removeSection = useProjectStore((s) => s.removeSection);

  // Close on click outside or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Use a short delay so the opening click doesn't immediately close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleKey);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const siblings = sections
    .filter((s) => s.parentId === section.parentId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const sectionIdx = siblings.findIndex((s) => s.id === section.id);
  const prevSibling = sectionIdx > 0 ? siblings[sectionIdx - 1] : null;
  const nextSibling = sectionIdx < siblings.length - 1 ? siblings[sectionIdx + 1] : null;

  // For multi-merge: all siblings from first..this and this..last
  const siblingsAbove = sectionIdx > 0 ? siblings.slice(0, sectionIdx + 1) : [];
  const siblingsBelow = sectionIdx < siblings.length - 1 ? siblings.slice(sectionIdx) : [];
  const canMergeAllAbove = siblingsAbove.length >= 2;
  const canMergeAllBelow = siblingsBelow.length >= 2;

  const canNest = section.depth < 1 && prevSibling !== null;
  const canUnnest = section.parentId !== null;

  const cursorChunk = useProjectStore.getState().project.chunks.find(
    (c) => c.id === playback.currentChunkId
  );
  const canSplit = cursorChunk?.sectionId === section.id;

  // Clamp menu to viewport
  const menuWidth = 190;
  const left = Math.min(position.x, window.innerWidth - menuWidth - 8);
  const top = position.y;

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top,
        left: left - menuWidth,
        backgroundColor: '#1e1e2e',
        border: '1px solid #2a2a3e',
        borderRadius: '6px',
        padding: '4px 0',
        minWidth: `${menuWidth}px`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        zIndex: 10000,
      }}
    >
      <MenuItem label="Move Up" onClick={() => { moveSectionUp(section.id); onClose(); }} />
      <MenuItem label="Move Down" onClick={() => { moveSectionDown(section.id); onClose(); }} />
      <MenuDivider />
      {canNest && (
        <MenuItem
          label="Make Subsection"
          onClick={() => { nestSection(section.id, prevSibling!.id); onClose(); }}
        />
      )}
      {canUnnest && (
        <MenuItem
          label="Promote to Section"
          onClick={() => { unnestSection(section.id); onClose(); }}
        />
      )}
      {(canNest || canUnnest) && <MenuDivider />}
      {canSplit && cursorChunk && (
        <MenuItem
          label="Split Section Here"
          onClick={() => { splitSectionAtChunk(section.id, cursorChunk.orderIndex); onClose(); }}
        />
      )}
      {prevSibling && (
        <MenuItem
          label="Merge with Above"
          onClick={() => { mergeSections(section.id, prevSibling.id); onClose(); }}
        />
      )}
      {nextSibling && (
        <MenuItem
          label="Merge with Below"
          onClick={() => { mergeSections(section.id, nextSibling.id); onClose(); }}
        />
      )}
      {canMergeAllAbove && (
        <MenuItem
          label={`Merge All Above (${siblingsAbove.length})`}
          onClick={() => { mergeMultipleSections(siblingsAbove.map((s) => s.id)); onClose(); }}
        />
      )}
      {canMergeAllBelow && (
        <MenuItem
          label={`Merge All Below (${siblingsBelow.length})`}
          onClick={() => { mergeMultipleSections(siblingsBelow.map((s) => s.id)); onClose(); }}
        />
      )}
      <MenuDivider />
      <MenuItem
        label="Remove Section"
        onClick={() => { removeSection(section.id); onClose(); }}
      />
      <MenuItem
        label="Delete Section"
        danger
        onClick={() => { deleteSection(section.id); onClose(); }}
      />
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: '6px 14px',
        background: 'none',
        border: 'none',
        color: danger ? '#f87171' : '#e0e0e0',
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

function MenuDivider() {
  return <div style={{ height: '1px', backgroundColor: '#2a2a3e', margin: '4px 0' }} />;
}

function InsertionCursor() {
  return (
    <div
      style={{
        width: '2px',
        height: '16px',
        backgroundColor: '#F59E0B',
        boxShadow: '0 0 6px rgba(245,158,11,0.8)',
        borderRadius: '1px',
        animation: 'blink 1s step-end infinite',
        alignSelf: 'center',
        margin: '0 1px',
        flexShrink: 0,
      }}
    >
      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </div>
  );
}

function InsertionWrapper({
  children,
  showBefore,
}: {
  children: React.ReactNode;
  showBefore: boolean;
}) {
  return (
    <>
      {showBefore && <InsertionCursor />}
      {children}
    </>
  );
}
