import { useEffect, useCallback } from 'react';
import { PlaybackEngine } from '../utils/playbackEngine';
import { SfxEngine, resolveSfxForChunkForm } from '../utils/sfxEngine';
import { TtsEngine, getTtsText, getSectionTtsText } from '../utils/ttsEngine';
import { resolveChunkForm, resolveSectionForm } from '../utils/formResolver';
import { useProjectStore } from '../stores/projectStore';
import { getFlatSectionOrder } from '../utils/sectionTree';
import type { SyntheticLayerMixMode } from '../types';

// Module-level singleton engines — shared across all components
let engineInstance: PlaybackEngine | null = null;
let sfxEngineInstance: SfxEngine | null = null;
let ttsEngineInstance: TtsEngine | null = null;
let engineCallbacksBound = false;

// Synthetic layer singletons
let syntheticEngineInstance: PlaybackEngine | null = null;
let syntheticPanNode: StereoPannerNode | null = null;
let primaryPanNode: StereoPannerNode | null = null;

// Track section transitions for TTS announcements
let lastPlayedSectionId: string | null = null;

function getOrCreateEngine(): PlaybackEngine {
  if (!engineInstance) {
    const ctx = useProjectStore.getState().initAudioContext();
    engineInstance = new PlaybackEngine(ctx);

    // Insert pan node between primary engine gain and destination
    primaryPanNode = ctx.createStereoPanner();
    primaryPanNode.pan.value = 0;
    engineInstance.mainGainNode.disconnect();
    engineInstance.mainGainNode.connect(primaryPanNode);
    primaryPanNode.connect(ctx.destination);

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
 * Get or create the synthetic engine for TTS layer playback.
 * Uses the same AudioContext as the primary engine.
 */
function getOrCreateSyntheticEngine(): PlaybackEngine {
  if (!syntheticEngineInstance) {
    const ctx = useProjectStore.getState().initAudioContext();
    syntheticEngineInstance = new PlaybackEngine(ctx);

    // Insert pan node between synthetic engine gain and destination
    syntheticPanNode = ctx.createStereoPanner();
    syntheticPanNode.pan.value = 0;
    syntheticEngineInstance.mainGainNode.disconnect();
    syntheticEngineInstance.mainGainNode.connect(syntheticPanNode);
    syntheticPanNode.connect(ctx.destination);

    // No SFX/TTS announcement callbacks — synthetic is audio-only
  }
  return syntheticEngineInstance;
}

/** Expose the synthetic engine instance for external sync hooks */
export function getSyntheticEngine(): PlaybackEngine | null {
  return syntheticEngineInstance;
}

/** Expose pan nodes for external control */
export function getPanNodes(): { primary: StereoPannerNode | null; synthetic: StereoPannerNode | null } {
  return { primary: primaryPanNode, synthetic: syntheticPanNode };
}

/**
 * Apply mix mode routing: adjusts volumes and pan values based on the current mode.
 */
export function applyMixMode(mode: SyntheticLayerMixMode, config: {
  primaryVolume: number;
  syntheticVolume: number;
  primaryPan: number;
  syntheticPan: number;
  primaryDuckLevel: number;
  syntheticMuted: boolean;
}) {
  const primaryEngine = engineInstance;
  const syntheticEngine = syntheticEngineInstance;
  const ctx = primaryEngine?.mainGainNode?.context;
  if (!ctx) return;
  const now = ctx.currentTime;

  switch (mode) {
    case 'solo-primary':
      primaryEngine?.setVolume(config.primaryVolume);
      syntheticEngine?.setVolume(0);
      if (primaryPanNode) primaryPanNode.pan.setValueAtTime(0, now);
      if (syntheticPanNode) syntheticPanNode.pan.setValueAtTime(0, now);
      break;

    case 'solo-synthetic':
      primaryEngine?.setVolume(0);
      syntheticEngine?.setVolume(config.syntheticMuted ? 0 : config.syntheticVolume);
      if (primaryPanNode) primaryPanNode.pan.setValueAtTime(0, now);
      if (syntheticPanNode) syntheticPanNode.pan.setValueAtTime(0, now);
      break;

    case 'mix':
      primaryEngine?.setVolume(config.primaryVolume * (1 - config.primaryDuckLevel));
      syntheticEngine?.setVolume(config.syntheticMuted ? 0 : config.syntheticVolume);
      if (primaryPanNode) primaryPanNode.pan.setValueAtTime(0, now);
      if (syntheticPanNode) syntheticPanNode.pan.setValueAtTime(0, now);
      break;

    case 'stereo-split':
      primaryEngine?.setVolume(config.primaryVolume);
      syntheticEngine?.setVolume(config.syntheticMuted ? 0 : config.syntheticVolume);
      if (primaryPanNode) primaryPanNode.pan.setValueAtTime(config.primaryPan, now);
      if (syntheticPanNode) syntheticPanNode.pan.setValueAtTime(config.syntheticPan, now);
      break;
  }
}

/**
 * Sync synthetic engine playback state with primary engine.
 * Primary is leader; synthetic follows.
 */
function syncSyntheticToAction(action: 'play' | 'pause' | 'stop') {
  const synEngine = syntheticEngineInstance;
  if (!synEngine) return;

  const syntheticEnabled = useProjectStore.getState().project.settings.syntheticLayer.enabled;
  if (!syntheticEnabled) return;

  switch (action) {
    case 'play': synEngine.play(); break;
    case 'pause': synEngine.pause(); break;
    case 'stop': synEngine.stop(); break;
  }
}

function syncSyntheticSeek(chunkId: string, offset: number) {
  const synEngine = syntheticEngineInstance;
  if (!synEngine) return;

  const syntheticEnabled = useProjectStore.getState().project.settings.syntheticLayer.enabled;
  if (!syntheticEnabled) return;

  // Seek synthetic to the same chunk (offset proportional to duration ratio)
  synEngine.seekToChunk(chunkId, offset);
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
  const loopMode = useProjectStore((s) => s.project.settings.loopMode);
  const selectedChunkIds = useProjectStore((s) => s.selection.selectedChunkIds);
  const selectedSectionIds = useProjectStore((s) => s.selection.selectedSectionIds);

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

  // Sync loop state
  useEffect(() => {
    const engine = getOrCreateEngine();
    if (!loopMode) {
      engine.setLoop(false);
      return;
    }

    // Build ordered chunks to find indices (mirrors engine's internal ordering)
    const activeSections = sections.filter(s => (s.status ?? 'active') === 'active');
    const activeChunks = chunks.filter(c => !c.isDeleted && activeSections.some(s => s.id === c.sectionId));

    const flatOrder = getFlatSectionOrder(activeSections);
    const sectionPosition = new Map(flatOrder.map((s, i) => [s.id, i]));
    const orderedChunks = [...activeChunks].sort((a, b) => {
      const sA = sectionPosition.get(a.sectionId) ?? 0;
      const sB = sectionPosition.get(b.sectionId) ?? 0;
      if (sA !== sB) return sA - sB;
      return a.orderIndex - b.orderIndex;
    });

    let startIdx = 0;
    let endIdx = orderedChunks.length - 1;

    if (selectedChunkIds.size > 0) {
      // Loop selected chunks — find their min/max index in orderedChunks
      const indices = orderedChunks
        .map((c, i) => selectedChunkIds.has(c.id) ? i : -1)
        .filter(i => i >= 0);
      if (indices.length > 0) {
        startIdx = Math.min(...indices);
        endIdx = Math.max(...indices);
      }
    } else if (selectedSectionIds.size > 0) {
      // Loop chunks within selected sections
      const indices = orderedChunks
        .map((c, i) => selectedSectionIds.has(c.sectionId) ? i : -1)
        .filter(i => i >= 0);
      if (indices.length > 0) {
        startIdx = Math.min(...indices);
        endIdx = Math.max(...indices);
      }
    }

    engine.setLoop(true, startIdx, endIdx);
  }, [loopMode, selectedChunkIds, selectedSectionIds, chunks, sections]);

  // Preload custom SFX when mappings change (e.g., after applying a template)
  useEffect(() => {
    if (sfxEngineInstance && sfxMappings.length > 0) {
      sfxEngineInstance.preloadMappings(sfxMappings);
    }
  }, [sfxMappings]);

  // ─── Synthetic layer sync ─────────────────────────────────────────────────

  const syntheticConfig = useProjectStore((s) => s.project.settings.syntheticLayer);

  // Sync synthetic engine playback rate when speed changes
  useEffect(() => {
    if (!syntheticConfig.enabled || !syntheticEngineInstance) return;
    syntheticEngineInstance.setPlaybackRate(playbackSpeed);
  }, [playbackSpeed, syntheticConfig.enabled]);

  // Sync synthetic engine loop state
  useEffect(() => {
    if (!syntheticConfig.enabled || !syntheticEngineInstance) return;
    // Mirror loop settings from primary engine
    const engine = getOrCreateEngine();
    // The synthetic engine shares the same loop config
    if (!loopMode) {
      syntheticEngineInstance.setLoop(false);
    }
    // Loop sync handled by the primary engine's loop effect — same indices apply
  }, [loopMode, syntheticConfig.enabled]);

  // Sync mix mode and volume routing
  useEffect(() => {
    if (!syntheticConfig.enabled) {
      // Reset primary to full volume and center pan when synthetic disabled
      const engine = getOrCreateEngine();
      engine.setVolume(volume);
      if (primaryPanNode) {
        const ctx = primaryPanNode.context;
        primaryPanNode.pan.setValueAtTime(0, ctx.currentTime);
      }
      return;
    }

    // Ensure synthetic engine exists
    getOrCreateSyntheticEngine();

    applyMixMode(syntheticConfig.mixMode, {
      primaryVolume: volume,
      syntheticVolume: syntheticConfig.volume,
      primaryPan: syntheticConfig.primaryPan,
      syntheticPan: syntheticConfig.syntheticPan,
      primaryDuckLevel: syntheticConfig.primaryDuckLevel,
      syntheticMuted: syntheticConfig.muted,
    });
  }, [
    syntheticConfig.enabled, syntheticConfig.mixMode, syntheticConfig.volume,
    syntheticConfig.muted, syntheticConfig.primaryPan, syntheticConfig.syntheticPan,
    syntheticConfig.primaryDuckLevel, volume,
  ]);
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
    syncSyntheticToAction(engine.playing ? 'play' : 'pause');
  }, [setPlaying]);

  const play = useCallback(() => {
    const engine = getOrCreateEngine();
    engine.play();
    setPlaying(true);
    syncSyntheticToAction('play');
  }, [setPlaying]);

  const pause = useCallback(() => {
    const engine = getOrCreateEngine();
    engine.pause();
    setPlaying(false);
    syncSyntheticToAction('pause');
  }, [setPlaying]);

  const stop = useCallback(() => {
    const engine = getOrCreateEngine();
    engine.stop();
    setPlaying(false);
    syncSyntheticToAction('stop');
  }, [setPlaying]);

  const seekToChunk = useCallback(
    (chunkId: string, offset = 0) => {
      const engine = getOrCreateEngine();
      engine.seekToChunk(chunkId, offset);
      setCurrentChunk(chunkId);
      syncSyntheticSeek(chunkId, offset);
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
