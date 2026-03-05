/**
 * ProcessingPanel — slide-up overlay showing active processing operations
 * with detailed progress, ETA, and a TTS chunk mini-map.
 */

import { useState, useEffect, useMemo } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { getScheduler } from '../../hooks/useSyntheticLayerSync';
import type { SmartTtsScheduler } from '../../utils/smartTtsScheduler';
import {
  getAllChunkStatuses,
  onStatusChange,
  type SyntheticChunkStatus,
} from '../../utils/syntheticLayerGenerator';
import type { SchedulerProgress } from '../../utils/smartTtsScheduler';
import type { DocumentImportJob } from '../../types/document';

// Re-export getScheduler for StatusBar
export { getScheduler } from '../../hooks/useSyntheticLayerSync';

// ─── Hook: subscribe to chunk-level TTS status changes ──────────────────────

function useTtsActivity(): {
  hasPendingOrGenerating: boolean;
  pendingCount: number;
  generatingCount: number;
  readyCount: number;
  errorCount: number;
  totalCount: number;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    return onStatusChange(() => setTick(t => t + 1));
  }, []);

  const statuses = getAllChunkStatuses();
  let pending = 0, generating = 0, ready = 0, error = 0;
  for (const status of statuses.values()) {
    switch (status) {
      case 'pending': pending++; break;
      case 'generating': generating++; break;
      case 'ready': ready++; break;
      case 'error': error++; break;
    }
  }

  return {
    hasPendingOrGenerating: pending + generating > 0,
    pendingCount: pending,
    generatingCount: generating,
    readyCount: ready,
    errorCount: error,
    totalCount: statuses.size,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatEta(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '';
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `~${m}m ${s}s`;
}

function getImportStatusLabel(status: DocumentImportJob['status']): string {
  switch (status) {
    case 'pending': return 'Waiting...';
    case 'parsing': return 'Parsing document...';
    case 'ai-dividing': return 'AI analyzing sections...';
    case 'ai-chunking': return 'AI chunking text...';
    case 'ai-expressivity': return 'AI generating expressivity...';
    case 'building-words': return 'Building word mappings...';
    case 'generating-tts': return 'Generating TTS audio...';
    case 'building-coords': return 'Building coordinates...';
    case 'completed': return 'Completed';
    case 'failed': return 'Failed';
    default: return status;
  }
}

// ─── ChunkMiniMap ───────────────────────────────────────────────────────────

function ChunkMiniMap({
  orderedChunkIds,
  playheadIndex,
  classicMode,
}: {
  orderedChunkIds: string[];
  playheadIndex: number;
  classicMode: boolean;
}) {
  const [statuses, setStatuses] = useState<ReadonlyMap<string, SyntheticChunkStatus>>(getAllChunkStatuses());

  useEffect(() => {
    return onStatusChange(() => {
      setStatuses(new Map(getAllChunkStatuses()));
    });
  }, []);

  const totalChunks = orderedChunkIds.length;
  if (totalChunks === 0) return null;

  const cellWidth = Math.max(2, Math.min(6, Math.floor(400 / totalChunks)));
  const totalWidth = cellWidth * totalChunks;
  const playheadPercent = totalChunks > 0 ? (playheadIndex / totalChunks) * 100 : 0;

  return (
    <div style={{ position: 'relative', marginTop: 4 }}>
      <div
        style={{
          display: 'flex',
          height: 10,
          borderRadius: 2,
          overflow: 'hidden',
          backgroundColor: classicMode ? '#d0d3d8' : '#1a1a2e',
          width: Math.min(totalWidth, 400),
        }}
      >
        {orderedChunkIds.map((id) => {
          const status = statuses.get(id) ?? 'pending';
          let color: string;
          switch (status) {
            case 'ready': color = classicMode ? '#4a9d5a' : '#2d7a3a'; break;
            case 'generating': color = classicMode ? '#4a7dd4' : '#3a5db8'; break;
            case 'error': color = classicMode ? '#d44a4a' : '#b83a3a'; break;
            default: color = classicMode ? '#b8bcc4' : '#2a2a3e'; break;
          }
          return (
            <div
              key={id}
              style={{
                width: cellWidth,
                height: '100%',
                backgroundColor: color,
                transition: 'background-color 0.2s',
              }}
            />
          );
        })}
      </div>
      {/* Playhead marker */}
      <div
        style={{
          position: 'absolute',
          left: `${playheadPercent}%`,
          top: -1,
          width: 2,
          height: 12,
          backgroundColor: classicMode ? '#1a1a2a' : '#ffffff',
          borderRadius: 1,
          pointerEvents: 'none',
        }}
      />
      <div style={{
        display: 'flex',
        gap: 12,
        marginTop: 2,
        fontSize: 9,
        opacity: 0.5,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: classicMode ? '#4a9d5a' : '#2d7a3a', display: 'inline-block' }} />
          ready
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: classicMode ? '#4a7dd4' : '#3a5db8', display: 'inline-block' }} />
          generating
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: classicMode ? '#b8bcc4' : '#2a2a3e', display: 'inline-block' }} />
          pending
        </span>
      </div>
    </div>
  );
}

