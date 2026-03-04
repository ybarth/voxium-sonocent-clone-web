import { useRef, useCallback, useState } from 'react';
import {
  Mic, Play, Pause, Square, SkipBack, SkipForward,
  Import, Scissors, Merge, Trash2, Plus, AudioWaveform, PaintBucket,
  ZoomIn, ZoomOut, ChevronDown, Settings, MessageSquare, MessageSquareOff,
  Undo2, Redo2, Filter, Wand2, Sun, Moon,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { usePlayback } from '../../hooks/usePlayback';
import { useRecorder } from '../../hooks/useRecorder';
import { importMultipleFiles } from '../../utils/importAudio';
import { LayoutToolbar } from '../layout/LayoutToolbar';
import { executeCommand } from '../../commands/commandExecutor';
import { useKeybindingStore } from '../../stores/keybindingStore';
import { Tooltip } from '../Tooltip';
import { ForgeModal } from '../forge/ForgeModal';

export function Toolbar() {
  const project = useProjectStore((s) => s.project);
  const selection = useProjectStore((s) => s.selection);
  const updateSettings = useProjectStore((s) => s.updateSettings);
  const addSection = useProjectStore((s) => s.addSection);
  const splitSectionAtChunk = useProjectStore((s) => s.splitSectionAtChunk);
  const deleteChunks = useProjectStore((s) => s.deleteChunks);
  const splitChunkAtCursor = useProjectStore((s) => s.splitChunkAtCursor);
  const mergeChunks = useProjectStore((s) => s.mergeChunks);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const undoStack = useProjectStore((s) => s.project.undoStack);
  const redoStack = useProjectStore((s) => s.project.redoStack);
  const filterActive = useProjectStore((s) => s.project.settings.filter.active);
  const filterCount = useProjectStore((s) => s.project.settings.filter.criteria.length);
  const clearFilter = useProjectStore((s) => s.clearFilter);
  const classicMode = useProjectStore((s) => s.project.settings.classicMode);

  const showTooltips = useKeybindingStore((s) => s.showTooltips);
  const setShowTooltips = useKeybindingStore((s) => s.setShowTooltips);

  const { isPlaying, togglePlay, stop } = usePlayback();
  const { isRecording, level, startRecording, stopRecording } = useRecorder();
  const navigateChunk = useProjectStore((s) => s.navigateChunk);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importAsSubsections, setImportAsSubsections] = useState(false);
  const [showImportDropdown, setShowImportDropdown] = useState(false);
  const [showForge, setShowForge] = useState(false);

  const selectedIds = Array.from(selection.selectedChunkIds);

  const triggerImport = useCallback((asSubsections: boolean) => {
    setImportAsSubsections(asSubsections);
    setShowImportDropdown(false);
    fileInputRef.current?.click();
  }, []);

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      // Determine current section context for subsection imports
      const store = useProjectStore.getState();
      const currentChunk = store.project.chunks.find((c) => c.id === store.playback.currentChunkId);
      const currentSectionId = currentChunk?.sectionId
        ?? store.playback.insertionPoint?.sectionId;

      await importMultipleFiles(Array.from(files), {
        parentId: importAsSubsections ? (currentSectionId ?? null) : null,
        afterSectionId: currentSectionId ?? undefined,
        asSubsections: importAsSubsections,
      });

      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [importAsSubsections]
  );

  const handleSplit = () => {
    splitChunkAtCursor();
  };

  const handleMerge = () => {
    if (selectedIds.length >= 2) {
      mergeChunks(selectedIds);
    }
  };

  const handleZoom = (direction: 'in' | 'out') => {
    const currentZoom = project.settings.zoomLevel ?? 1.0;
    const nextZoom = direction === 'in' ? currentZoom * 1.2 : currentZoom / 1.2;
    updateSettings({ zoomLevel: Math.max(0.2, Math.min(5, nextZoom)) });
  };

  const handleRecordToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 12px',
        backgroundColor: classicMode ? '#e8e9ec' : '#0f0f1a',
        borderBottom: classicMode ? '1px solid #d0d3d8' : '1px solid #1a1a2e',
        flexShrink: 0,
        flexWrap: 'wrap',
        transition: 'background-color 0.3s, border-color 0.3s',
      }}
    >
      {/* Record */}
      <ToolbarButton
        icon={isRecording ? <Square size={16} /> : <Mic size={16} />}
        label={isRecording ? 'Stop' : 'Record'}
        onClick={handleRecordToggle}
        active={isRecording}
        danger={isRecording}
      />

      {/* Level meter */}
      {isRecording && (
        <div
          style={{
            width: '40px',
            height: '16px',
            backgroundColor: classicMode ? '#d0d3d8' : '#1a1a2e',
            borderRadius: '3px',
            overflow: 'hidden',
            marginRight: '4px',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${level * 100}%`,
              backgroundColor: level > 0.8 ? '#EF4444' : level > 0.5 ? '#EAB308' : '#22C55E',
              transition: 'width 0.05s',
            }}
          />
        </div>
      )}

      <Divider />

      {/* Import — split button with dropdown */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <ToolbarButton
          icon={<Import size={16} />}
          label="Import"
          onClick={() => triggerImport(false)}
        />
        <button
          onClick={() => setShowImportDropdown((v) => !v)}
          title="Import options"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '5px 2px',
            backgroundColor: 'transparent',
            border: '1px solid transparent',
            borderRadius: '5px',
            color: '#a0a0b0',
            cursor: 'pointer',
            marginLeft: '-4px',
          }}
        >
          <ChevronDown size={12} />
        </button>
        {showImportDropdown && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              backgroundColor: classicMode ? '#ffffff' : '#1e1e2e',
              border: classicMode ? '1px solid #d0d3d8' : '1px solid #2a2a3e',
              borderRadius: '6px',
              padding: '4px 0',
              minWidth: '180px',
              boxShadow: classicMode ? '0 4px 16px rgba(0,0,0,0.12)' : '0 4px 16px rgba(0,0,0,0.5)',
              zIndex: 1000,
            }}
            onMouseLeave={() => setShowImportDropdown(false)}
          >
            <DropdownItem label="Import as Section(s)" onClick={() => triggerImport(false)} />
            <DropdownItem label="Import as Subsection(s)" onClick={() => triggerImport(true)} />
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleImport}
        style={{ display: 'none' }}
      />

      <Divider />

      {/* Transport */}
      <ToolbarButton
        icon={<SkipBack size={16} />}
        label="Previous Chunk"
        onClick={() => navigateChunk('prev')}
        commandId="chunk.prev"
      />
      <ToolbarButton
        icon={isPlaying ? <Pause size={16} /> : <Play size={16} />}
        label={isPlaying ? 'Pause' : 'Play'}
        onClick={togglePlay}
        commandId="transport.togglePlay"
        active={isPlaying}
      />
      <ToolbarButton
        icon={<Square size={16} />}
        label="Stop"
        onClick={stop}
        commandId="transport.stop"
      />
      <ToolbarButton
        icon={<SkipForward size={16} />}
        label="Next Chunk"
        onClick={() => navigateChunk('next')}
        commandId="chunk.next"
      />

      {/* Speed */}
      <select
        value={project.settings.playbackSpeed}
        onChange={(e) =>
          updateSettings({ playbackSpeed: parseFloat(e.target.value) })
        }
        style={{
          backgroundColor: classicMode ? '#d0d3d8' : '#1a1a2e',
          border: classicMode ? '1px solid #b8bcc4' : '1px solid #2a2a3e',
          borderRadius: '4px',
          color: classicMode ? '#2a2a3a' : '#a0a0b0',
          fontSize: '11px',
          padding: '4px 6px',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {speeds.map((s) => (
          <option key={s} value={s}>
            {s}x
          </option>
        ))}
      </select>

      <Divider />

      {/* Editing */}
      <ToolbarButton
        icon={<Scissors size={16} />}
        label="Split"
        onClick={handleSplit}
        disabled={selectedIds.length !== 1}
        commandId="edit.split"
      />
      <ToolbarButton
        icon={<Merge size={16} />}
        label="Merge"
        onClick={handleMerge}
        disabled={selectedIds.length < 2}
        commandId="edit.merge"
      />
      <ToolbarButton
        icon={<Trash2 size={16} />}
        label="Delete"
        onClick={() => deleteChunks(selectedIds)}
        disabled={selectedIds.length === 0}
        commandId="edit.delete"
      />

      <Divider />

      {/* Undo/Redo */}
      <ToolbarButton
        icon={<Undo2 size={16} />}
        label="Undo"
        onClick={undo}
        disabled={undoStack.length === 0}
        commandId="history.undo"
      />
      <ToolbarButton
        icon={<Redo2 size={16} />}
        label="Redo"
        onClick={redo}
        disabled={redoStack.length === 0}
        commandId="history.redo"
      />

      <Divider />

      {/* Section */}
      <ToolbarButton
        icon={<Plus size={16} />}
        label="Section"
        onClick={() => {
          const state = useProjectStore.getState();
          const { playback, project } = state;

          // During playback, if cursor is in the middle of a section, split it
          if (playback.isPlaying && playback.currentChunkId) {
            const chunk = project.chunks.find(c => c.id === playback.currentChunkId);
            if (chunk) {
              const sectionChunks = project.chunks
                .filter(c => c.sectionId === chunk.sectionId && !c.isDeleted)
                .sort((a, b) => a.orderIndex - b.orderIndex);
              const lastChunk = sectionChunks[sectionChunks.length - 1];
              if (lastChunk && chunk.orderIndex < lastChunk.orderIndex) {
                splitSectionAtChunk(chunk.sectionId, chunk.orderIndex + 1);
                return;
              }
            }
          }

          addSection();
        }}
      />

      <Divider />

      {/* Visual mode toggle */}
      <ToolbarButton
        icon={
          project.settings.visualMode === 'waveform' ? (
            <AudioWaveform size={16} />
          ) : (
            <PaintBucket size={16} />
          )
        }
        label={project.settings.visualMode === 'waveform' ? 'Waveform' : 'Flat'}
        onClick={() =>
          updateSettings({
            visualMode:
              project.settings.visualMode === 'waveform' ? 'flat' : 'waveform',
          })
        }
        commandId="view.toggleVisualMode"
      />

      <Divider />

      {/* Zoom */}
      <ToolbarButton
        icon={<ZoomOut size={14} />}
        label="Zoom Out"
        onClick={() => handleZoom('out')}
        commandId="view.zoomOut"
      />
      <div style={{ fontSize: '10px', color: classicMode ? '#808898' : '#606070', minWidth: '30px', textAlign: 'center' }}>
        {Math.round((project.settings.zoomLevel ?? 1.0) * 100)}%
      </div>
      <ToolbarButton
        icon={<ZoomIn size={14} />}
        label="Zoom In"
        onClick={() => handleZoom('in')}
        commandId="view.zoomIn"
      />

      <Divider />

      {/* Layout controls */}
      <LayoutToolbar />

      <Divider />

      {/* Filter indicator */}
      {filterActive && (
        <ToolbarButton
          icon={
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <Filter size={14} />
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-6px',
                fontSize: '8px',
                backgroundColor: '#3B82F6',
                color: '#fff',
                borderRadius: '6px',
                padding: '0 3px',
                lineHeight: '12px',
                fontWeight: 700,
              }}>
                {filterCount}
              </span>
            </div>
          }
          label="Clear Filter"
          onClick={clearFilter}
          active={true}
        />
      )}

      {/* Forge */}
      <ToolbarButton
        icon={<Wand2 size={14} />}
        label="Forge"
        onClick={() => setShowForge(true)}
        commandId="forge.open"
      />

      {/* Sonocent Classic Mode toggle */}
      <ToolbarToggle
        icon={classicMode ? <Sun size={14} /> : <Moon size={14} />}
        label={classicMode ? 'Classic Mode' : 'Modern Mode'}
        active={classicMode}
        onClick={() => updateSettings({ classicMode: !classicMode })}
      />

      {/* Settings */}
      <ToolbarButton
        icon={<Settings size={14} />}
        label="Settings"
        onClick={() => executeCommand('app.openSettings')}
        commandId="app.openSettings"
      />

      {/* Tooltip toggle */}
      <ToolbarToggle
        icon={showTooltips ? <MessageSquare size={14} /> : <MessageSquareOff size={14} />}
        label={showTooltips ? 'Tooltips On' : 'Tooltips Off'}
        active={showTooltips}
        onClick={() => setShowTooltips(!showTooltips)}
      />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Selection info */}
      {selectedIds.length > 0 && (
        <span
          style={{
            fontSize: '11px',
            color: classicMode ? '#808898' : '#606070',
          }}
        >
          {selectedIds.length} chunk{selectedIds.length !== 1 ? 's' : ''} selected
          {selectedIds.length >= 2 && <span style={{ color: classicMode ? '#9ca0a8' : '#505060' }}> (m to merge)</span>}
        </span>
      )}
      <SectionSelectionInfo />

      {showForge && <ForgeModal onClose={() => setShowForge(false)} />}
    </div>
  );
}

function SectionSelectionInfo() {
  const selectedSectionIds = useProjectStore((s) => s.selection.selectedSectionIds);
  const mergeMultipleSections = useProjectStore((s) => s.mergeMultipleSections);
  const clearSectionSelection = useProjectStore((s) => s.clearSectionSelection);
  const count = selectedSectionIds.size;

  if (count === 0) return null;

  return (
    <span
      style={{
        fontSize: '11px',
        color: '#3B82F6',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      {count} section{count !== 1 ? 's' : ''} selected
      {count >= 2 && (
        <>
          <button
            onClick={() => {
              mergeMultipleSections(Array.from(selectedSectionIds));
              clearSectionSelection();
            }}
            style={{
              fontSize: '11px',
              color: '#93c5fd',
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: '4px',
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            Merge (Shift+M)
          </button>
        </>
      )}
      <button
        onClick={clearSectionSelection}
        style={{
          fontSize: '10px',
          color: '#606070',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px',
        }}
      >
        Clear
      </button>
    </span>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  active = false,
  danger = false,
  disabled = false,
  commandId,
  shortcut,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  /** Command ID to resolve keybinding from active preset */
  commandId?: string;
  /** Manual shortcut override (used when there's no command ID) */
  shortcut?: string;
}) {
  const cm = useProjectStore((s) => s.project.settings.classicMode);
  const btn = (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '5px 8px',
        backgroundColor: active
          ? danger
            ? '#7f1d1d'
            : cm ? '#dbeafe' : '#1e3a5f'
          : 'transparent',
        border: '1px solid transparent',
        borderRadius: '5px',
        color: disabled
          ? cm ? '#a0a0b0' : '#404050'
          : danger && active
          ? '#fca5a5'
          : active
          ? cm ? '#1d4ed8' : '#93c5fd'
          : cm ? '#505060' : '#a0a0b0',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '11px',
        fontWeight: 500,
        transition: 'all 0.15s',
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          (e.target as HTMLElement).style.backgroundColor =
            active ? '' : cm ? '#d0d3d8' : '#1a1a2e';
      }}
      onMouseLeave={(e) => {
        if (!disabled)
          (e.target as HTMLElement).style.backgroundColor = active
            ? danger
              ? '#7f1d1d'
              : cm ? '#dbeafe' : '#1e3a5f'
            : 'transparent';
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <Tooltip label={label} commandId={commandId} shortcut={shortcut}>
      {btn}
    </Tooltip>
  );
}

function DropdownItem({ label, onClick }: { label: string; onClick: () => void }) {
  const cm = useProjectStore((s) => s.project.settings.classicMode);
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: '6px 14px',
        background: 'none',
        border: 'none',
        color: cm ? '#2a2a3a' : '#e0e0e0',
        fontSize: '12px',
        textAlign: 'left',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = cm ? '#e8e9ec' : '#2a2a3e'; }}
      onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      {label}
    </button>
  );
}

function ToolbarToggle({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const cm = useProjectStore((s) => s.project.settings.classicMode);
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '5px 8px',
        backgroundColor: active
          ? cm ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.15)'
          : 'transparent',
        border: '1px solid transparent',
        borderRadius: '5px',
        color: active ? (cm ? '#1d4ed8' : '#60a5fa') : (cm ? '#808898' : '#505060'),
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: 500,
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.target as HTMLElement).style.backgroundColor = active
          ? cm ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.2)'
          : cm ? '#d0d3d8' : '#1a1a2e';
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.backgroundColor = active
          ? cm ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.15)'
          : 'transparent';
      }}
    >
      {icon}
    </button>
  );
}

function Divider() {
  const cm = useProjectStore((s) => s.project.settings.classicMode);
  return (
    <div
      style={{
        width: '1px',
        height: '24px',
        backgroundColor: cm ? '#c0c4cc' : '#1a1a2e',
        margin: '0 4px',
      }}
    />
  );
}
