import { useEffect, useCallback } from 'react';
import { PlaybackEngine } from '../utils/playbackEngine';
import { useProjectStore } from '../stores/projectStore';

// Module-level singleton engine — shared across all components
let engineInstance: PlaybackEngine | null = null;
let engineCallbacksBound = false;

function getOrCreateEngine(): PlaybackEngine {
  if (!engineInstance) {
    const ctx = useProjectStore.getState().initAudioContext();
    engineInstance = new PlaybackEngine(ctx);
  }

  if (!engineCallbacksBound) {
    engineCallbacksBound = true;
    const store = useProjectStore;

    engineInstance.onCursor((_chunkId, position, time) => {
      store.getState().setCursorPositionInChunk(position);
      store.getState().setCursorTime(time);
    });

    engineInstance.onChunk((chunkId) => {
      store.getState().setCurrentChunk(chunkId);
    });

    engineInstance.onEnd(() => {
      store.getState().setPlaying(false);
      store.getState().setCurrentChunk(null);
      store.getState().setCursorPositionInChunk(0);
    });
  }

  return engineInstance;
}

/**
 * Hook to sync playback engine with store state.
 * Call this ONCE in a top-level component (e.g., App or AppLayout).
 */
export function usePlaybackSync() {
  const audioBuffers = useProjectStore((s) => s.project.audioBuffers);
  const chunks = useProjectStore((s) => s.project.chunks);
  const sections = useProjectStore((s) => s.project.sections);
  const volume = useProjectStore((s) => s.project.settings.volume);
  const playbackSpeed = useProjectStore((s) => s.project.settings.playbackSpeed);

  // Sync buffers and chunks whenever they change
  useEffect(() => {
    const engine = getOrCreateEngine();
    const bufferMap = new Map<string, AudioBuffer>();
    for (const ref of audioBuffers) {
      if (ref.decodedBuffer) {
        bufferMap.set(ref.id, ref.decodedBuffer);
      }
    }
    engine.setBuffers(bufferMap);
    engine.setChunks(chunks, sections);
  }, [audioBuffers, chunks, sections]);

  // Sync volume and speed
  useEffect(() => {
    const engine = getOrCreateEngine();
    engine.setVolume(volume);
    engine.setPlaybackRate(playbackSpeed);
  }, [volume, playbackSpeed]);
}

/**
 * Hook to get playback controls. Safe to call from multiple components.
 * Does NOT create new engine instances.
 */
export function usePlayback() {
  const isPlaying = useProjectStore((s) => s.playback.isPlaying);
  const currentChunkId = useProjectStore((s) => s.playback.currentChunkId);
  const cursorPosition = useProjectStore((s) => s.playback.cursorPositionInChunk);
  const setPlaying = useProjectStore((s) => s.setPlaying);
  const setCurrentChunk = useProjectStore((s) => s.setCurrentChunk);

  const togglePlay = useCallback(() => {
    const engine = getOrCreateEngine();
    engine.togglePlay();
    setPlaying(engine.playing);
  }, [setPlaying]);

  const play = useCallback(() => {
    const engine = getOrCreateEngine();
    engine.play();
    setPlaying(true);
  }, [setPlaying]);

  const pause = useCallback(() => {
    const engine = getOrCreateEngine();
    engine.pause();
    setPlaying(false);
  }, [setPlaying]);

  const stop = useCallback(() => {
    const engine = getOrCreateEngine();
    engine.stop();
    setPlaying(false);
  }, [setPlaying]);

  const seekToChunk = useCallback(
    (chunkId: string, offset = 0) => {
      const engine = getOrCreateEngine();
      engine.seekToChunk(chunkId, offset);
      setCurrentChunk(chunkId);
    },
    [setCurrentChunk]
  );

  return {
    isPlaying,
    currentChunkId,
    cursorPosition,
    togglePlay,
    play,
    pause,
    stop,
    seekToChunk,
  };
}
