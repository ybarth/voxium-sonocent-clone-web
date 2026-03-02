import { useProjectStore } from '../stores/projectStore';
import { decodeAudioFile, segmentAudio } from './audioProcessing';
import { getFlatSectionOrder } from './sectionTree';

export interface ImportAudioOptions {
  targetSectionId?: string;
  parentId?: string | null;
  afterSectionId?: string;
  createNewSection?: boolean;
}

/**
 * Import a single audio file: decode, segment, and add chunks to the store.
 * When `createNewSection` is true, creates a section named after the file.
 * Returns the section ID that received the chunks.
 */
export async function importAudioFile(file: File, options?: ImportAudioOptions): Promise<string | null> {
  const store = useProjectStore.getState();
  const ctx = store.initAudioContext();

  try {
    const bufRef = await decodeAudioFile(file, ctx);
    store.addAudioBuffer(bufRef);

    const project = useProjectStore.getState().project;

    let sectionId: string;

    if (options?.createNewSection) {
      const fileName = file.name.replace(/\.[^/.]+$/, ''); // strip extension
      const newSection = useProjectStore.getState().addSection(fileName, {
        parentId: options.parentId ?? null,
        afterSectionId: options.afterSectionId,
      });
      sectionId = newSection.id;
    } else if (options?.targetSectionId) {
      sectionId = options.targetSectionId;
    } else {
      // Default: last section in display order
      const orderedSections = getFlatSectionOrder(project.sections);
      sectionId = orderedSections[orderedSections.length - 1]?.id ?? project.sections[0]?.id;
    }

    if (sectionId && bufRef.decodedBuffer) {
      useProjectStore.getState().pushUndo('import-audio');

      const currentProject = useProjectStore.getState().project;
      const existingChunks = currentProject.chunks.filter(
        (c) => c.sectionId === sectionId && !c.isDeleted
      );
      const startIndex = existingChunks.length;

      const newChunks = segmentAudio(
        bufRef.decodedBuffer,
        bufRef.id,
        sectionId,
        {
          silenceThresholdDb: currentProject.settings.silenceThresholdDb,
          minSilenceDurationMs: currentProject.settings.minSilenceDurationMs,
          minChunkDurationMs: currentProject.settings.minChunkDurationMs,
        }
      );

      newChunks.forEach((c, i) => {
        c.orderIndex = startIndex + i;
      });

      useProjectStore.getState().addChunks(newChunks);
    }

    return sectionId;
  } catch (err) {
    console.error('Failed to import audio:', err);
    return null;
  }
}

export interface ImportMultipleOptions {
  parentId?: string | null;
  afterSectionId?: string;
  asSubsections?: boolean;
}

/**
 * Import multiple files, each into its own new section.
 * Sections are created sequentially (each after the previous).
 * `asSubsections` creates them as children of the current section (parentId).
 */
export async function importMultipleFiles(files: File[], options?: ImportMultipleOptions) {
  let afterSectionId = options?.afterSectionId;
  const parentId = options?.asSubsections ? (options.parentId ?? null) : null;

  for (const file of files) {
    const sectionId = await importAudioFile(file, {
      createNewSection: true,
      parentId,
      afterSectionId,
    });

    // Next file's section should be after this one
    if (sectionId) {
      afterSectionId = sectionId;
    }
  }
}
