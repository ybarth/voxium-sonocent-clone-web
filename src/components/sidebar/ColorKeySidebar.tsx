import { useState, useCallback } from 'react';
import { Trash2, RotateCcw, ChevronRight, ChevronDown, GripVertical, Pencil, Plus } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { DEFAULT_CHUNK_COLOR } from '../../types';
import { getFlatSectionOrder } from '../../utils/sectionTree';
import { FilterPanel } from './FilterPanel';
import { TagManager } from './TagManager';
import { SfxConfigPanel } from './SfxConfigPanel';
import { TemplateManager } from './TemplateManager';
import { StyleEditor } from '../color/StyleEditor';

export function ColorKeySidebar() {
  const colorKey = useProjectStore((s) => s.project.colorKey);
  const selectedChunkIds = useProjectStore((s) => s.selection.selectedChunkIds);
  const colorChunks = useProjectStore((s) => s.colorChunks);
  const updateColorKeyEntry = useProjectStore((s) => s.updateColorKeyEntry);
  const [showAllColors, setShowAllColors] = useState(false);
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);

  const selectedIds = Array.from(selectedChunkIds);

  const handleColorClick = (hex: string | null) => {
    if (selectedIds.length > 0) {
      colorChunks(selectedIds, hex);
    }
  };

  // Show first 9 (shortcutted) by default, all if expanded
  const visibleColors = showAllColors ? colorKey.colors : colorKey.colors.slice(0, 9);

  return (
    <div
      style={{
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* ── Color Key ── */}
      <div
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#808090',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Color Key — {colorKey.name}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {/* Default / reset color */}
        <ColorKeyRow
          hex={DEFAULT_CHUNK_COLOR}
          label="Default"
          shortcut="0"
          isActive={selectedIds.length > 0}
          onClick={() => handleColorClick(null)}
        />

        {visibleColors.map((entry, idx) => (
          <ColorKeyRow
            key={entry.hex}
            hex={entry.hex}
            label={entry.label}
            shortcut={entry.shortcutKey > 0 ? entry.shortcutKey.toString() : undefined}
            isActive={selectedIds.length > 0}
            onClick={() => handleColorClick(entry.hex)}
            hasStyle={!!entry.style}
            onEdit={() => setEditingColorIndex(idx)}
          />
        ))}

        {/* Show more/less toggle */}
        {colorKey.colors.length > 9 && (
          <button
            onClick={() => setShowAllColors((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              color: '#505060',
              fontSize: '10px',
              cursor: 'pointer',
              padding: '4px 8px',
              textAlign: 'left',
            }}
          >
            {showAllColors ? 'Show less' : `+ ${colorKey.colors.length - 9} more colors`}
          </button>
        )}
      </div>

      {selectedIds.length === 0 && (
        <div
          style={{
            fontSize: '11px',
            color: '#505060',
            fontStyle: 'italic',
            padding: '8px 0',
          }}
        >
          Select chunks to apply colors. Use number keys 1-9 for quick
          assignment.
        </div>
      )}

      {/* ── Filter Panel ── */}
      <FilterPanel />

      {/* ── Tag Manager ── */}
      <TagManager />

      {/* ── SFX Config ── */}
      <SfxConfigPanel />

      {/* ── Templates ── */}
      <TemplateManager />

      {/* ── Section overview ── */}
      <SectionOverview />

      {/* ── Removed sections panel ── */}
      <RemovedSectionsPanel />

      {/* ── Trash bin ── */}
      <TrashBinPanel />

      {/* Style editor modal for color key entries */}
      {editingColorIndex !== null && (
        <StyleEditor
          initialStyle={colorKey.colors[editingColorIndex]?.style ?? null}
          initialColor={colorKey.colors[editingColorIndex]?.hex ?? '#808080'}
          target={{ type: 'colorKey', index: editingColorIndex }}
          onApply={(style, target) => {
            if (target.type === 'colorKey') {
              updateColorKeyEntry(target.index, { style });
            }
          }}
          onClose={() => setEditingColorIndex(null)}
        />
      )}
    </div>
  );
}

function ColorKeyRow({
  hex,
  label,
  shortcut,
  isActive,
  onClick,
  hasStyle,
  onEdit,
}: {
  hex: string;
  label: string;
  shortcut?: string;
  isActive: boolean;
  onClick: () => void;
  hasStyle?: boolean;
  onEdit?: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        borderRadius: '4px',
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.05)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
      }}
    >
      <button
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flex: 1,
          backgroundColor: 'transparent',
          border: 'none',
          cursor: isActive ? 'pointer' : 'default',
          opacity: isActive ? 1 : 0.6,
          textAlign: 'left',
          padding: 0,
        }}
      >
        <div
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '4px',
            backgroundColor: hex,
            flexShrink: 0,
            border: hasStyle ? '2px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
          }}
        />
        <span style={{ fontSize: '12px', color: '#c0c0d0', flex: 1 }}>
          {label}
        </span>
      </button>

      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          title="Edit style"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            color: '#505060',
            cursor: 'pointer',
            padding: '2px',
            borderRadius: '3px',
            flexShrink: 0,
          }}
        >
          <Pencil size={10} />
        </button>
      )}

      {shortcut && (
        <span
          style={{
            fontSize: '10px',
            color: '#505060',
            fontFamily: 'monospace',
            backgroundColor: 'rgba(255,255,255,0.05)',
            padding: '1px 5px',
            borderRadius: '3px',
            flexShrink: 0,
          }}
        >
          {shortcut}
        </span>
      )}
    </div>
  );
}

