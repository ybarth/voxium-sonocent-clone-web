import { useEffect, useCallback } from 'react';
import { PlaybackEngine } from '../utils/playbackEngine';
import { SfxEngine, resolveSfxForChunkForm } from '../utils/sfxEngine';
import { TtsEngine, getTtsText, getSectionTtsText } from '../utils/ttsEngine';
import { resolveChunkForm, resolveSectionForm } from '../utils/formResolver';
import { useProjectStore } from '../stores/projectStore';

// Module-level singleton engines — shared across all components
let engineInstance: PlaybackEngine | null = null;
let sfxEngineInstance: SfxEngine | null = null;
let ttsEngineInstance: TtsEngine | null = null;
let engineCallbacksBound = false;

// Track section transitions for TTS announcements
let lastPlayedSectionId: string | null = null;

function getOrCreateEngine(): PlaybackEngine {
  if (!engineInstance) {
    const ctx = useProjectStore.getState().initAudioContext();
    engineInstance = new PlaybackEngine(ctx);

    // Also create the SFX engine on the same context
    sfxEngineInstance = new SfxEngine(ctx);
    sfxEngineInstance.synthesizeAll();

    // Create TTS engine and link main gain for ducking
    ttsEngineInstance = new TtsEngine();
    ttsEngineInstance.setMainGainNode(engineInstance.mainGainNode);
  }

  if (!engineCallbacksBound) {
    engineCallbacksBound = true;
    const store = useProjectStore;

    engineInstance.onCursor((_chunkId, position, time) => {
      store.getState().setCursorPositionInChunk(position);
      store.getState().setCursorTime(time);
    });

    engineInstance.onChunk((chunkId) => {
      const state = store.getState();
      state.setCurrentChunk(chunkId);
      // Auto-paint chunks during playback when painting mode is active
      if (state.playback.paintingColor) {
        state.paintChunk(chunkId, state.playback.paintingColor);
      }

      const chunk = state.project.chunks.find((c) => c.id === chunkId);
      if (!chunk) return;

      // Play 'start' SFX for the entering chunk (form-based with legacy fallback)
      if (sfxEngineInstance) {
        const sfxRef = resolveSfxForChunkForm(
          chunk, state.project.scheme, state.project.settings.defaultAttributes,
          'start', state.project.settings.sfxMappings
        );
        if (sfxRef) sfxEngineInstance.playSfx(sfxRef);
      }

      const ttsConfig = state.project.settings.ttsConfig;
      if (ttsEngineInstance && ttsConfig.enabled) {
        const activeChunks = state.project.chunks.filter((c) => !c.isDeleted);
        const activeSections = state.project.sections.filter((s) => s.status === 'active');
        const projectChunkNumber = activeChunks.findIndex((c) => c.id === chunkId) + 1;

        // Section-relative chunk number
        const sectionChunks = activeChunks.filter((c) => c.sectionId === chunk.sectionId);
        const sectionChunkNumber = sectionChunks.findIndex((c) => c.id === chunkId) + 1;

        const sectionIndex = activeSections.findIndex((s) => s.id === chunk.sectionId);
        const sectionNumber = sectionIndex + 1;
        const section = state.project.sections.find((s) => s.id === chunk.sectionId);

        // Detect section transition
        const sectionChanged = lastPlayedSectionId !== chunk.sectionId;

        if (sectionChanged && ttsConfig.announceSections &&
            (ttsConfig.sectionAnnounceAt === 'begin' || ttsConfig.sectionAnnounceAt === 'both')) {
          // Play section SFX if configured
          if (sfxEngineInstance && section?.sectionFormId) {
            const resolvedSectionForm = resolveSectionForm(
              section.sectionFormId, state.project.sectionScheme
            );
            if (resolvedSectionForm.sound &&
                (resolvedSectionForm.sound.trigger === 'section-begin' || resolvedSectionForm.sound.trigger === 'both')) {
              const vol = resolvedSectionForm.sound.volume ?? resolvedSectionForm.sound.sfxRef.volume;
              sfxEngineInstance.playSfx({ ...resolvedSectionForm.sound.sfxRef, volume: vol });
            }
          }

          // Speak section name
          const sectionText = getSectionTtsText(section?.name, sectionNumber);
          const sectionVoice = section?.sectionFormId
            ? resolveSectionForm(section.sectionFormId, state.project.sectionScheme).voice ?? undefined
            : undefined;
          ttsEngineInstance.speak(sectionText, ttsConfig, sectionVoice);
        }

        lastPlayedSectionId = chunk.sectionId;

        // TTS announcement at chunk start
        if (ttsConfig.announceAt === 'start' || ttsConfig.announceAt === 'both') {
          const colorEntry = state.project.colorKey.colors.find((c) => c.hex === (chunk.style?.color ?? chunk.color));
          const resolvedForm = resolveChunkForm(chunk, state.project.scheme, state.project.settings.defaultAttributes);
          const formLabel = resolvedForm.label || colorEntry?.label;
          const text = getTtsText(
            ttsConfig.contentMode, ttsConfig.chunkCountingMode,
            projectChunkNumber, sectionChunkNumber, sectionNumber,
            section?.name, formLabel
          );
          ttsEngineInstance.speak(text, ttsConfig, resolvedForm.voice ?? undefined);
        }
      }
    });

    engineInstance.onChunkEnd((chunkId) => {
      const state = store.getState();
      const chunk = state.project.chunks.find((c) => c.id === chunkId);
      if (!chunk) return;

      // Play 'end' SFX for the exiting chunk (form-based with legacy fallback)
      if (sfxEngineInstance) {
        const sfxRef = resolveSfxForChunkForm(
          chunk, state.project.scheme, state.project.settings.defaultAttributes,
          'end', state.project.settings.sfxMappings
        );
        if (sfxRef) sfxEngineInstance.playSfx(sfxRef);
      }

      const ttsConfig = state.project.settings.ttsConfig;
      if (ttsEngineInstance && ttsConfig.enabled) {
        const activeChunks = state.project.chunks.filter((c) => !c.isDeleted);
        const activeSections = state.project.sections.filter((s) => s.status === 'active');
        const projectChunkNumber = activeChunks.findIndex((c) => c.id === chunkId) + 1;

        const sectionChunks = activeChunks.filter((c) => c.sectionId === chunk.sectionId);
        const sectionChunkNumber = sectionChunks.findIndex((c) => c.id === chunkId) + 1;

        const sectionIndex = activeSections.findIndex((s) => s.id === chunk.sectionId);
        const sectionNumber = sectionIndex + 1;
        const section = state.project.sections.find((s) => s.id === chunk.sectionId);

        // Detect section ending: check if next active chunk has different sectionId
        const chunkIndex = activeChunks.findIndex((c) => c.id === chunkId);
        const nextChunk = chunkIndex >= 0 ? activeChunks[chunkIndex + 1] : undefined;
        const sectionEnding = !nextChunk || nextChunk.sectionId !== chunk.sectionId;

        if (sectionEnding && ttsConfig.announceSections &&
            (ttsConfig.sectionAnnounceAt === 'end' || ttsConfig.sectionAnnounceAt === 'both')) {
          // Play section end SFX if configured
          if (sfxEngineInstance && section?.sectionFormId) {
            const resolvedSectionForm = resolveSectionForm(
              section.sectionFormId, state.project.sectionScheme
            );
            if (resolvedSectionForm.sound &&
                (resolvedSectionForm.sound.trigger === 'section-end' || resolvedSectionForm.sound.trigger === 'both')) {
              const vol = resolvedSectionForm.sound.volume ?? resolvedSectionForm.sound.sfxRef.volume;
              sfxEngineInstance.playSfx({ ...resolvedSectionForm.sound.sfxRef, volume: vol });
            }
          }

          // Speak section end
          const sectionText = `End of ${getSectionTtsText(section?.name, sectionNumber)}`;
          const sectionVoice = section?.sectionFormId
            ? resolveSectionForm(section.sectionFormId, state.project.sectionScheme).voice ?? undefined
            : undefined;
          ttsEngineInstance.speak(sectionText, ttsConfig, sectionVoice);
        }

        // TTS announcement at chunk end
        if (ttsConfig.announceAt === 'end' || ttsConfig.announceAt === 'both') {
          const colorEntry = state.project.colorKey.colors.find((c) => c.hex === (chunk.style?.color ?? chunk.color));
          const resolvedForm = resolveChunkForm(chunk, state.project.scheme, state.project.settings.defaultAttributes);
          const formLabel = resolvedForm.label || colorEntry?.label;
          const text = getTtsText(
            ttsConfig.contentMode, ttsConfig.chunkCountingMode,
            projectChunkNumber, sectionChunkNumber, sectionNumber,
            section?.name, formLabel
          );
          ttsEngineInstance.speak(text, ttsConfig, resolvedForm.voice ?? undefined);
        }
      }
    });

    // Play boundary SFX when transitioning between chunks
    engineInstance.onBoundary((exitingId, enteringId) => {
      const state = store.getState();
      if (!sfxEngineInstance) return;

      // Check exiting chunk for boundary trigger
      const exitingChunk = state.project.chunks.find((c) => c.id === exitingId);
      if (exitingChunk) {
        const sfxRef = resolveSfxForChunkForm(
          exitingChunk, state.project.scheme, state.project.settings.defaultAttributes,
          'boundary', state.project.settings.sfxMappings
        );
        if (sfxRef) sfxEngineInstance.playSfx(sfxRef);
      }

      // Also check entering chunk (in case it has a boundary trigger too)
      const enteringChunk = state.project.chunks.find((c) => c.id === enteringId);
      if (enteringChunk) {
        const sfxRef = resolveSfxForChunkForm(
          enteringChunk, state.project.scheme, state.project.settings.defaultAttributes,
          'boundary', state.project.settings.sfxMappings
        );
        if (sfxRef) sfxEngineInstance.playSfx(sfxRef);
      }
    });

    engineInstance.onEnd(() => {
      const state = store.getState();
      state.setPlaying(false);
      state.setCurrentChunk(null);
      state.setCursorPositionInChunk(0);
      if (state.playback.paintingColor) {
        state.setPaintingColor(null);
      }
      // Reset section tracking
      lastPlayedSectionId = null;
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
  const sfxMappings = useProjectStore((s) => s.project.settings.sfxMappings);

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

  // Preload custom SFX when mappings change (e.g., after applying a template)
  useEffect(() => {
    if (sfxEngineInstance && sfxMappings.length > 0) {
      sfxEngineInstance.preloadMappings(sfxMappings);
    }
  }, [sfxMappings]);
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

/** Get the SFX engine instance (for preview in config panels) */
export function getSfxEngine(): SfxEngine | null {
  return sfxEngineInstance;
}

/** Get the TTS engine instance (for preview in config panels) */
export function getTtsEngine(): TtsEngine | null {
  return ttsEngineInstance;
}
