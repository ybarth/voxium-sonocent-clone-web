import { useMemo } from 'react';
import { useProjectStore } from '../../stores/projectStore';

export function TextPaneStatusBar() {
  const words = useProjectStore(s => s.project.transcription.words);
  const jobs = useProjectStore(s => s.project.transcription.jobs);
  const classicMode = useProjectStore(s => s.project.settings.classicMode);

  const activeJob = jobs.find(j =>
    j.status !== 'completed' && j.status !== 'failed' && j.status !== 'cancelled'
  );

  const stats = useMemo(() => {
    if (words.length === 0) return null;
    const totalConfidence = words.reduce((sum, w) => sum + w.confidence, 0);
    const avgConfidence = totalConfidence / words.length;
    const lowConfidenceCount = words.filter(w => w.confidence < 0.6).length;
    return { wordCount: words.length, avgConfidence, lowConfidenceCount };
  }, [words]);

  const bg = classicMode ? '#f0f1f3' : '#0a0a15';
  const border = classicMode ? '#d0d3d8' : '#1a1a2e';
  const text = classicMode ? '#808090' : '#505060';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '4px 12px',
        borderTop: `1px solid ${border}`,
        backgroundColor: bg,
        fontSize: '10px',
        color: text,
      }}
    >
      {activeJob && (
        <span style={{ color: '#3B82F6', fontWeight: 600 }}>
          {activeJob.status === 'transcribing' ? 'Transcribing' : activeJob.status}
          {activeJob.progress > 0 && ` ${Math.round(activeJob.progress * 100)}%`}
        </span>
      )}

      {stats && (
        <>
          <span>{stats.wordCount} words</span>
          <span>Avg conf: {(stats.avgConfidence * 100).toFixed(0)}%</span>
          {stats.lowConfidenceCount > 0 && (
            <span style={{ color: '#f59e0b' }}>
              {stats.lowConfidenceCount} low confidence
            </span>
          )}
        </>
      )}

      {!stats && !activeJob && (
        <span>Ready</span>
      )}
    </div>
  );
}
