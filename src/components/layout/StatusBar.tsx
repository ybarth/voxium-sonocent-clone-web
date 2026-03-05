import { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { getScheduler } from './ProcessingPanel';
import { getAllChunkStatuses, onStatusChange } from '../../utils/syntheticLayerGenerator';

export function StatusBar({ onToggleProcessing, processingExpanded }: {
  onToggleProcessing: () => void;
  processingExpanded: boolean;
}) {
  const project = useProjectStore((s) => s.project);
  const playback = useProjectStore((s) => s.playback);
  const classicMode = project.settings.classicMode;
  const chunks = project.chunks.filter((c) => !c.isDeleted);

  const currentChunk = chunks.find((c) => c.id === playback.currentChunkId);
  const currentSection = project.sections.find(
    (s) => s.id === currentChunk?.sectionId
  );

  const totalDuration = project.audioBuffers.reduce(
    (sum, b) => sum + b.duration,
    0
  );

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentChunkIndex = currentChunk
    ? chunks.findIndex((c) => c.id === currentChunk.id) + 1
    : 0;

  // Track active processing operations
  const [hasActiveOps, setHasActiveOps] = useState(false);
  const activeImportJobs = project.documentImportJobs.filter(
    j => j.status !== 'completed' && j.status !== 'failed'
  );

  useEffect(() => {
    const check = () => {
      // Check scheduler
      const sched = getScheduler();
      if (sched) {
        const p = sched.getProgress();
        if (p.queuedChunks + p.generatingChunks > 0 || activeImportJobs.length > 0) {
          setHasActiveOps(true);
          return;
        }
      }

      // Check chunk statuses directly (covers pre-scheduler period and errors)
      const statuses = getAllChunkStatuses();
      let hasActivity = false;
      for (const status of statuses.values()) {
        if (status === 'pending' || status === 'generating' || status === 'error') {
          hasActivity = true;
          break;
        }
      }

      setHasActiveOps(hasActivity || activeImportJobs.length > 0);
    };
    check();

    // Listen to chunk status changes
    const unsubStatus = onStatusChange(check);

    // Also listen to scheduler if it exists
    const sched = getScheduler();
    const unsubSched = sched?.onProgress(() => check());

    // Poll for scheduler creation
    const interval = setInterval(check, 500);

    return () => {
      unsubStatus();
      unsubSched?.();
      clearInterval(interval);
    };
  }, [activeImportJobs.length]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '4px 16px',
        backgroundColor: classicMode ? '#dcdee2' : '#0a0a14',
        borderTop: classicMode ? '1px solid #c0c4cc' : '1px solid #1a1a2e',
        fontSize: '11px',
        color: classicMode ? '#606878' : '#505060',
        flexShrink: 0,
        height: '28px',
        transition: 'background-color 0.3s, border-color 0.3s, color 0.3s',
      }}
    >
      {/* Processing indicator */}
      {hasActiveOps && (
        <button
          onClick={onToggleProcessing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 3,
            fontSize: 11,
          }}
          title={processingExpanded ? 'Hide processing panel' : 'Show processing panel'}
        >
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: '#4a7dd4',
            animation: 'statusPulse 1.5s ease-in-out infinite',
          }} />
          <span>Processing...</span>
          <style>{`
            @keyframes statusPulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.3; }
            }
          `}</style>
        </button>
      )}

      <span>
        {currentChunk
          ? `${formatTime(playback.cursorTime)}`
          : '0:00'}
      </span>

      {currentChunkIndex > 0 && (
        <span>
          Chunk {currentChunkIndex} / {chunks.length}
        </span>
      )}

      {currentSection && <span>{currentSection.name}</span>}

      <div style={{ flex: 1 }} />

      <span>Duration: {formatTime(totalDuration)}</span>
      <span>{project.settings.playbackSpeed}x</span>
      <span>{project.settings.visualMode === 'waveform' ? 'Waveform' : 'Flat'}</span>
      <span style={{ opacity: 0.5 }}>Build 16</span>
    </div>
  );
}
