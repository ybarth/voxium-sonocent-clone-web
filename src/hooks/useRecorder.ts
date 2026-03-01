import { useRef, useState, useCallback, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { useProjectStore } from '../stores/projectStore';
import { decodeAudioFile, segmentAudio } from '../utils/audioProcessing';
import type { Chunk } from '../types';

export function useRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [level, setLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Live chunk processing refs
  const liveBufferIdRef = useRef<string | null>(null);
  const processIntervalRef = useRef<number | null>(null);
  const isPausedRef = useRef(false);
  const recordStartTimeRef = useRef(0);
  const pausedDurationRef = useRef(0);
  const pauseStartTimeRef = useRef(0);

  const cleanupLiveProcessing = useCallback(() => {
    if (processIntervalRef.current) {
      clearInterval(processIntervalRef.current);
      processIntervalRef.current = null;
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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    isPausedRef.current = false;
    recordStartTimeRef.current = performance.now();
    pausedDurationRef.current = 0;

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm',
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    // Create a live buffer ID to track live chunks
    const liveBufferId = uuid();
    liveBufferIdRef.current = liveBufferId;

    const ctx = useProjectStore.getState().initAudioContext();

    // Capture section info for live chunks
    const project = useProjectStore.getState().project;
    const sectionId = project.sections[project.sections.length - 1]?.id;
    const existingCount = sectionId
      ? project.chunks.filter(
          (c) => c.sectionId === sectionId && !c.isDeleted
        ).length
      : 0;

    // Track whether we've successfully used real segmentation
    let usingRealSegments = false;
    let isProcessing = false;

    // Periodic live update every 300ms
    processIntervalRef.current = window.setInterval(async () => {
      if (!sectionId || isPausedRef.current || isProcessing) return;
      isProcessing = true;

      try {
        // Try real segmentation from accumulated MediaRecorder blobs
        if (chunksRef.current.length >= 2) {
          try {
            const blob = new Blob([...chunksRef.current], {
              type: 'audio/webm',
            });
            const ab = await blob.arrayBuffer();
            // slice(0) creates a copy since decodeAudioData may detach the buffer
            const decoded = await ctx.decodeAudioData(ab.slice(0));

            const settings = useProjectStore.getState().project.settings;
            const liveChunks = segmentAudio(
              decoded,
              liveBufferId,
              sectionId,
              {
                silenceThresholdDb: settings.silenceThresholdDb,
                minSilenceDurationMs: settings.minSilenceDurationMs,
                minChunkDurationMs: settings.minChunkDurationMs,
              }
            );

            liveChunks.forEach((c, i) => {
              c.orderIndex = existingCount + i;
            });

            useProjectStore
              .getState()
              .replaceLiveChunks(liveBufferId, liveChunks);
            usingRealSegments = true;
            return;
          } catch {
            // Blob decoding failed — fall through to timer-based chunk
          }
        }

        // Fallback: show a single growing chunk based on elapsed time
        if (!usingRealSegments) {
          const elapsed =
            (performance.now() -
              recordStartTimeRef.current -
              pausedDurationRef.current) /
            1000;
          if (elapsed < 0.2) return;

          const growingChunk: Chunk = {
            id: uuid(),
            audioBufferId: liveBufferId,
            startTime: 0,
            endTime: elapsed,
            sectionId,
            orderIndex: existingCount,
            color: null,
            isDeleted: false,
            waveformData: null,
          };

          useProjectStore
            .getState()
            .replaceLiveChunks(liveBufferId, [growingChunk]);
        }
      } finally {
        isProcessing = false;
      }
    }, 300);

    mediaRecorder.onstop = async () => {
      stopLevelMeter();
      cleanupLiveProcessing();
      stream.getTracks().forEach((t) => t.stop());

      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const file = new File([blob], `recording-${Date.now()}.webm`, {
        type: 'audio/webm',
      });

      const store = useProjectStore.getState();
      const audioCtx = store.initAudioContext();
      const bufRef = await decodeAudioFile(file, audioCtx);
      store.addAudioBuffer(bufRef);

      const currentProject = useProjectStore.getState().project;
      const finalSectionId =
        currentProject.sections[currentProject.sections.length - 1]?.id;

      if (finalSectionId && bufRef.decodedBuffer) {
        // Exclude live chunks when computing start index
        const existingChunks = currentProject.chunks.filter(
          (c) =>
            c.sectionId === finalSectionId &&
            !c.isDeleted &&
            c.audioBufferId !== liveBufferIdRef.current
        );
        const startIndex = existingChunks.length;

        const newChunks = segmentAudio(
          bufRef.decodedBuffer,
          bufRef.id,
          finalSectionId,
          {
            silenceThresholdDb: currentProject.settings.silenceThresholdDb,
            minSilenceDurationMs:
              currentProject.settings.minSilenceDurationMs,
            minChunkDurationMs: currentProject.settings.minChunkDurationMs,
          }
        );

        newChunks.forEach((c, i) => {
          c.orderIndex = startIndex + i;
        });

        // Atomically replace live chunks with final decoded chunks
        useProjectStore
          .getState()
          .replaceLiveChunks(liveBufferIdRef.current!, newChunks);
      } else if (liveBufferIdRef.current) {
        // No final chunks, just remove live chunks
        useProjectStore
          .getState()
          .replaceLiveChunks(liveBufferIdRef.current, []);
      }
    };

    mediaRecorder.start(100);
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);
    setIsPaused(false);
    startLevelMeter(stream);
  }, [startLevelMeter, stopLevelMeter, cleanupLiveProcessing]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      isPausedRef.current = true;
      pauseStartTimeRef.current = performance.now();
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      isPausedRef.current = false;
      pausedDurationRef.current +=
        performance.now() - pauseStartTimeRef.current;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsPaused(false);
    isPausedRef.current = false;
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
    isPaused,
    level,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  };
}
