import { useRef, useCallback } from 'react';
import {
  Mic, MicOff, Play, Pause, Square, SkipBack, SkipForward,
  Import, Scissors, Merge, Trash2, Plus, AudioWaveform, PaintBucket,
  ZoomIn, ZoomOut
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { usePlayback } from '../../hooks/usePlayback';
import { useRecorder } from '../../hooks/useRecorder';
import { importAudioFile } from '../../utils/importAudio';

export function Toolbar() {
  const project = useProjectStore((s) => s.project);
  const selection = useProjectStore((s) => s.selection);
  const updateSettings = useProjectStore((s) => s.updateSettings);
  const addSection = useProjectStore((s) => s.addSection);
  const deleteChunks = useProjectStore((s) => s.deleteChunks);
  const splitChunkAtCursor = useProjectStore((s) => s.splitChunkAtCursor);
  const mergeChunks = useProjectStore((s) => s.mergeChunks);

  const { isPlaying, togglePlay, stop } = usePlayback();
  const { isRecording, isPaused, level, startRecording, pauseRecording, resumeRecording, stopRecording } = useRecorder();
  const navigateChunk = useProjectStore((s) => s.navigateChunk);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedIds = Array.from(selection.selectedChunkIds);

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      for (const file of Array.from(files)) {
        await importAudioFile(file);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    []
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
    if (!isRecording) {
      startRecording();
    } else if (isPaused) {
      resumeRecording();
    } else {
      pauseRecording();
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
        backgroundColor: '#0f0f1a',
        borderBottom: '1px solid #1a1a2e',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      {/* Record */}
      <ToolbarButton
        icon={isRecording ? <MicOff size={16} /> : <Mic size={16} />}
        label={isRecording ? (isPaused ? 'Resume' : 'Pause') : 'Record'}
        onClick={handleRecordToggle}
        active={isRecording}
        danger={isRecording && !isPaused}
      />
      {isRecording && (
        <ToolbarButton
          icon={<Square size={14} />}
          label="Stop Rec"
          onClick={stopRecording}
        />
      )}

      {/* Level meter */}
      {isRecording && (
        <div
          style={{
            width: '40px',
            height: '16px',
            backgroundColor: '#1a1a2e',
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

      {/* Import */}
      <ToolbarButton
        icon={<Import size={16} />}
        label="Import"
        onClick={() => fileInputRef.current?.click()}
      />
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
        label="Prev"
        onClick={() => navigateChunk('prev')}
      />
      <ToolbarButton
        icon={isPlaying ? <Pause size={16} /> : <Play size={16} />}
        label={isPlaying ? 'Pause' : 'Play'}
        onClick={togglePlay}
        active={isPlaying}
      />
      <ToolbarButton
        icon={<Square size={16} />}
        label="Stop"
        onClick={stop}
      />
      <ToolbarButton
        icon={<SkipForward size={16} />}
        label="Next"
        onClick={() => navigateChunk('next')}
      />

      {/* Speed */}
      <select
        value={project.settings.playbackSpeed}
        onChange={(e) =>
          updateSettings({ playbackSpeed: parseFloat(e.target.value) })
        }
        style={{
          backgroundColor: '#1a1a2e',
          border: '1px solid #2a2a3e',
          borderRadius: '4px',
          color: '#a0a0b0',
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
      />
      <ToolbarButton
        icon={<Merge size={16} />}
        label="Merge"
        onClick={handleMerge}
        disabled={selectedIds.length < 2}
      />
      <ToolbarButton
        icon={<Trash2 size={16} />}
        label="Delete"
        onClick={() => deleteChunks(selectedIds)}
        disabled={selectedIds.length === 0}
      />

      <Divider />

      {/* Section */}
      <ToolbarButton
        icon={<Plus size={16} />}
        label="Section"
        onClick={() => addSection()}
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
      />

      <Divider />

      {/* Zoom */}
      <ToolbarButton
        icon={<ZoomOut size={14} />}
        label="Out"
        onClick={() => handleZoom('out')}
      />
      <div style={{ fontSize: '10px', color: '#606070', minWidth: '30px', textAlign: 'center' }}>
        {Math.round((project.settings.zoomLevel ?? 1.0) * 100)}%
      </div>
      <ToolbarButton
        icon={<ZoomIn size={14} />}
        label="In"
        onClick={() => handleZoom('in')}
      />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Selection info */}
      {selectedIds.length > 0 && (
        <span
          style={{
            fontSize: '11px',
            color: '#606070',
          }}
        >
          {selectedIds.length} selected
        </span>
      )}
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  active = false,
  danger = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '5px 8px',
        backgroundColor: active
          ? danger
            ? '#7f1d1d'
            : '#1e3a5f'
          : 'transparent',
        border: '1px solid transparent',
        borderRadius: '5px',
        color: disabled
          ? '#404050'
          : danger && active
          ? '#fca5a5'
          : active
          ? '#93c5fd'
          : '#a0a0b0',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '11px',
        fontWeight: 500,
        transition: 'all 0.15s',
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          (e.target as HTMLElement).style.backgroundColor =
            active ? '' : '#1a1a2e';
      }}
      onMouseLeave={(e) => {
        if (!disabled)
          (e.target as HTMLElement).style.backgroundColor = active
            ? danger
              ? '#7f1d1d'
              : '#1e3a5f'
            : 'transparent';
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: '1px',
        height: '24px',
        backgroundColor: '#1a1a2e',
        margin: '0 4px',
      }}
    />
  );
}
