import { useRef, useState, useCallback, useEffect } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { decodeAudioFile, segmentAudio } from '../utils/audioProcessing';

export function useRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [level, setLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef<number | null>(null);

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

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm',
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      stopLevelMeter();
      stream.getTracks().forEach((t) => t.stop());

      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const file = new File([blob], `recording-${Date.now()}.webm`, {
        type: 'audio/webm',
      });

      // Use getState() to avoid stale closures
      const store = useProjectStore.getState();
      const ctx = store.initAudioContext();
      const bufRef = await decodeAudioFile(file, ctx);
      store.addAudioBuffer(bufRef);

      const project = useProjectStore.getState().project;
      const sectionId = project.sections[project.sections.length - 1]?.id;
      if (sectionId && bufRef.decodedBuffer) {
        const existingChunks = project.chunks.filter(
          (c) => c.sectionId === sectionId && !c.isDeleted
        );
        const startIndex = existingChunks.length;

        const newChunks = segmentAudio(
          bufRef.decodedBuffer,
          bufRef.id,
          sectionId,
          {
            silenceThresholdDb: project.settings.silenceThresholdDb,
            minSilenceDurationMs: project.settings.minSilenceDurationMs,
            minChunkDurationMs: project.settings.minChunkDurationMs,
          }
        );

        newChunks.forEach((c, i) => {
          c.orderIndex = startIndex + i;
        });

        useProjectStore.getState().addChunks(newChunks);
      }
    };

    mediaRecorder.start(100);
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);
    setIsPaused(false);
    startLevelMeter(stream);
  }, [startLevelMeter, stopLevelMeter]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLevelMeter();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [stopLevelMeter]);

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
