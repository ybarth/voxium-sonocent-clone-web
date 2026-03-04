import { useCallback, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { TextPaneToolbar } from './TextPaneToolbar';
import { TextPaneContent } from './TextPaneContent';
import { TextPaneStatusBar } from './TextPaneStatusBar';
import { ClarificationPanel } from './ClarificationPanel';
import { AlternativesPopover } from './AlternativesPopover';
import { TextContextMenu } from './TextContextMenu';
import { useTranscriptionSync } from '../../hooks/useTranscriptionSync';
import { useProjectStore, getOrderedChunks } from '../../stores/projectStore';
import { extractChunkAudio, getChunkOffsets } from '../../utils/audioExtractor';
import { transcribe } from '../../utils/transcriptionEngine';
import { mapWordsToChunks } from '../../utils/wordChunkMapper';
import type { TranscriptionScope, TranscribedWord, TranscriptionJob } from '../../types/transcription';

interface PopoverState {
  wordId: string;
  x: number;
  y: number;
}

export function TextPane() {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [contextMenu, setContextMenu] = useState<PopoverState | null>(null);
  const [alternativesPopover, setAlternativesPopover] = useState<PopoverState | null>(null);
  const [showChunkBorders, setShowChunkBorders] = useState(false);
  const { activeWordId, highlightedWordIds } = useTranscriptionSync();
  const classicMode = useProjectStore(s => s.project.settings.classicMode);

  const handleTranscribe = useCallback(async (scope: TranscriptionScope) => {
    const state = useProjectStore.getState();
    const { project, audioContext: existingCtx } = state;
    const settings = project.transcription.settings;

    // Resolve chunk IDs from scope
    let chunkIds: string[];
    if (scope.type === 'chunk') {
      chunkIds = scope.chunkIds;
    } else if (scope.type === 'section') {
      chunkIds = project.chunks
        .filter(c => scope.sectionIds.includes(c.sectionId) && !c.isDeleted)
        .map(c => c.id);
    } else {
      chunkIds = getOrderedChunks(project.chunks, project.sections).map(c => c.id);
    }

    if (chunkIds.length === 0) return;

    // Create job
    const job: TranscriptionJob = {
      id: uuid(),
      status: 'pending',
      scope,
      provider: settings.defaultProvider,
      model: settings.defaultProvider === 'openai-whisper' ? 'whisper-1' : 'google-stt',
      chunkIds,
      startedAt: Date.now(),
      completedAt: null,
      error: null,
      progress: 0,
      cost: null,
    };

    state.startTranscriptionJob(job);
    setIsTranscribing(true);

    try {
      // Get ordered chunks for extraction
      const chunks = chunkIds.map(id => project.chunks.find(c => c.id === id)!).filter(Boolean);
      const chunkOffsets = getChunkOffsets(chunks);

      // Extract audio
      state.updateJobStatus(job.id, 'extracting-audio', { progress: 0.1 });
      const ctx = existingCtx || state.initAudioContext();
      const audioBlob = extractChunkAudio(chunks, project.audioBuffers, ctx);

      // Transcribe
      state.updateJobStatus(job.id, 'transcribing', { progress: 0.3 });
      const providerName = settings.defaultProvider;
      const fallback = providerName === 'openai-whisper' ? 'google-stt' : 'openai-whisper';

      const response = await transcribe(
        {
          audioBlob,
          language: settings.language || undefined,
          enableDiarization: settings.enableMultiSpeaker,
          maxSpeakers: settings.maxSpeakers,
        },
        providerName,
        fallback,
      );

      // Map words
      state.updateJobStatus(job.id, 'mapping-words', { progress: 0.7 });

      // Convert provider words to TranscribedWords with absolute timestamps
      const transcribedWords: TranscribedWord[] = response.words.map(pw => {
        let absoluteStart = pw.startTime;
        let absoluteEnd = pw.endTime;

        for (const chunk of chunks) {
          const offset = chunkOffsets.get(chunk.id);
          if (!offset) continue;
          const chunkEnd = offset.offsetInExtracted + offset.duration;

          if (pw.startTime >= offset.offsetInExtracted && pw.startTime < chunkEnd) {
            const relativeInChunk = pw.startTime - offset.offsetInExtracted;
            absoluteStart = chunk.startTime + relativeInChunk;
            absoluteEnd = chunk.startTime + (pw.endTime - offset.offsetInExtracted);
            break;
          }
        }

        return {
          id: uuid(),
          text: pw.text,
          startTime: absoluteStart,
          endTime: absoluteEnd,
          confidence: pw.confidence,
          contextualConfidence: 0,
          speakerId: pw.speakerLabel || null,
          source: 'transcription' as const,
          alternatives: [],
          flags: pw.confidence < settings.confidenceThreshold ? ['low-confidence' as const] : [],
        };
      });

      // Create word-chunk mappings
      const mappings = mapWordsToChunks(transcribedWords, chunks);

      // Add speakers if diarization detected them
      if (response.speakers && response.speakers.length > 0) {
        const speakerColors = ['#3B82F6', '#22C55E', '#EAB308', '#EC4899', '#8B5CF6', '#F97316'];
        for (let i = 0; i < response.speakers.length; i++) {
          state.addSpeaker({
            id: response.speakers[i],
            label: `Speaker ${i + 1}`,
            color: speakerColors[i % speakerColors.length],
          });
        }
      }

      // Remove existing words/mappings for these chunks (re-transcription)
      const existingMappings = state.project.transcription.wordChunkMappings;
      const existingWords = state.project.transcription.words;
      const chunkIdSet = new Set(chunkIds);

      const wordIdsToRemove = new Set(
        existingMappings
          .filter(m => chunkIdSet.has(m.chunkId))
          .map(m => m.wordId)
      );

      const keptWords = existingWords.filter(w => !wordIdsToRemove.has(w.id));
      const keptMappings = existingMappings.filter(m => !chunkIdSet.has(m.chunkId));

      // Store results
      state.pushUndo('transcribe');
      state.setTranscriptionWords([...keptWords, ...transcribedWords]);
      state.setWordChunkMappings([...keptMappings, ...mappings]);

      // Clear stale status for re-transcribed chunks
      state.clearStaleChunks(chunkIds);

      state.updateJobStatus(job.id, 'completed', {
        progress: 1,
        completedAt: Date.now(),
      });
    } catch (err: any) {
      console.error('Transcription failed:', err);
      state.updateJobStatus(job.id, 'failed', {
        error: err.message || 'Unknown error',
        completedAt: Date.now(),
      });
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const handleWordClick = useCallback((wordId: string, chunkId: string) => {
    const state = useProjectStore.getState();
    const mappings = state.project.transcription.wordChunkMappings;
    const mapping = mappings.find(m => m.wordId === wordId && m.chunkId === chunkId);
    if (mapping) {
      state.placeCursorInChunk(chunkId, mapping.startFraction);
    }
  }, []);

  const handleWordContextMenu = useCallback((e: React.MouseEvent, wordId: string) => {
    setContextMenu({ wordId, x: e.clientX, y: e.clientY });
  }, []);

  const handleShowAlternatives = useCallback((wordId: string, x: number, y: number) => {
    setAlternativesPopover({ wordId, x, y });
  }, []);

  const handleRetranscribe = useCallback((chunkId: string) => {
    handleTranscribe({ type: 'chunk', chunkIds: [chunkId] });
  }, [handleTranscribe]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: classicMode ? '#ffffff' : '#0d0d18',
        color: classicMode ? '#1a1a2a' : '#d0d0e0',
      }}
    >
      <TextPaneToolbar
        onTranscribe={handleTranscribe}
        isTranscribing={isTranscribing}
        showChunkBorders={showChunkBorders}
        onToggleChunkBorders={() => setShowChunkBorders(v => !v)}
      />
      <TextPaneContent
        activeWordId={activeWordId}
        highlightedWordIds={highlightedWordIds}
        onWordClick={handleWordClick}
        onWordContextMenu={handleWordContextMenu}
        showChunkBorders={showChunkBorders}
      />
      <ClarificationPanel />
      <TextPaneStatusBar />

      {/* Context menu overlay */}
      {contextMenu && (
        <TextContextMenu
          wordId={contextMenu.wordId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onShowAlternatives={handleShowAlternatives}
          onRetranscribe={handleRetranscribe}
        />
      )}

      {/* Alternatives popover */}
      {alternativesPopover && (
        <AlternativesPopover
          wordId={alternativesPopover.wordId}
          x={alternativesPopover.x}
          y={alternativesPopover.y}
          onClose={() => setAlternativesPopover(null)}
        />
      )}
    </div>
  );
}