// ─── ImportJobRow ───────────────────────────────────────────────────────────

function ImportJobRow({ job, classicMode }: { job: DocumentImportJob; classicMode: boolean }) {
  const doc = useProjectStore(s =>
    s.project.documentAssets.find(d => d.id === job.documentAssetId)
  );
  const fileName = doc?.originalFileName ?? 'Document';
  const pct = Math.round(job.progress * 100);
  const isDone = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const dotColor = isFailed ? '#e04040' : isDone ? '#2d7a3a' : '#4a7dd4';

  return (
    <div style={{ padding: '6px 0', borderBottom: classicMode ? '1px solid #d0d3d8' : '1px solid #1a1a2e' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          backgroundColor: dotColor,
          flexShrink: 0,
        }} />
        <span style={{ fontWeight: 500 }}>
          {isDone ? `Imported "${fileName}"` : `Importing "${fileName}"`}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, marginLeft: 12 }}>
        <span style={{ fontSize: 10, opacity: 0.7, minWidth: 140 }}>
          {getImportStatusLabel(job.status)}
        </span>
        <div style={{
          flex: 1, height: 4, borderRadius: 2, maxWidth: 200,
          backgroundColor: classicMode ? '#d0d3d8' : '#1a1a2e',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: 2,
            backgroundColor: job.status === 'failed' ? '#e04040' : '#4a7dd4',
            transition: 'width 0.3s',
          }} />
        </div>
        <span style={{ fontSize: 10, opacity: 0.6, minWidth: 30 }}>{pct}%</span>
      </div>
    </div>
  );
}

// ─── TtsGenerationRow (with scheduler) ──────────────────────────────────────

