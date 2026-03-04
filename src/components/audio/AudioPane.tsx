import { useCallback, useState, useMemo } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { usePlayback } from '../../hooks/usePlayback';
import { SectionView } from './SectionView';
import { ContextMenu } from './ContextMenu';
import { TakeBanner } from './TakeBanner';
import { StyleEditor } from '../color/StyleEditor';
import type { StyleEditorTarget } from '../color/StyleEditor';
import type { ChunkStyle } from '../../types';
import { importMultipleFiles } from '../../utils/importAudio';
import { getFlatSectionOrder, hasCollapsedAncestor } from '../../utils/sectionTree';
import { useModifierKeys, MODIFIER_MODE_META } from '../../hooks/useModifierKeys';

interface ContextMenuState {
  x: number;
  y: number;
  sectionId: string;
  orderIndex: number;
}

interface StyleEditorState {
  target: StyleEditorTarget;
  initialStyle: ChunkStyle | null;
  initialColor: string;
}

export function AudioPane() {
  const project = useProjectStore((s) => s.project);
  const currentChunkId = useProjectStore((s) => s.playback.currentChunkId);
  const insertionPoint = useProjectStore((s) => s.playback.insertionPoint);
  const selectChunk = useProjectStore((s) => s.selectChunk);
  const placeCursorInChunk = useProjectStore((s) => s.placeCursorInChunk);

  const { seekToChunk, cursorPosition } = usePlayback();

  const modifierMode = useModifierKeys();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [styleEditorState, setStyleEditorState] = useState<StyleEditorState | null>(null);

  // Section drag-and-drop state
  const [dragSectionId, setDragSectionId] = useState<string | null>(null);
  const [dropTargetSectionId, setDropTargetSectionId] = useState<string | null>(null);

  const activeSections = useMemo(
    () => project.sections.filter(s => (s.status ?? 'active') === 'active'),
    [project.sections]
  );

  const orderedSections = useMemo(() => getFlatSectionOrder(activeSections), [activeSections]);

  const hiddenSectionIds = useMemo(() => {
    const hidden = new Set<string>();
    for (const section of activeSections) {
      if (hasCollapsedAncestor(activeSections, section.id)) {
        hidden.add(section.id);
      }
    }
    return hidden;
  }, [activeSections]);

  const sectionHasChildren = useMemo(() => {
    const result = new Map<string, boolean>();
    for (const section of activeSections) {
      if (section.parentId) {
        result.set(section.parentId, true);
      }
    }
    return result;
  }, [activeSections]);

  const handleChunkClick = useCallback(
    (chunkId: string, fraction: number, e: React.MouseEvent) => {
      if (useProjectStore.getState().paintbrushMode) {
        useProjectStore.getState().applyPaintbrush(chunkId, 'chunk');
        return;
      }
      const mode = e.shiftKey ? 'range' : (e.ctrlKey || e.metaKey) ? 'toggle' : 'replace';
      selectChunk(chunkId, mode);
      placeCursorInChunk(chunkId, fraction);
      const chunk = project.chunks.find((c) => c.id === chunkId);
      if (chunk) {
        const offsetInChunk = (chunk.endTime - chunk.startTime) * fraction;
        seekToChunk(chunkId, offsetInChunk);
      }
    },
    [selectChunk, placeCursorInChunk, seekToChunk, project.chunks]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, sectionId: string, orderIndex: number) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, sectionId, orderIndex });
    },
    []
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleOpenStyleEditor = useCallback(
    (target: StyleEditorTarget, initialStyle: ChunkStyle | null, initialColor: string) => {
      setStyleEditorState({ target, initialStyle, initialColor });
    },
    []
  );

  const handleApplyStyle = useCallback(
    (style: ChunkStyle, target: StyleEditorTarget) => {
      const store = useProjectStore.getState();
      if (target.type === 'chunks') {
        store.styleChunks(target.ids, style);
      } else if (target.type === 'section') {
        store.setSectionStyle(target.sectionId, style);
      } else if (target.type === 'sections') {
        store.setSectionStyles(target.ids, style);
      }
    },
    []
  );

  const handleCloseStyleEditor = useCallback(() => {
    setStyleEditorState(null);
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't handle file drops if this is a section drag
    if (dragSectionId) return;

    // Check if this is a restore-section drag from the sidebar
    const restoreSectionId = e.dataTransfer.getData('text/x-restore-section-id');
    if (restoreSectionId) {
      useProjectStore.getState().restoreSection(restoreSectionId);
      return;
    }

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('audio/')
    );
    if (files.length > 0) {
      const store = useProjectStore.getState();
      const currentChunk = store.project.chunks.find((c) => c.id === store.playback.currentChunkId);
      const currentSectionId = currentChunk?.sectionId
        ?? store.playback.insertionPoint?.sectionId;

      importMultipleFiles(files, {
        afterSectionId: currentSectionId ?? undefined,
      });
    }
  }, [dragSectionId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Accept both file drops and restore-section drops
    if (e.dataTransfer.types.includes('text/x-restore-section-id')) {
      e.dataTransfer.dropEffect = 'move';
    }
  }, []);

  // --- Section drag-and-drop handlers ---
  const handleSectionDragStart = useCallback((sectionId: string) => {
    setDragSectionId(sectionId);
  }, []);

  const handleSectionDragOver = useCallback((_e: React.DragEvent, sectionId: string) => {
    if (dragSectionId && dragSectionId !== sectionId) {
      setDropTargetSectionId(sectionId);
    }
  }, [dragSectionId]);

  const handleSectionDragEnd = useCallback(() => {
    setDragSectionId(null);
    setDropTargetSectionId(null);
  }, []);

  const handleDropOnSection = useCallback((targetSectionId: string) => {
    if (!dragSectionId || dragSectionId === targetSectionId) {
      setDragSectionId(null);
      setDropTargetSectionId(null);
      return;
    }

    const store = useProjectStore.getState();
    const sections = store.project.sections;
    const draggedSection = sections.find((s) => s.id === dragSectionId);
    const targetSection = sections.find((s) => s.id === targetSectionId);

    if (!draggedSection || !targetSection) {
      setDragSectionId(null);
      setDropTargetSectionId(null);
      return;
    }

    // Only allow reordering among siblings (same parentId)
    if (draggedSection.parentId === targetSection.parentId) {
      store.pushUndo('reorder-sections');

      // Build new sibling order: remove dragged, insert before target
      const siblings = sections
        .filter((s) => s.parentId === draggedSection.parentId)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      const withoutDragged = siblings.filter((s) => s.id !== dragSectionId);
      const targetIdx = withoutDragged.findIndex((s) => s.id === targetSectionId);
      withoutDragged.splice(targetIdx, 0, draggedSection);

      const idToNewOrder = new Map(withoutDragged.map((s, i) => [s.id, i]));

      useProjectStore.setState((state) => ({
        project: {
          ...state.project,
          sections: state.project.sections.map((s) => {
            const newOrder = idToNewOrder.get(s.id);
            return newOrder !== undefined ? { ...s, orderIndex: newOrder } : s;
          }),
          updatedAt: new Date(),
        },
      }));
    }

    setDragSectionId(null);
    setDropTargetSectionId(null);
  }, [dragSectionId]);

  const classicMode = useProjectStore((s) => s.project.settings.classicMode);

  let globalOffset = 0;

  return (
    <div
      onDrop={handleFileDrop}
      onDragOver={handleDragOver}
      style={{
        flex: 1,
        overflow: 'auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: classicMode ? '#f0f1f3' : undefined,
        transition: 'background-color 0.3s',
      }}
    >
      <TakeBanner />
      <div style={{ flex: 1, overflow: 'auto', padding: classicMode ? '6px' : '8px' }}>
        {orderedSections.map((section) => {
          if (hiddenSectionIds.has(section.id)) return null;

          const sectionChunks = project.chunks
            .filter((c) => c.sectionId === section.id && !c.isDeleted)
            .sort((a, b) => a.orderIndex - b.orderIndex);

          const offset = globalOffset;
          globalOffset += sectionChunks.length;

          return (
            <SectionView
              key={section.id}
              section={section}
              chunks={sectionChunks}
              globalChunkOffset={offset}
              currentChunkId={currentChunkId}
              cursorPosition={cursorPosition}
              insertionPoint={insertionPoint}
              modifierMode={modifierMode}
              onChunkClick={handleChunkClick}
              onContextMenu={handleContextMenu}
              hasChildren={sectionHasChildren.get(section.id) ?? false}
              onDragStart={handleSectionDragStart}
              onDragOver={handleSectionDragOver}
              onDragEnd={handleSectionDragEnd}
              onDropOnSection={handleDropOnSection}
              isDragOver={dropTargetSectionId === section.id}
              onEditStyle={handleOpenStyleEditor}
            />
          );
        })}

        {(() => {
          const activeSectionIds = new Set(activeSections.map(s => s.id));
          return project.chunks.filter((c) => !c.isDeleted && activeSectionIds.has(c.sectionId)).length === 0;
        })() && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              color: classicMode ? '#9ca0a8' : '#505060',
              textAlign: 'center',
              border: classicMode ? '2px dashed #c0c4cc' : '2px dashed #303040',
              borderRadius: '12px',
              margin: '20px',
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '16px', opacity: 0.5 }}>
              🎵
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              Drop audio files here
            </div>
            <div style={{ fontSize: '13px' }}>
              or use the Import button / Record button in the toolbar
            </div>
            <div style={{ fontSize: '11px', marginTop: '8px', opacity: 0.6 }}>
              Supports: mp3, wav, m4a, ogg, webm, flac
            </div>
          </div>
        )}
      </div>

      {/* Modifier mode indicator */}
      {modifierMode !== 'navigate' && (
        <div
          style={{
            padding: '3px 12px',
            fontSize: '11px',
            fontWeight: 600,
            color: MODIFIER_MODE_META[modifierMode].color,
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderTop: `1px solid ${MODIFIER_MODE_META[modifierMode].color}40`,
            textAlign: 'center',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}
        >
          {MODIFIER_MODE_META[modifierMode].label} Mode
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          sectionId={contextMenu.sectionId}
          orderIndex={contextMenu.orderIndex}
          onClose={handleCloseContextMenu}
          onEditStyle={handleOpenStyleEditor}
        />
      )}

      {styleEditorState && (
        <StyleEditor
          target={styleEditorState.target}
          initialStyle={styleEditorState.initialStyle}
          initialColor={styleEditorState.initialColor}
          onApply={handleApplyStyle}
          onClose={handleCloseStyleEditor}
        />
      )}
    </div>
  );
}