function SectionOverview() {
  const sections = useProjectStore((s) => s.project.sections);
  const chunks = useProjectStore((s) => s.project.chunks);
  const currentChunkId = useProjectStore((s) => s.playback.currentChunkId);
  const currentChunk = chunks.find((c) => c.id === currentChunkId);

  const activeSections = sections.filter(s => (s.status ?? 'active') === 'active');
  const ordered = getFlatSectionOrder(activeSections);

  return (
    <div style={{ marginTop: '8px' }}>
      <div
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#808090',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '8px',
        }}
      >
        Sections
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {ordered.map((section) => {
          const count = chunks.filter(
            (c) => c.sectionId === section.id && !c.isDeleted
          ).length;
          const isCurrent = currentChunk?.sectionId === section.id;

          return (
            <button
              key={section.id}
              onClick={() => {
                const sectionChunks = chunks
                  .filter((c) => c.sectionId === section.id && !c.isDeleted)
                  .sort((a, b) => a.orderIndex - b.orderIndex);
                if (sectionChunks.length > 0) {
                  useProjectStore.getState().selectChunk(sectionChunks[0].id, 'replace');
                  useProjectStore.getState().setCurrentChunk(sectionChunks[0].id);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 8px',
                paddingLeft: `${8 + (section.depth ?? 0) * 12}px`,
                backgroundColor: isCurrent
                  ? 'rgba(59, 130, 246, 0.15)'
                  : 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  color: isCurrent ? '#93c5fd' : '#a0a0b0',
                  flex: 1,
                }}
              >
                {section.name}
              </span>
              <span style={{ fontSize: '10px', color: '#505060' }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RemovedSectionsPanel() {
  const sections = useProjectStore((s) => s.project.sections);
  const chunks = useProjectStore((s) => s.project.chunks);
  const restoreSection = useProjectStore((s) => s.restoreSection);
  const deleteSection = useProjectStore((s) => s.deleteSection);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDragStart = useCallback((e: React.DragEvent, sectionId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/x-restore-section-id', sectionId);
  }, []);

  const removedSections = sections.filter(s => (s.status ?? 'active') === 'removed');
  if (removedSections.length === 0) return null;

  return (
    <div style={{ marginTop: '8px' }}>
      <button
        onClick={() => setIsExpanded(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#F59E0B',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '4px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          width: '100%',
        }}
      >
        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Removed ({removedSections.length})
      </button>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {removedSections.map((section) => {
            const count = chunks.filter(c => c.sectionId === section.id && !c.isDeleted).length;
            return (
              <div
                key={section.id}
                draggable
                onDragStart={(e) => handleDragStart(e, section.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.15)',
                  cursor: 'grab',
                }}
              >
                <GripVertical size={10} style={{ color: '#F59E0B', opacity: 0.5, flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: '#D4A030', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {section.name}
                </span>
                <span style={{ fontSize: '10px', color: '#806020' }}>{count}</span>
                <button
                  onClick={() => restoreSection(section.id)}
                  title="Restore to project"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: 'none',
                    border: 'none',
                    color: '#F59E0B',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '3px',
                    flexShrink: 0,
                  }}
                >
                  <RotateCcw size={11} />
                </button>
                <button
                  onClick={() => deleteSection(section.id)}
                  title="Move to trash"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: 'none',
                    border: 'none',
                    color: '#806020',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '3px',
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
          <div style={{ fontSize: '10px', color: '#806020', fontStyle: 'italic', padding: '4px 8px' }}>
            Drag sections back to the audio pane to restore
          </div>
        </div>
      )}
    </div>
  );
}

function TrashBinPanel() {
  const sections = useProjectStore((s) => s.project.sections);
  const chunks = useProjectStore((s) => s.project.chunks);
  const restoreSection = useProjectStore((s) => s.restoreSection);
  const emptyTrash = useProjectStore((s) => s.emptyTrash);
  const [isExpanded, setIsExpanded] = useState(false);

  const trashedSections = sections.filter(s => (s.status ?? 'active') === 'trashed');
  if (trashedSections.length === 0) return null;

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
        <button
          onClick={() => setIsExpanded(v => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#EF4444',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            flex: 1,
          }}
        >
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Trash2 size={12} />
          Trash ({trashedSections.length})
        </button>
        <button
          onClick={emptyTrash}
          title="Empty trash permanently"
          style={{
            fontSize: '10px',
            color: '#EF4444',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '4px',
            padding: '2px 6px',
            cursor: 'pointer',
          }}
        >
          Empty
        </button>
      </div>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {trashedSections.map((section) => {
            const count = chunks.filter(c => c.sectionId === section.id && !c.isDeleted).length;
            return (
              <div
                key={section.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.1)',
                  opacity: 0.7,
                }}
              >
                <span style={{ fontSize: '11px', color: '#f87171', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {section.name}
                </span>
                <span style={{ fontSize: '10px', color: '#7f1d1d' }}>{count}</span>
                <button
                  onClick={() => restoreSection(section.id)}
                  title="Restore from trash"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: 'none',
                    border: 'none',
                    color: '#f87171',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '3px',
                    flexShrink: 0,
                  }}
                >
                  <RotateCcw size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