function TtsGenerationRowWithScheduler({
  progress,
  scheduler,
  classicMode,
}: {
  progress: SchedulerProgress;
  scheduler: SmartTtsScheduler;
  classicMode: boolean;
}) {
  const pct = progress.totalChunks > 0
    ? Math.round((progress.completedChunks / progress.totalChunks) * 100)
    : 0;

  return (
    <div style={{ padding: '6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          backgroundColor: '#4a7dd4',
          flexShrink: 0,
          animation: progress.generatingChunks > 0 ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontWeight: 500 }}>Generating TTS audio</span>
      </div>
      <div style={{ marginLeft: 12, marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, opacity: 0.7 }}>
            {progress.completedChunks} / {progress.totalChunks} chunks
          </span>
          <div style={{
            flex: 1, height: 4, borderRadius: 2, maxWidth: 200,
            backgroundColor: classicMode ? '#d0d3d8' : '#1a1a2e',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${pct}%`, height: '100%', borderRadius: 2,
              backgroundColor: '#4a7dd4',
              transition: 'width 0.3s',
            }} />
          </div>
          <span style={{ fontSize: 10, opacity: 0.6, minWidth: 30 }}>{pct}%</span>
          <span style={{ fontSize: 10, opacity: 0.5 }}>
            {formatEta(progress.estimatedTimeRemaining)}
          </span>
        </div>

        {progress.currentGeneratingIds.length > 0 && (
          <div style={{ fontSize: 9, opacity: 0.4, marginTop: 2 }}>
            Workers: {progress.currentGeneratingIds.map(id => {
              const idx = scheduler.getOrderedChunkIds().indexOf(id);
              return idx >= 0 ? `chunk ${idx + 1}` : id.slice(0, 6);
            }).join(', ')}
          </div>
        )}

        <ChunkMiniMap
          orderedChunkIds={scheduler.getOrderedChunkIds()}
          playheadIndex={scheduler.getPlayheadIndex()}
          classicMode={classicMode}
        />
      </div>
    </div>
  );
}

// ─── TtsGenerationRow (fallback without scheduler — uses chunk statuses) ────

function TtsGenerationRowFallback({
  ttsActivity,
  classicMode,
}: {
  ttsActivity: ReturnType<typeof useTtsActivity>;
  classicMode: boolean;
}) {
  const total = ttsActivity.totalCount;
  const completed = ttsActivity.readyCount;
  const hasErrors = ttsActivity.errorCount > 0;
  const allErrored = ttsActivity.errorCount === total && total > 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const dotColor = allErrored ? '#e04040' : '#4a7dd4';
  const barColor = hasErrors && !ttsActivity.hasPendingOrGenerating ? '#e04040' : '#4a7dd4';

  let label = 'Preparing TTS generation...';
  if (allErrored) label = 'TTS generation failed';
  else if (hasErrors) label = 'TTS generation (some errors)';
  else if (ttsActivity.generatingCount > 0) label = 'Generating TTS audio';

  return (
    <div style={{ padding: '6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          backgroundColor: dotColor,
          flexShrink: 0,
          animation: ttsActivity.generatingCount > 0 ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ marginLeft: 12, marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, opacity: 0.7 }}>
            {allErrored
              ? `${ttsActivity.errorCount} chunks failed`
              : `${completed} / ${total} chunks`}
            {hasErrors && !allErrored && ` (${ttsActivity.errorCount} errors)`}
          </span>
          <div style={{
            flex: 1, height: 4, borderRadius: 2, maxWidth: 200,
            backgroundColor: classicMode ? '#d0d3d8' : '#1a1a2e',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${allErrored ? 100 : pct}%`, height: '100%', borderRadius: 2,
              backgroundColor: barColor,
              transition: 'width 0.3s',
            }} />
          </div>
          {!allErrored && (
            <span style={{ fontSize: 10, opacity: 0.6, minWidth: 30 }}>{pct}%</span>
          )}
        </div>
        {allErrored && (
          <div style={{ fontSize: 10, opacity: 0.6, marginTop: 3, color: '#e04040' }}>
            HeadTTS worker failed to start. Check browser console for details.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ProcessingPanel ────────────────────────────────────────────────────────

export function ProcessingPanel({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const classicMode = useProjectStore(s => s.project.settings.classicMode);
  const importJobs = useProjectStore(s => s.project.documentImportJobs);

  const [ttsProgress, setTtsProgress] = useState<SchedulerProgress | null>(null);
  const [schedulerRef, setSchedulerRef] = useState<SmartTtsScheduler | null>(null);

  // Track TTS activity from chunk statuses (works even before scheduler exists)
  const ttsActivity = useTtsActivity();

  // Subscribe to scheduler progress (poll for scheduler creation)
  useEffect(() => {
    const check = () => {
      const sched = getScheduler();
      if (sched && sched !== schedulerRef) {
        setSchedulerRef(sched);
      }
    };
    check();
    const interval = setInterval(check, 250);
    return () => clearInterval(interval);
  }, [schedulerRef]);

  useEffect(() => {
    if (!schedulerRef) return;
    const unsub = schedulerRef.onProgress((p) => {
      setTtsProgress({ ...p });
    });
    setTtsProgress(schedulerRef.getProgress());
    return unsub;
  }, [schedulerRef]);

  // Import jobs: show active ones + recently completed (within 5s)
  const now = Date.now();
  const visibleImportJobs = useMemo(() =>
    importJobs.filter(j => {
      if (j.status !== 'completed' && j.status !== 'failed') return true;
      // Show recently finished jobs briefly
      if (j.completedAt && now - j.completedAt < 5000) return true;
      return false;
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [importJobs, Math.floor(now / 1000)], // re-eval each second
  );
  const activeImportJobs = visibleImportJobs.filter(
    j => j.status !== 'completed' && j.status !== 'failed',
  );

  const schedulerActive = ttsProgress !== null && (ttsProgress.queuedChunks + ttsProgress.generatingChunks) > 0;
  const ttsActive = schedulerActive || ttsActivity.hasPendingOrGenerating;
  const ttsHasErrors = ttsActivity.errorCount > 0;
  const activeCount = activeImportJobs.length + (ttsActive ? 1 : 0);

  // Auto-hide: wait 3 seconds after all operations finish
  const [doneTimeout, setDoneTimeout] = useState(false);
  useEffect(() => {
    if (activeCount === 0 && ttsActivity.readyCount > 0) {
      const timer = setTimeout(() => setDoneTimeout(true), 3000);
      return () => clearTimeout(timer);
    }
    setDoneTimeout(false);
  }, [activeCount, ttsActivity.readyCount]);

  // Determine visibility
  const hasAnythingToShow =
    activeCount > 0 ||
    visibleImportJobs.length > 0 ||
    ttsHasErrors ||
    (ttsActivity.readyCount > 0 && !doneTimeout);
  if (!hasAnythingToShow) return null;
  if (!expanded) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 28,
        left: 0,
        right: 0,
        backgroundColor: classicMode ? '#e8e9ec' : '#0f0f1a',
        borderTop: classicMode ? '1px solid #c0c4cc' : '1px solid #1a1a2e',
        color: classicMode ? '#1a1a2a' : '#c0c0d0',
        fontSize: 11,
        zIndex: 100,
        maxHeight: 280,
        overflowY: 'auto',
        boxShadow: classicMode
          ? '0 -4px 12px rgba(0,0,0,0.1)'
          : '0 -4px 12px rgba(0,0,0,0.4)',
        transition: 'background-color 0.3s, border-color 0.3s, color 0.3s',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        borderBottom: classicMode ? '1px solid #d0d3d8' : '1px solid #1a1a2e',
        fontWeight: 600,
        fontSize: 11,
      }}>
        <span>
          {activeCount > 0
            ? `Processing (${activeCount} active)`
            : ttsHasErrors
              ? 'Processing failed'
              : 'Processing complete'}
        </span>
        <button
          onClick={onToggle}
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: 10,
            opacity: 0.6,
            padding: '2px 6px',
          }}
        >
          Hide
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '4px 12px 8px' }}>
        {/* Import jobs (active + recently completed) */}
        {visibleImportJobs.map(job => (
          <ImportJobRow key={job.id} job={job} classicMode={classicMode} />
        ))}

        {/* TTS generation — use scheduler row when it has meaningful data, else fallback */}
        {ttsActive || ttsActivity.readyCount > 0 || ttsHasErrors ? (
          schedulerRef && ttsProgress && ttsProgress.totalChunks > 0 ? (
            <TtsGenerationRowWithScheduler
              progress={ttsProgress}
              scheduler={schedulerRef}
              classicMode={classicMode}
            />
          ) : (
            <TtsGenerationRowFallback
              ttsActivity={ttsActivity}
              classicMode={classicMode}
            />
          )
        ) : null}
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
