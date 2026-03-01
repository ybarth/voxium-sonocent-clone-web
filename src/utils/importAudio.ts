import { useProjectStore } from '../stores/projectStore';
import { decodeAudioFile, segmentAudio } from './audioProcessing';

/**
 * Import an audio file: decode, segment, and add chunks to the store.
 * Uses getState() to avoid stale closures — safe to call from anywhere.
 */
export async function importAudioFile(file: File) {
  const store = useProjectStore.getState();
  const ctx = store.initAudioContext();

  try {
    const bufRef = await decodeAudioFile(file, ctx);
    store.addAudioBuffer(bufRef);

    // Re-read fresh state after async decode
    const project = useProjectStore.getState().project;
    const sectionId = project.sections[project.sections.length - 1]?.id;

    if (sectionId && bufRef.decodedBuffer) {
      useProjectStore.getState().pushUndo('import-audio');

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
  } catch (err) {
    console.error('Failed to import audio:', err);
  }
}
