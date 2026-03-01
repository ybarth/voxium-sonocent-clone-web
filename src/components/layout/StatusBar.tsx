import { useProjectStore } from '../../stores/projectStore';

export function StatusBar() {
  const project = useProjectStore((s) => s.project);
  const playback = useProjectStore((s) => s.playback);
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

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '4px 16px',
        backgroundColor: '#0a0a14',
        borderTop: '1px solid #1a1a2e',
        fontSize: '11px',
        color: '#505060',
        flexShrink: 0,
        height: '28px',
      }}
    >
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
    </div>
  );
}
