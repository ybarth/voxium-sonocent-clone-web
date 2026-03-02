import { useRef, useState, useCallback, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { useProjectStore } from '../stores/projectStore';
import { decodeAudioFile, segmentAudio } from '../utils/audioProcessing';
import { getFlatSectionOrder } from '../utils/sectionTree';
import type { Chunk } from '../types';

interface SectionSpan {
  sectionId: string;
  orderIndex: number;
  startTime: number; // seconds into the recording
}

export function useRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Live chunk processing refs
  const liveBufferIdRef = useRef<string | null>(null);
  const processIntervalRef = useRef<number | null>(null);
  const recordStartTimeRef = useRef(0);

  // Insertion point refs — captured at recording start, synced via subscription
  const insertionSectionRef = useRef<string>('');
  const insertionOrderRef = useRef<number>(0);
  const unsubInsertionPointRef = useRef<(() => void) | null>(null);

  // Section history — tracks which section(s) this recording spans
  const sectionHistoryRef = useRef<SectionSpan[]>([]);
  // IDs of frozen (old section) live buffers to clean up at onstop
  const frozenBufferIdsRef = useRef<string[]>([]);
  // Time offset into the recording when the current section started
  const sectionStartTimeRef = useRef(0);

  const cleanupLiveProcessing = useCallback(() => {
    if (processIntervalRef.current) {
      clearInterval(processIntervalRef.current);
      processIntervalRef.current = null;
    }
    if (unsubInsertionPointRef.current) {
      unsubInsertionPointRef.current();
      unsubInsertionPointRef.current = null;
    }
  }, []);

  const stopLevelMeter = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setLevel(0);
  }, []);

  const startLevelMeter = useCallback((stream: MediaStream) => {
    const ctx = useProjectStore.getState().initAudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const updateLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
      setLevel(avg / 255);
      animFrameRef.current = requestAnimationFrame(updateLevel);
    };
    updateLevel();
  }, []);

  const startRecording = useCallback(async () => {
    const store = useProjectStore.getState();

    // Clear any previous take
    store.clearTake();

    // Determine insertion point
    const ip = store.playback.insertionPoint;
    const project = store.project;
    let sectionId: string;
    let orderIndex: number;

    if (ip) {
      sectionId = ip.sectionId;
      orderIndex = ip.orderIndex;
    } else {
      // Fallback: end of last active section in display order
      const activeSections = project.sections.filter(s => (s.status ?? 'active') === 'active');
      const orderedSections = getFlatSectionOrder(activeSections);
      sectionId = orderedSections[orderedSections.length - 1]?.id ?? activeSections[0]?.id;
      const existingCount = sectionId
        ? project.chunks.filter((c) => c.sectionId === sectionId && !c.isDeleted).length
        : 0;
      orderIndex = existingCount;
    }

    // Bump existing chunks to make room
    store.bumpChunksForInsertion(sectionId, orderIndex, 1000);

    // Store in refs for live interval and onstop
    insertionSectionRef.current = sectionId;
    insertionOrderRef.current = orderIndex;
    sectionStartTimeRef.current = 0;
    sectionHistoryRef.current = [{ sectionId, orderIndex, startTime: 0 }];
    frozenBufferIdsRef.current = [];

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    recordStartTimeRef.current = performance.now();

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm',
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    // Create a live buffer ID to track live chunks
    liveBufferIdRef.current = uuid();

    const ctx = store.initAudioContext();

    // Track whether we've successfully used real segmentation for the current section
    let usingRealSegments = false;
    let isProcessing = false;

    // Subscribe to store changes to detect section redirects during recording
    const unsubInsertionPoint = useProjectStore.subscribe((state) => {
      const newSectionId = state.playback.insertionPoint?.sectionId;
      if (newSectionId && newSectionId !== insertionSectionRef.current) {
        // Update refs FIRST — this prevents recursive re-entry because
        // the freeze below triggers another subscribe call, and if the ref
        // isn't updated yet, the condition passes again causing an infinite loop.
        insertionSectionRef.current = newSectionId;
        insertionOrderRef.current = 0;

        // Freeze old live chunks — rename their audioBufferId so future
        // replaceLiveChunks calls won't touch them
        const oldLiveBufferId = liveBufferIdRef.current!;
        const frozenId = 'frozen-' + uuid();
        const s = useProjectStore.getState();
        const oldChunks = s.project.chunks
          .filter((c) => c.audioBufferId === oldLiveBufferId && !c.isDeleted)
          .map((c) => ({ ...c, audioBufferId: frozenId }));
        s.replaceLiveChunks(oldLiveBufferId, oldChunks);
        frozenBufferIdsRef.current.push(frozenId);

        // New live buffer for the new section
        liveBufferIdRef.current = uuid();

        // Record section switch time and update history
        const switchTime = (performance.now() - recordStartTimeRef.current) / 1000;
        sectionStartTimeRef.current = switchTime;
        sectionHistoryRef.current.push({
          sectionId: newSectionId,
          orderIndex: 0,
          startTime: switchTime,
        });

        // Reset segmentation tracking for the new section
        usingRealSegments = false;
      }
    });

    // Set initial recording head
    store.setRecordingHead({ sectionId, orderIndex });

    // Periodic live update every 300ms
    processIntervalRef.current = window.setInterval(async () => {
      const curSection = insertionSectionRef.current;
      const curLiveBufferId = liveBufferIdRef.current!;
      const curSectionStart = sectionStartTimeRef.current;
      if (!curSection || isProcessing) return;
      isProcessing = true;

      try {
        // Try real segmentation from accumulated MediaRecorder blobs
        if (chunksRef.current.length >= 2) {
          try {
            const blob = new Blob([...chunksRef.current], {
              type: 'audio/webm',
            });
            const ab = await blob.arrayBuffer();
            const decoded = await ctx.decodeAudioData(ab.slice(0));

            // If section was redirected during async decode, skip this update
            if (insertionSectionRef.current !== curSection) return;

            const settings = useProjectStore.getState().project.settings;
            const allChunks = segmentAudio(
              decoded,
              curLiveBufferId,
              curSection,
              {
                silenceThresholdDb: settings.silenceThresholdDb,
                minSilenceDurationMs: settings.minSilenceDurationMs,
                minChunkDurationMs: settings.minChunkDurationMs,
              },
              `live-${curLiveBufferId}`
            );

            // Only keep chunks that start at or after the current section's start time
            const liveChunks = allChunks.filter((c) => c.startTime >= curSectionStart - 0.01);

            liveChunks.forEach((c, i) => {
              c.orderIndex = insertionOrderRef.current + i;
            });

            useProjectStore.getState().updateLiveRecording(
              curLiveBufferId,
              liveChunks,
              {
                sectionId: curSection,
                orderIndex: insertionOrderRef.current + liveChunks.length,
              }
            );
            usingRealSegments = true;
            return;
          } catch {
            // Blob decoding failed — fall through to timer-based chunk
          }
        }

        // Fallback: show a single growing chunk based on elapsed time
        if (!usingRealSegments) {
          const totalElapsed = (performance.now() - recordStartTimeRef.current) / 1000;
          const sectionElapsed = totalElapsed - curSectionStart;
          if (sectionElapsed < 0.2) return;

          const growingChunk: Chunk = {
            id: `live-${curLiveBufferId}-0`,
            audioBufferId: curLiveBufferId,
            startTime: curSectionStart,
            endTime: totalElapsed,
            sectionId: curSection,
            orderIndex: insertionOrderRef.current,
            color: null,
            style: null,
            formId: null,
            isDeleted: false,
            waveformData: null,
          };

          useProjectStore.getState().updateLiveRecording(
            curLiveBufferId,
            [growingChunk],
            {
              sectionId: curSection,
              orderIndex: insertionOrderRef.current + 1,
            }
          );
        }
      } finally {
        isProcessing = false;
      }
    }, 300);

    // Store unsubscribe for cleanup
    unsubInsertionPointRef.current = unsubInsertionPoint;

    mediaRecorder.onstop = async () => {
      stopLevelMeter();
      cleanupLiveProcessing();
      stream.getTracks().forEach((t) => t.stop());

      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const file = new File([blob], `recording-${Date.now()}.webm`, {
        type: 'audio/webm',
      });

      const currentStore = useProjectStore.getState();
      const audioCtx = currentStore.initAudioContext();
      const bufRef = await decodeAudioFile(file, audioCtx);
      currentStore.addAudioBuffer(bufRef);

      if (bufRef.decodedBuffer) {
        const currentProject = useProjectStore.getState().project;
        const allSegments = segmentAudio(
          bufRef.decodedBuffer,
          bufRef.id,
          '', // sectionId placeholder — will be assigned per-span
          {
            silenceThresholdDb: currentProject.settings.silenceThresholdDb,
            minSilenceDurationMs: currentProject.settings.minSilenceDurationMs,
            minChunkDurationMs: currentProject.settings.minChunkDurationMs,
          }
        );

        const history = sectionHistoryRef.current;
        const finalChunks: Chunk[] = [];

        // Assign each segment to the correct section based on time spans
        for (const chunk of allSegments) {
          // Find which section span this chunk belongs to (by its start time)
          let span = history[0];
          for (let i = history.length - 1; i >= 0; i--) {
            if (chunk.startTime >= history[i].startTime - 0.01) {
              span = history[i];
              break;
            }
          }
          finalChunks.push({ ...chunk, sectionId: span.sectionId });
        }

        // Assign orderIndexes per section
        const bySection = new Map<string, Chunk[]>();
        for (const c of finalChunks) {
          const arr = bySection.get(c.sectionId) ?? [];
          arr.push(c);
          bySection.set(c.sectionId, arr);
        }
        for (const [secId, chunks] of bySection) {
          const span = history.find((h) => h.sectionId === secId);
          const baseIndex = span?.orderIndex ?? 0;
          chunks.forEach((c, i) => { c.orderIndex = baseIndex + i; });
        }

        // Remove all frozen chunks and current live chunks, then add final chunks
        const s = useProjectStore.getState();
        // Remove current live chunks
        s.replaceLiveChunks(liveBufferIdRef.current!, []);
        // Remove frozen chunks
        for (const frozenId of frozenBufferIdsRef.current) {
          s.replaceLiveChunks(frozenId, []);
        }
        // Add all final chunks
        s.addChunks(finalChunks);

        // Renumber all affected sections
        for (const secId of bySection.keys()) {
          useProjectStore.getState().renumberSection(secId);
        }

        // Set take state with all final chunk IDs
        const allFinalIds = finalChunks.map((c) => c.id);
        const firstSpan = history[0];
        useProjectStore.getState().setTakeChunkIds(
          allFinalIds,
          firstSpan.sectionId,
          firstSpan.orderIndex
        );
      } else {
        // No final chunks, just remove all live/frozen chunks
        if (liveBufferIdRef.current) {
          useProjectStore.getState().replaceLiveChunks(liveBufferIdRef.current, []);
        }
        for (const frozenId of frozenBufferIdsRef.current) {
          useProjectStore.getState().replaceLiveChunks(frozenId, []);
        }
      }

      useProjectStore.getState().setRecording(false);
    };

    mediaRecorder.start(100);
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);
    store.setRecording(true);
    startLevelMeter(stream);
  }, [startLevelMeter, stopLevelMeter, cleanupLiveProcessing]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLevelMeter();
      cleanupLiveProcessing();
      if (liveBufferIdRef.current) {
        useProjectStore
          .getState()
          .replaceLiveChunks(liveBufferIdRef.current, []);
      }
      for (const frozenId of frozenBufferIdsRef.current) {
        useProjectStore.getState().replaceLiveChunks(frozenId, []);
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [stopLevelMeter, cleanupLiveProcessing]);

  return {
    isRecording,
    level,
    startRecording,
    stopRecording,
  };
}
