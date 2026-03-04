// Word-Chunk Mapper — maps STT word timestamps to chunk regions

import type { TranscribedWord, WordChunkMapping } from '../types/transcription';
import type { Chunk } from '../types';

/**
 * Map transcribed words to chunks via timestamp overlap detection.
 * Words are matched to chunks based on their time ranges.
 * A word spanning two chunks gets two mapping entries.
 *
 * @param words - Transcribed words with absolute timestamps
 * @param chunks - Ordered chunks to map against
 * @param timeOffset - Time offset to add to word timestamps (for multi-chunk extraction)
 */
export function mapWordsToChunks(
  words: TranscribedWord[],
  chunks: Chunk[],
  timeOffset = 0,
): WordChunkMapping[] {
  const mappings: WordChunkMapping[] = [];

  for (const word of words) {
    const wordStart = word.startTime + timeOffset;
    const wordEnd = word.endTime + timeOffset;

    for (const chunk of chunks) {
      const chunkDuration = chunk.endTime - chunk.startTime;
      if (chunkDuration <= 0) continue;

      // Check overlap between word time and chunk time
      const overlapStart = Math.max(wordStart, chunk.startTime);
      const overlapEnd = Math.min(wordEnd, chunk.endTime);

      if (overlapStart < overlapEnd) {
        // Word overlaps with this chunk
        const startFraction = (overlapStart - chunk.startTime) / chunkDuration;
        const endFraction = (overlapEnd - chunk.startTime) / chunkDuration;

        mappings.push({
          wordId: word.id,
          chunkId: chunk.id,
          startFraction: Math.max(0, Math.min(1, startFraction)),
          endFraction: Math.max(0, Math.min(1, endFraction)),
        });
      }
    }
  }

  return mappings;
}

/**
 * Remap word-chunk mappings after a chunk is split into two.
 */
export function remapWordsAfterChunkSplit(
  oldChunkId: string,
  newChunks: [Chunk, Chunk],
  mappings: WordChunkMapping[],
  oldChunk: Chunk,
): WordChunkMapping[] {
  const oldDuration = oldChunk.endTime - oldChunk.startTime;
  if (oldDuration <= 0) return mappings;

  const [chunkA, chunkB] = newChunks;
  const splitFraction = (chunkA.endTime - oldChunk.startTime) / oldDuration;

  const updated: WordChunkMapping[] = [];

  for (const m of mappings) {
    if (m.chunkId !== oldChunkId) {
      updated.push(m);
      continue;
    }

    // Word was in the old chunk — remap to new chunks
    if (m.endFraction <= splitFraction) {
      // Entirely in chunk A
      const aFraction = splitFraction;
      updated.push({
        wordId: m.wordId,
        chunkId: chunkA.id,
        startFraction: m.startFraction / aFraction,
        endFraction: m.endFraction / aFraction,
      });
    } else if (m.startFraction >= splitFraction) {
      // Entirely in chunk B
      const bFraction = 1 - splitFraction;
      updated.push({
        wordId: m.wordId,
        chunkId: chunkB.id,
        startFraction: (m.startFraction - splitFraction) / bFraction,
        endFraction: (m.endFraction - splitFraction) / bFraction,
      });
    } else {
      // Spans the split — create two entries
      const aFraction = splitFraction;
      const bFraction = 1 - splitFraction;
      updated.push({
        wordId: m.wordId,
        chunkId: chunkA.id,
        startFraction: m.startFraction / aFraction,
        endFraction: 1,
      });
      updated.push({
        wordId: m.wordId,
        chunkId: chunkB.id,
        startFraction: 0,
        endFraction: (m.endFraction - splitFraction) / bFraction,
      });
    }
  }

  return updated;
}

/**
 * Remap word-chunk mappings after multiple chunks are merged into one.
 */
export function remapWordsAfterChunkMerge(
  mergedIds: string[],
  newChunkId: string,
  mappings: WordChunkMapping[],
  oldChunks: Chunk[],
): WordChunkMapping[] {
  const mergedSet = new Set(mergedIds);
  const sortedOld = oldChunks
    .filter(c => mergedSet.has(c.id))
    .sort((a, b) => a.startTime - b.startTime);

  if (sortedOld.length === 0) return mappings;

  const totalStart = sortedOld[0].startTime;
  const totalEnd = sortedOld[sortedOld.length - 1].endTime;
  const totalDuration = totalEnd - totalStart;
  if (totalDuration <= 0) return mappings;

  const updated: WordChunkMapping[] = [];

  for (const m of mappings) {
    if (!mergedSet.has(m.chunkId)) {
      updated.push(m);
      continue;
    }

    // Find the old chunk for this mapping
    const oldChunk = sortedOld.find(c => c.id === m.chunkId);
    if (!oldChunk) continue;

    const chunkDuration = oldChunk.endTime - oldChunk.startTime;
    const absStart = oldChunk.startTime + m.startFraction * chunkDuration;
    const absEnd = oldChunk.startTime + m.endFraction * chunkDuration;

    updated.push({
      wordId: m.wordId,
      chunkId: newChunkId,
      startFraction: (absStart - totalStart) / totalDuration,
      endFraction: (absEnd - totalStart) / totalDuration,
    });
  }

  return updated;
}

/**
 * Get all words mapped to a specific chunk.
 */
export function getWordsForChunk(
  chunkId: string,
  words: TranscribedWord[],
  mappings: WordChunkMapping[],
): TranscribedWord[] {
  const wordIds = new Set(
    mappings
      .filter(m => m.chunkId === chunkId)
      .map(m => m.wordId)
  );
  return words.filter(w => wordIds.has(w.id));
}

/**
 * Get the word at a specific playback time.
 */
export function getWordAtTime(
  time: number,
  words: TranscribedWord[],
): TranscribedWord | null {
  for (const word of words) {
    if (time >= word.startTime && time <= word.endTime) {
      return word;
    }
  }
  return null;
}

/**
 * Remove mappings for deleted chunks.
 */
export function removeMappingsForChunks(
  chunkIds: string[],
  mappings: WordChunkMapping[],
): WordChunkMapping[] {
  const removeSet = new Set(chunkIds);
  return mappings.filter(m => !removeSet.has(m.chunkId));
}
