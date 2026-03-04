import { useState, useRef, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, Clipboard, X, Search,
  GripVertical, ClipboardPaste, Trash2, ArrowUp, ArrowDown,
  Undo2, Redo2,
} from 'lucide-react';
import { useClipboardStore } from '../../stores/clipboardStore';
import { useProjectStore } from '../../stores/projectStore';
import type { ClipboardItem, ClipboardSortField } from '../../types/clipboard';

// ─── Relative time helper ──────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── ClipboardItemRow ──────────────────────────────────────────────────────

function ClipboardItemRow({
  item,
  index,
  isActive,
  canDrag,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  item: ClipboardItem;
  index: number;
  isActive: boolean;
  canDrag: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
}) {
  const removeItem = useClipboardStore(s => s.removeItem);
  const renameItem = useClipboardStore(s => s.renameItem);
  const clipboardPaste = useProjectStore(s => s.clipboardPaste);
  const sections = useProjectStore(s => s.project.sections);

  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(item.label);
  const inputRef = useRef<HTMLInputElement>(null);

  const sectionName = item.sourceSectionId
    ? sections.find(s => s.id === item.sourceSectionId)?.name ?? 'Unknown'
    : 'Unknown';

  const colorDots = item.chunks.slice(0, 5).map((c, i) => (
    <span
      key={i}
      style={{
        display: 'inline-block',
        width: 8, height: 8,
        borderRadius: '50%',
        backgroundColor: c.style?.color ?? c.color ?? '#666',
        border: '1px solid rgba(255,255,255,0.2)',
      }}
    />
  ));

  const handleDoubleClick = () => {
    setEditLabel(item.label);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitRename = () => {
    const trimmed = editLabel.trim();
    if (trimmed && trimmed !== item.label) renameItem(item.id, trimmed);
    setIsEditing(false);
  };

  return (
    <div
      draggable={canDrag}
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={() => onDrop(index)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '6px 4px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backgroundColor: isActive ? 'rgba(59,130,246,0.15)' : 'transparent',
        borderLeft: isActive ? '2px solid #3B82F6' : '2px solid transparent',
        cursor: canDrag ? 'grab' : 'default',
      }}
    >
      {/* Top row: drag handle, color dots, label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {canDrag && (
          <GripVertical size={12} style={{ color: '#606070', flexShrink: 0 }} />
        )}
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {colorDots}
        </div>
        {isEditing ? (
          <input
            ref={inputRef}
            value={editLabel}
            onChange={e => setEditLabel(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            style={{
              flex: 1,
              fontSize: '11px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(59,130,246,0.5)',
              borderRadius: 3,
              color: '#e0e0e8',
              padding: '1px 4px',
              outline: 'none',
              minWidth: 0,
            }}
          />
        ) : (
          <span
            onDoubleClick={handleDoubleClick}
            style={{
              flex: 1,
              fontSize: '11px',
              color: '#c0c0d0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: 'text',
            }}
            title="Double-click to rename"
          >
            {item.label}
          </span>
        )}
      </div>

      {/* Bottom row: meta info + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: canDrag ? 16 : 0 }}>
        <span style={{
          fontSize: '10px',
          color: item.mode === 'cut' ? '#F59E0B' : '#3B82F6',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}>
          {item.mode}
        </span>
        <span style={{ fontSize: '10px', color: '#606070' }}>
          {item.chunks.length} chunk{item.chunks.length !== 1 ? 's' : ''}
        </span>
        <span style={{ fontSize: '10px', color: '#505060' }}>
          {sectionName}
        </span>
        <span style={{ fontSize: '10px', color: '#505060' }}>
          {relativeTime(item.timestamp)}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          <button
            onClick={() => clipboardPaste(item.id)}
            title="Paste this item"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#808090', padding: 2, display: 'flex',
            }}
          >
            <ClipboardPaste size={12} />
          </button>
          <button
            onClick={() => removeItem(item.id)}
            title="Remove"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#808090', padding: 2, display: 'flex',
            }}
          >
            <X size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toggle Button ──────────────────────────────────────────────────────────

function ToggleBtn({
  active,
  label,
  onClick,
  title,
}: {
  active: boolean;
  label: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        fontSize: '10px',
        fontWeight: active ? 600 : 400,
        color: active ? '#e0e0e8' : '#606070',
        background: active ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.05)',
        border: '1px solid',
        borderColor: active ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        padding: '2px 6px',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────────────────

export function ClipboardPanel({ forceExpanded = false }: { forceExpanded?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const expanded = forceExpanded || isExpanded;
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const items = useClipboardStore(s => s.items);
  const insertionPosition = useClipboardStore(s => s.insertionPosition);
  const pasteMode = useClipboardStore(s => s.pasteMode);
  const pasteDirection = useClipboardStore(s => s.pasteDirection);
  const sortField = useClipboardStore(s => s.sortField);
  const sortDirection = useClipboardStore(s => s.sortDirection);
  const searchQuery = useClipboardStore(s => s.searchQuery);
  const pasteCursorIndex = useClipboardStore(s => s.pasteCursorIndex);

  const setInsertionPosition = useClipboardStore(s => s.setInsertionPosition);
  const setPasteMode = useClipboardStore(s => s.setPasteMode);
  const setPasteDirection = useClipboardStore(s => s.setPasteDirection);
  const setSortField = useClipboardStore(s => s.setSortField);
  const setSortDirection = useClipboardStore(s => s.setSortDirection);
  const setSearchQuery = useClipboardStore(s => s.setSearchQuery);
  const clearAll = useClipboardStore(s => s.clearAll);
  const reorderItems = useClipboardStore(s => s.reorderItems);
  const getSortedFilteredItems = useClipboardStore(s => s.getSortedFilteredItems);
  const clipboardUndo = useClipboardStore(s => s.clipboardUndo);
  const clipboardRedo = useClipboardStore(s => s.clipboardRedo);
  const undoStack = useClipboardStore(s => s.undoStack);
  const redoStack = useClipboardStore(s => s.redoStack);

  const sortedItems = getSortedFilteredItems();
  const canDrag = sortField === 'custom';

  const handleDragStart = useCallback((index: number) => setDragIndex(index), []);
  const handleDragOver = useCallback((e: React.DragEvent, _index: number) => {
    e.preventDefault();
  }, []);
  const handleDrop = useCallback((toIndex: number) => {
    if (dragIndex !== null && dragIndex !== toIndex) {
      reorderItems(dragIndex, toIndex);
    }
    setDragIndex(null);
  }, [dragIndex, reorderItems]);

  const sortOptions: { value: ClipboardSortField; label: string }[] = [
    { value: 'custom', label: 'Custom' },
    { value: 'timestamp', label: 'Time' },
    { value: 'chunkCount', label: 'Chunks' },
    { value: 'label', label: 'Label' },
  ];

  return (
    <div style={{ marginTop: forceExpanded ? 0 : '8px' }}>
      {/* Header — hidden when forceExpanded */}
      {!forceExpanded && (
        <button
          onClick={() => setIsExpanded(v => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            fontWeight: 600,
            color: items.length > 0 ? '#3B82F6' : '#808090',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '4px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            width: '100%',
            textAlign: 'left',
          }}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Clipboard size={12} />
          Clipboard
          {items.length > 0 && (
            <span style={{
              fontSize: '10px',
              backgroundColor: 'rgba(59,130,246,0.2)',
              color: '#3B82F6',
              borderRadius: 8,
              padding: '0 5px',
              marginLeft: 4,
            }}>
              {items.length}
            </span>
          )}
        </button>
      )}

      {expanded && (
        <div style={{ paddingLeft: '4px' }}>
          {/* Settings row */}
          <div style={{
            display: 'flex',
            gap: 4,
            flexWrap: 'wrap',
            marginBottom: 6,
            alignItems: 'center',
          }}>
            {/* Insertion position */}
            <div style={{ display: 'flex', gap: 1 }}>
              <ToggleBtn
                active={insertionPosition === 'top'}
                label="Top"
                onClick={() => setInsertionPosition('top')}
                title="New items go to top"
              />
              <ToggleBtn
                active={insertionPosition === 'bottom'}
                label="Bot"
                onClick={() => setInsertionPosition('bottom')}
                title="New items go to bottom"
              />
            </div>

            {/* Paste mode */}
            <div style={{ display: 'flex', gap: 1 }}>
              <ToggleBtn
                active={pasteMode === 'sticky'}
                label="Sticky"
                onClick={() => setPasteMode('sticky')}
                title="Always paste the top item"
              />
              <ToggleBtn
                active={pasteMode === 'sequential'}
                label="Seq"
                onClick={() => setPasteMode('sequential')}
                title="Paste items in sequence"
              />
            </div>

            {/* Paste direction (only for sequential) */}
            {pasteMode === 'sequential' && (
              <div style={{ display: 'flex', gap: 1 }}>
                <ToggleBtn
                  active={pasteDirection === 'ascending'}
                  label={<ArrowDown size={10} />}
                  onClick={() => setPasteDirection('ascending')}
                  title="Paste forward through list"
                />
                <ToggleBtn
                  active={pasteDirection === 'descending'}
                  label={<ArrowUp size={10} />}
                  onClick={() => setPasteDirection('descending')}
                  title="Paste backward through list"
                />
              </div>
            )}
          </div>

          {/* Search */}
          <div style={{
            position: 'relative',
            marginBottom: 6,
          }}>
            <Search
              size={12}
              style={{
                position: 'absolute',
                left: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#606070',
              }}
            />
            <input
              type="text"
              placeholder="Search clipboard..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                fontSize: '11px',
                padding: '4px 6px 4px 22px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 4,
                color: '#c0c0d0',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 4,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#606070',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                }}
              >
                <X size={10} />
              </button>
            )}
          </div>

          {/* Sort */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 6,
            fontSize: '10px',
            color: '#808090',
          }}>
            <span>Sort:</span>
            <select
              value={sortField}
              onChange={e => setSortField(e.target.value as ClipboardSortField)}
              style={{
                fontSize: '10px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 3,
                color: '#c0c0d0',
                padding: '1px 4px',
                outline: 'none',
              }}
            >
              {sortOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
              title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
              style={{
                background: 'none',
                border: 'none',
                color: '#808090',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
              }}
            >
              {sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            </button>
          </div>

          {/* Item list */}
          {sortedItems.length === 0 ? (
            <div style={{
              fontSize: '11px',
              color: '#505060',
              fontStyle: 'italic',
              padding: '8px 0',
            }}>
              {items.length === 0
                ? 'No items in clipboard. Use Ctrl+C or Ctrl+X to add chunks.'
                : 'No items match your search.'}
            </div>
          ) : (
            <div style={{
              maxHeight: 300,
              overflowY: 'auto',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 4,
            }}>
              {sortedItems.map((item, idx) => (
                <ClipboardItemRow
                  key={item.id}
                  item={item}
                  index={idx}
                  isActive={pasteMode === 'sequential' && idx === pasteCursorIndex}
                  canDrag={canDrag}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              ))}
            </div>
          )}

          {/* Footer */}
          {(items.length > 0 || undoStack.length > 0) && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 2,
              padding: '6px 0',
            }}>
              <button
                onClick={clipboardUndo}
                disabled={undoStack.length === 0}
                title="Undo clipboard action"
                style={{
                  background: 'none', border: 'none', cursor: undoStack.length > 0 ? 'pointer' : 'default',
                  color: undoStack.length > 0 ? '#808090' : '#404050', padding: 2, display: 'flex',
                  opacity: undoStack.length > 0 ? 1 : 0.4,
                }}
              >
                <Undo2 size={12} />
              </button>
              <button
                onClick={clipboardRedo}
                disabled={redoStack.length === 0}
                title="Redo clipboard action"
                style={{
                  background: 'none', border: 'none', cursor: redoStack.length > 0 ? 'pointer' : 'default',
                  color: redoStack.length > 0 ? '#808090' : '#404050', padding: 2, display: 'flex',
                  opacity: redoStack.length > 0 ? 1 : 0.4,
                }}
              >
                <Redo2 size={12} />
              </button>
              {items.length > 0 && (
                <button
                  onClick={clearAll}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '10px',
                    color: '#808090',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    marginLeft: 'auto',
                  }}
                >
                  <Trash2 size={10} />
                  Clear All
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
