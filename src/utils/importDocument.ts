/**
 * Document import pipeline — orchestrates parsing, AI analysis,
 * section/chunk creation, word building, and TTS generation.
 */

import { v4 as uuid } from 'uuid';
import type {
  DocumentAsset,
  DocumentImportJob,
  DocumentImportOptions,
  DocumentTextSpan,
  ChunkExpressivity,
  DocumentDivisionPlan,
} from '../types/document';
import type { Chunk, AudioBufferRef, Section } from '../types';
import type { TranscribedWord, WordChunkMapping } from '../types/transcription';
import { useProjectStore } from '../stores/projectStore';
import { parseDocument, detectFormat } from './documentParser';
import { analyzeDocument } from './documentDivisionAnalyzer';
import { mapWordsToChunks } from './wordChunkMapper';

// ─── Import Pipeline ────────────────────────────────────────────────────────

export async function importDocumentFile(
  file: File,
  options: DocumentImportOptions,
): Promise<DocumentAsset> {
  const store = useProjectStore.getState();
  // Ensure the store's audioContext is initialized (needed for synthetic layer sync)
  const audioContext = store.initAudioContext();
  const format = detectFormat(file);
  if (!format) throw new Error(`Unsupported file format: ${file.name}`);

  // Create import job
  const jobId = uuid();
  const documentAssetId = uuid();
  const job: DocumentImportJob = {
    id: jobId,
    documentAssetId,
    status: 'pending',
    progress: 0,
    startedAt: Date.now(),
    completedAt: null,
    error: null,
  };
  store.addDocumentImportJob(job);

  try {
    // ── Step 1: Parse ──────────────────────────────────────────────────
    store.updateDocumentImportJob(jobId, { status: 'parsing', progress: 0.05 });
    const parseResult = await parseDocument(file, format);

    // ── Step 2: AI Analysis ────────────────────────────────────────────
    store.updateDocumentImportJob(jobId, { status: 'ai-dividing', progress: 0.1 });
    const plan = await analyzeDocument(
      parseResult.plainText,
      parseResult.structure,
      options,
      (status, progress) => {
        const mappedStatus = status.includes('section') ? 'ai-dividing' as const
          : status.includes('Chunking') ? 'ai-chunking' as const
          : status.includes('expressivity') ? 'ai-expressivity' as const
          : 'ai-dividing' as const;
        store.updateDocumentImportJob(jobId, { status: mappedStatus, progress: 0.1 + progress * 0.4 });
      },
    );

    // ── Step 3: Create sections and chunks ─────────────────────────────
    store.updateDocumentImportJob(jobId, { status: 'building-words', progress: 0.5 });
    store.pushUndo('import-document');

    const createdSectionIds: string[] = [];
    const allWords: TranscribedWord[] = [];
    const allMappings: WordChunkMapping[] = [];
    const allChunks: Chunk[] = [];
    const allWordSpans: DocumentTextSpan[] = [];
    const allExpressivity: Record<string, ChunkExpressivity> = {};

    for (const section of plan.sections) {
      // Create section
      const newSection = store.addSection(section.name);
      createdSectionIds.push(newSection.id);

      // Create a virtual silent AudioBuffer for this section
      const sectionText = parseResult.plainText.substring(section.startCharOffset, section.endCharOffset);
      const wordCount = sectionText.split(/\s+/).filter(Boolean).length;
      const estimatedDuration = Math.max(1, (wordCount / 150) * 60); // 150 wpm

      const silentBuffer = audioContext.createBuffer(
        1,
        Math.max(1, Math.round(estimatedDuration * audioContext.sampleRate)),
        audioContext.sampleRate,
      );

      const audioBufferRef: AudioBufferRef = {
        id: uuid(),
        originalFileName: `${file.name}__${section.name}`,
        blob: new Blob(), // empty blob placeholder
        decodedBuffer: silentBuffer,
        sampleRate: audioContext.sampleRate,
        duration: estimatedDuration,
      };
      store.addAudioBuffer(audioBufferRef);

      // Create chunks from the AI division plan
      let chunkTimeOffset = 0;
      const totalChars = section.endCharOffset - section.startCharOffset;

      for (let ci = 0; ci < section.chunks.length; ci++) {
        const chunkPlan = section.chunks[ci];
        const chunkChars = chunkPlan.endCharOffset - chunkPlan.startCharOffset;
        const chunkDuration = totalChars > 0
          ? (chunkChars / totalChars) * estimatedDuration
          : estimatedDuration / section.chunks.length;

        const chunkId = uuid();
        const chunk: Chunk = {
          id: chunkId,
          audioBufferId: audioBufferRef.id,
          startTime: chunkTimeOffset,
          endTime: chunkTimeOffset + chunkDuration,
          sectionId: newSection.id,
          orderIndex: ci,
          color: null,
          style: null,
          formId: null,
          tags: [],
          isDeleted: false,
          waveformData: null,
        };
        allChunks.push(chunk);

        // Build TranscribedWords for this chunk
        const chunkText = chunkPlan.text;
        const wordTokens = chunkText.split(/\s+/).filter(Boolean);
        const chunkWords: TranscribedWord[] = [];
        let wordTimeOffset = chunkTimeOffset;
        const wordDuration = chunkDuration / Math.max(1, wordTokens.length);

        let charCursor = chunkPlan.startCharOffset;
        for (let wi = 0; wi < wordTokens.length; wi++) {
          const wordText = wordTokens[wi];
          const wordId = uuid();

          const word: TranscribedWord = {
            id: wordId,
            text: wordText,
            startTime: wordTimeOffset,
            endTime: wordTimeOffset + wordDuration,
            confidence: 1.0,
            contextualConfidence: 1.0,
            source: 'manual',
            speakerId: null,
            alternatives: [],
            flags: [],
          };
          chunkWords.push(word);
          allWords.push(word);

          // Build DocumentTextSpan
          const wordCharStart = parseResult.plainText.indexOf(wordText, charCursor);
          const wordCharEnd = wordCharStart >= 0 ? wordCharStart + wordText.length : charCursor;
          if (wordCharStart >= 0) charCursor = wordCharEnd;

          allWordSpans.push({
            id: uuid(),
            wordId,
            chunkId,
            charStart: wordCharStart >= 0 ? wordCharStart : charCursor,
            charEnd: wordCharEnd,
            renderCoords: null,
          });

          wordTimeOffset += wordDuration;
        }

        // Build WordChunkMappings
        const chunkMappings = mapWordsToChunks(chunkWords, [chunk]);
        allMappings.push(...chunkMappings);

        // Store expressivity
        const exprData = section.expressivity[ci];
        if (exprData) {
          allExpressivity[chunkId] = {
            chunkId,
            speed: exprData.speed,
            voiceId: exprData.voiceId,
            leadingBreakMs: exprData.leadingBreakMs,
            trailingBreakMs: exprData.trailingBreakMs,
            phonetics: exprData.phonetics,
          };
        }

        chunkTimeOffset += chunkDuration;
      }
    }

    // Store all created data
    store.addChunks(allChunks);
    store.addTranscriptionWords(allWords);
    store.addWordChunkMappings(allMappings);
    store.setChunkExpressivityBatch(allExpressivity);

    // ── Step 4: Enable synthetic layer ─────────────────────────────────
    // Document-imported chunks have silent placeholder buffers — all audio
    // comes from the synthetic TTS layer. Enable it in solo-synthetic mode
    // so useSyntheticLayerSync auto-generates TTS for the new words.
    store.updateDocumentImportJob(jobId, { status: 'generating-tts', progress: 0.6 });
    const freshStore = useProjectStore.getState();
    // Set voice if specified
    if (options.voiceId) {
      freshStore.updateSyntheticLayerConfig({ voiceId: options.voiceId });
    }
    // Enable synthetic layer and set solo-synthetic mode (also sets activeLayer)
    freshStore.setSyntheticLayerEnabled(true);
    freshStore.setSyntheticMixMode('solo-synthetic');

    // ── Step 5: Build coordinates ──────────────────────────────────────
    store.updateDocumentImportJob(jobId, { status: 'building-coords', progress: 0.95 });

    // Create and store the DocumentAsset
    const asset: DocumentAsset = {
      id: documentAssetId,
      originalFileName: file.name,
      format,
      blob: new Blob([await file.arrayBuffer()], { type: file.type }),
      plainText: parseResult.plainText,
      structure: parseResult.structure,
      wordSpans: allWordSpans,
      htmlContent: parseResult.htmlContent,
      sectionIds: createdSectionIds,
      createdAt: Date.now(),
    };
    store.addDocumentAsset(asset);

    // Mark job complete
    store.updateDocumentImportJob(jobId, {
      status: 'completed',
      progress: 1,
      completedAt: Date.now(),
    });

    return asset;
  } catch (err: any) {
    store.updateDocumentImportJob(jobId, {
      status: 'failed',
      error: err.message || 'Unknown error',
      completedAt: Date.now(),
    });
    throw err;
  }
}

// ─── Multi-File Import ──────────────────────────────────────────────────────

export async function importMultipleDocuments(
  files: File[],
  options: DocumentImportOptions,
): Promise<DocumentAsset[]> {
  const results: DocumentAsset[] = [];

  for (const file of files) {
    try {
      const asset = await importDocumentFile(file, options);
      results.push(asset);
    } catch (err) {
      console.error(`Failed to import ${file.name}:`, err);
    }
  }

  return results;
}
