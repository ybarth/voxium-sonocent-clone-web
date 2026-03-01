import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type {
  Project, Chunk, Section, AudioBufferRef, ProjectSettings,
  UndoAction, InsertionPoint, TakeState,
} from '../types';
import { DEFAULT_COLORS, DEFAULT_SETTINGS } from '../types';

// --- Cursor model ---
// The cursor is a precise position: which chunk (or null if between/outside)
// and the exact fractional position (0-1) within that chunk.
// When the cursor is "between" chunks or at project start/end,
// currentChunkId is null and cursorTime represents the insert point.

interface PlaybackState {
  isPlaying: boolean;
  isRecording: boolean;
  currentChunkId: string | null;
  cursorTime: number;
  cursorPositionInChunk: number; // 0-1 within current chunk
  insertionPoint: InsertionPoint | null;
  /** Separate from insertionPoint — tracks where the recording head is during live recording */
  recordingHead: InsertionPoint | null;
}

interface SelectionState {
  selectedChunkIds: Set<string>;
  anchorChunkId: string | null; // For Shift-range selection: the chunk where the range started
  focusedPaneId: 'audio' | 'text' | 'annotations' | 'file';
}

interface ProjectStore {
  project: Project;
  playback: PlaybackState;
  selection: SelectionState;
  take: TakeState;

  audioContext: AudioContext | null;
  initAudioContext: () => AudioContext;

  setProjectName: (name: string) => void;
  updateSettings: (settings: Partial<ProjectSettings>) => void;

  addAudioBuffer: (ref: AudioBufferRef) => void;

  setChunks: (chunks: Chunk[]) => void;
  addChunks: (chunks: Chunk[]) => void;
  replaceLiveChunks: (liveAudioBufferId: string, newChunks: Chunk[]) => void;
  updateChunk: (id: string, updates: Partial<Chunk>) => void;
  deleteChunks: (ids: string[]) => void;
  colorChunks: (ids: string[], color: string | null) => void;
  splitChunkAtCursor: () => void;
  mergeChunks: (ids: string[]) => void;

  addSection: (name?: string) => Section;
  renameSection: (id: string, name: string) => void;
  deleteSection: (id: string) => void;
  reorderSections: (orderedIds: string[]) => void;

  // Selection — new model
  /** Click a chunk: plain click = single select; ctrl = toggle; shift = range from anchor */
  selectChunk: (id: string, mode: 'replace' | 'toggle' | 'range') => void;
  selectAllInSection: (sectionId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setFocusedPane: (pane: SelectionState['focusedPaneId']) => void;

  // Insertion point & take
  placeCursorAtInsertionPoint: (sectionId: string, orderIndex: number) => void;
  bumpChunksForInsertion: (sectionId: string, fromOrderIndex: number, offset: number) => void;
  renumberSection: (sectionId: string) => void;
  setTakeChunkIds: (ids: string[], originalSectionId: string, startOrderIndex: number) => void;
  clearTake: () => void;
  moveTakeToPosition: (sectionId: string, orderIndex: number) => void;
  moveTakeBack: () => void;

  // Cursor placement
  /** Place cursor at a specific position within a chunk (fraction 0-1) */
  placeCursorInChunk: (chunkId: string, fraction: number) => void;
  setPlaying: (playing: boolean) => void;
  setRecording: (recording: boolean) => void;
  setRecordingHead: (head: InsertionPoint | null) => void;
  setCurrentChunk: (id: string | null) => void;
  setCursorTime: (time: number) => void;
  setCursorPositionInChunk: (pos: number) => void;

  // Navigation — shift extends selection
  navigateChunk: (direction: 'prev' | 'next', extend?: boolean) => void;
  navigateSection: (direction: 'prev' | 'next') => void;
  navigateToStart: () => void;
  navigateToEnd: () => void;

  pushUndo: (type: UndoAction['type']) => void;
  undo: () => void;
  redo: () => void;
}

export function getOrderedChunks(chunks: Chunk[], sections: Section[]): Chunk[] {
  const sectionOrder = new Map(sections.map((s) => [s.id, s.orderIndex]));
  return [...chunks]
    .filter(c => !c.isDeleted)
    .sort((a, b) => {
      const sA = sectionOrder.get(a.sectionId) ?? 0;
      const sB = sectionOrder.get(b.sectionId) ?? 0;
      if (sA !== sB) return sA - sB;
      return a.orderIndex - b.orderIndex;
    });
}

const initialSection: Section = {
  id: uuid(),
  name: 'Section 1',
  orderIndex: 0,
  backgroundColor: null,
};

const initialProject: Project = {
  id: uuid(),
  name: 'Untitled Project',
  createdAt: new Date(),
  updatedAt: new Date(),
  audioBuffers: [],
  chunks: [],
  sections: [initialSection],
  colorKey: {
    id: uuid(),
    name: 'Default',
    colors: DEFAULT_COLORS,
  },
  settings: { ...DEFAULT_SETTINGS },
  undoStack: [],
  redoStack: [],
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: initialProject,

  playback: {
    isPlaying: false,
    isRecording: false,
    currentChunkId: null,
    cursorTime: 0,
    cursorPositionInChunk: 0,
    insertionPoint: null,
    recordingHead: null,
  },

  take: { chunkIds: [], originalPosition: null, moved: false },

  selection: {
    selectedChunkIds: new Set(),
    anchorChunkId: null,
    focusedPaneId: 'audio',
  },

  audioContext: null,

  initAudioContext: () => {
    let ctx = get().audioContext;
    if (!ctx) {
      ctx = new AudioContext();
      set({ audioContext: ctx });
    }
    return ctx;
  },

  setProjectName: (name) =>
    set((s) => ({ project: { ...s.project, name, updatedAt: new Date() } })),

  updateSettings: (settings) =>
    set((s) => ({
      project: {
        ...s.project,
        settings: { ...s.project.settings, ...settings },
        updatedAt: new Date(),
      },
    })),

  addAudioBuffer: (ref) =>
    set((s) => ({
      project: {
        ...s.project,
        audioBuffers: [...s.project.audioBuffers, ref],
        updatedAt: new Date(),
      },
    })),

  setChunks: (chunks) =>
    set((s) => ({ project: { ...s.project, chunks, updatedAt: new Date() } })),

  addChunks: (chunks) =>
    set((s) => ({
      project: {
        ...s.project,
        chunks: [...s.project.chunks, ...chunks],
        updatedAt: new Date(),
      },
    })),

  replaceLiveChunks: (liveAudioBufferId, newChunks) =>
    set((s) => ({
      project: {
        ...s.project,
        chunks: [
          ...s.project.chunks.filter((c) => c.audioBufferId !== liveAudioBufferId),
          ...newChunks,
        ],
        updatedAt: new Date(),
      },
    })),

  updateChunk: (id, updates) =>
    set((s) => ({
      project: {
        ...s.project,
        chunks: s.project.chunks.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
        updatedAt: new Date(),
      },
    })),

  deleteChunks: (ids) => {
    get().pushUndo('delete');
    set((s) => ({
      project: {
        ...s.project,
        chunks: s.project.chunks.map((c) =>
          ids.includes(c.id) ? { ...c, isDeleted: true } : c
        ),
        updatedAt: new Date(),
      },
      selection: { ...s.selection, selectedChunkIds: new Set(), anchorChunkId: null },
      playback: { ...s.playback, insertionPoint: null },
    }));
  },

  colorChunks: (ids, color) => {
    get().pushUndo('recolor');
    set((s) => ({
      project: {
        ...s.project,
        chunks: s.project.chunks.map((c) =>
          ids.includes(c.id) ? { ...c, color } : c
        ),
        updatedAt: new Date(),
      },
    }));
  },

  splitChunkAtCursor: () => {
    const { playback, project } = get();
    if (!playback.currentChunkId) return;
    const chunk = project.chunks.find((c) => c.id === playback.currentChunkId);
    if (!chunk) return;

    const fraction = playback.cursorPositionInChunk;
    if (fraction <= 0.01 || fraction >= 0.99) return; // Too close to edges

    const splitTimeInChunk = (chunk.endTime - chunk.startTime) * fraction;
    const absTime = chunk.startTime + splitTimeInChunk;

    get().pushUndo('split');
    set((s) => {
      const orig = s.project.chunks.find((c) => c.id === playback.currentChunkId);
      if (!orig) return s;

      const chunk1: Chunk = {
        ...orig,
        id: uuid(),
        endTime: absTime,
        waveformData: null,
      };
      const chunk2: Chunk = {
        ...orig,
        id: uuid(),
        startTime: absTime,
        orderIndex: orig.orderIndex + 0.5,
        waveformData: null,
      };

      const newChunks = s.project.chunks
        .filter((c) => c.id !== orig.id)
        .concat([chunk1, chunk2]);

      // Renumber per section
      const bySection = new Map<string, Chunk[]>();
      for (const c of newChunks) {
        const arr = bySection.get(c.sectionId) ?? [];
        arr.push(c);
        bySection.set(c.sectionId, arr);
      }
      for (const arr of bySection.values()) {
        arr.sort((a, b) => a.orderIndex - b.orderIndex);
        arr.forEach((c, i) => { c.orderIndex = i; });
      }

      return {
        project: { ...s.project, chunks: newChunks, updatedAt: new Date() },
        playback: {
          ...s.playback,
          currentChunkId: chunk2.id,
          cursorPositionInChunk: 0,
          insertionPoint: null,
        },
        selection: {
          ...s.selection,
          selectedChunkIds: new Set([chunk1.id, chunk2.id]),
          anchorChunkId: chunk1.id,
        },
      };
    });
  },

  mergeChunks: (ids) => {
    const { project } = get();
    const ordered = getOrderedChunks(project.chunks, project.sections);
    const toMerge = ordered.filter((c) => ids.includes(c.id));
    if (toMerge.length < 2) return;

    const allSameBuffer = toMerge.every(
      (c) => c.audioBufferId === toMerge[0].audioBufferId
    );
    if (!allSameBuffer) return;

    get().pushUndo('merge');
    set((s) => {
      const merged: Chunk = {
        id: uuid(),
        audioBufferId: toMerge[0].audioBufferId,
        startTime: Math.min(...toMerge.map((c) => c.startTime)),
        endTime: Math.max(...toMerge.map((c) => c.endTime)),
        sectionId: toMerge[0].sectionId,
        orderIndex: toMerge[0].orderIndex,
        color: toMerge[0].color,
        isDeleted: false,
        waveformData: null,
      };

      const newChunks = s.project.chunks
        .filter((c) => !ids.includes(c.id))
        .concat([merged]);

      return {
        project: { ...s.project, chunks: newChunks, updatedAt: new Date() },
        selection: { ...s.selection, selectedChunkIds: new Set([merged.id]), anchorChunkId: merged.id },
        playback: { ...s.playback, insertionPoint: null },
      };
    });
  },

  addSection: (name) => {
    const store = get();
    const maxOrder = Math.max(...store.project.sections.map((s) => s.orderIndex), -1);
    const section: Section = {
      id: uuid(),
      name: name ?? `Section ${store.project.sections.length + 1}`,
      orderIndex: maxOrder + 1,
      backgroundColor: null,
    };
    store.pushUndo('add-section');
    const isRecording = store.playback.isRecording;
    set((s) => ({
      project: { ...s.project, sections: [...s.project.sections, section], updatedAt: new Date() },
      // During recording, redirect both insertion point and recording head to the new section
      ...(isRecording ? {
        playback: {
          ...s.playback,
          insertionPoint: { sectionId: section.id, orderIndex: 0 },
          recordingHead: { sectionId: section.id, orderIndex: 0 },
          currentChunkId: null,
        },
      } : {}),
    }));
    return section;
  },

  renameSection: (id, name) => {
    get().pushUndo('rename-section');
    set((s) => ({
      project: {
        ...s.project,
        sections: s.project.sections.map((sec) => sec.id === id ? { ...sec, name } : sec),
        updatedAt: new Date(),
      },
    }));
  },

  deleteSection: (id) => {
    if (get().project.sections.length <= 1) return;
    get().pushUndo('delete-section');
    set((s) => ({
      project: {
        ...s.project,
        sections: s.project.sections.filter((sec) => sec.id !== id),
        chunks: s.project.chunks.map((c) => c.sectionId === id ? { ...c, isDeleted: true } : c),
        updatedAt: new Date(),
      },
    }));
  },

  reorderSections: (orderedIds) =>
    set((s) => ({
      project: {
        ...s.project,
        sections: s.project.sections
          .map((sec) => ({ ...sec, orderIndex: orderedIds.indexOf(sec.id) }))
          .sort((a, b) => a.orderIndex - b.orderIndex),
        updatedAt: new Date(),
      },
    })),

  // --- Selection with anchor-based range ---
  selectChunk: (id, mode) =>
    set((s) => {
      if (mode === 'replace') {
        return {
          selection: {
            ...s.selection,
            selectedChunkIds: new Set([id]),
            anchorChunkId: id,
          },
        };
      }
      if (mode === 'toggle') {
        const newSet = new Set(s.selection.selectedChunkIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return {
          selection: {
            ...s.selection,
            selectedChunkIds: newSet,
            anchorChunkId: id,
          },
        };
      }
      // mode === 'range'
      const anchor = s.selection.anchorChunkId;
      if (!anchor) {
        return {
          selection: { ...s.selection, selectedChunkIds: new Set([id]), anchorChunkId: id },
        };
      }
      const ordered = getOrderedChunks(s.project.chunks, s.project.sections);
      const fromIdx = ordered.findIndex((c) => c.id === anchor);
      const toIdx = ordered.findIndex((c) => c.id === id);
      if (fromIdx === -1 || toIdx === -1) {
        return { selection: { ...s.selection, selectedChunkIds: new Set([id]), anchorChunkId: id } };
      }
      const start = Math.min(fromIdx, toIdx);
      const end = Math.max(fromIdx, toIdx);
      const ids = ordered.slice(start, end + 1).map((c) => c.id);
      return {
        selection: { ...s.selection, selectedChunkIds: new Set(ids) },
        // Keep anchorChunkId unchanged for extending ranges
      };
    }),

  selectAllInSection: (sectionId) =>
    set((s) => ({
      selection: {
        ...s.selection,
        selectedChunkIds: new Set(
          s.project.chunks.filter((c) => c.sectionId === sectionId && !c.isDeleted).map((c) => c.id)
        ),
      },
    })),

  selectAll: () =>
    set((s) => ({
      selection: {
        ...s.selection,
        selectedChunkIds: new Set(s.project.chunks.filter((c) => !c.isDeleted).map((c) => c.id)),
      },
    })),

  clearSelection: () =>
    set((s) => ({ selection: { ...s.selection, selectedChunkIds: new Set(), anchorChunkId: null } })),

  setFocusedPane: (pane) =>
    set((s) => ({ selection: { ...s.selection, focusedPaneId: pane } })),

  // --- Insertion point & take ---
  placeCursorAtInsertionPoint: (sectionId, orderIndex) =>
    set((s) => ({
      playback: {
        ...s.playback,
        currentChunkId: null,
        insertionPoint: { sectionId, orderIndex },
      },
    })),

  bumpChunksForInsertion: (sectionId, fromOrderIndex, offset) =>
    set((s) => ({
      project: {
        ...s.project,
        chunks: s.project.chunks.map((c) =>
          c.sectionId === sectionId && !c.isDeleted && c.orderIndex >= fromOrderIndex
            ? { ...c, orderIndex: c.orderIndex + offset }
            : c
        ),
        updatedAt: new Date(),
      },
    })),

  renumberSection: (sectionId) =>
    set((s) => {
      const sectionChunks = s.project.chunks
        .filter((c) => c.sectionId === sectionId && !c.isDeleted)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      const idToNewIndex = new Map(sectionChunks.map((c, i) => [c.id, i]));
      return {
        project: {
          ...s.project,
          chunks: s.project.chunks.map((c) => {
            const newIdx = idToNewIndex.get(c.id);
            return newIdx !== undefined ? { ...c, orderIndex: newIdx } : c;
          }),
          updatedAt: new Date(),
        },
      };
    }),

  setTakeChunkIds: (ids, originalSectionId, startOrderIndex) =>
    set({ take: { chunkIds: ids, originalPosition: { sectionId: originalSectionId, startOrderIndex }, moved: false } }),

  clearTake: () =>
    set({ take: { chunkIds: [], originalPosition: null, moved: false } }),

  moveTakeToPosition: (sectionId, orderIndex) => {
    const { take, project } = get();
    if (take.chunkIds.length === 0) return;
    get().pushUndo('move-take');
    set((s) => {
      // First remove take chunks from their current section order
      const takeIds = new Set(s.take.chunkIds);
      let chunks = s.project.chunks.map((c) => {
        if (takeIds.has(c.id)) return { ...c, sectionId, orderIndex: -1 };
        return c;
      });

      // Renumber the target section excluding take chunks, then insert take chunks at orderIndex
      const targetNonTake = chunks
        .filter((c) => c.sectionId === sectionId && !c.isDeleted && !takeIds.has(c.id))
        .sort((a, b) => a.orderIndex - b.orderIndex);

      // Clamp orderIndex
      const clampedIdx = Math.min(orderIndex, targetNonTake.length);

      // Build final ordering: before + take + after
      const before = targetNonTake.slice(0, clampedIdx);
      const after = targetNonTake.slice(clampedIdx);
      const takeChunks = chunks.filter((c) => takeIds.has(c.id) && !c.isDeleted);

      const finalOrder = [...before, ...takeChunks, ...after];
      const idToIdx = new Map(finalOrder.map((c, i) => [c.id, i]));

      chunks = chunks.map((c) => {
        const idx = idToIdx.get(c.id);
        return idx !== undefined ? { ...c, orderIndex: idx, sectionId } : c;
      });

      // Also renumber any section that lost chunks (the old section)
      // We'll do a full renumber pass for all sections that had take chunks
      const affectedSections = new Set<string>();
      for (const c of s.project.chunks) {
        if (takeIds.has(c.id)) affectedSections.add(c.sectionId);
      }
      affectedSections.add(sectionId);

      for (const secId of affectedSections) {
        const secChunks = chunks
          .filter((c) => c.sectionId === secId && !c.isDeleted)
          .sort((a, b) => a.orderIndex - b.orderIndex);
        const secMap = new Map(secChunks.map((c, i) => [c.id, i]));
        chunks = chunks.map((c) => {
          const ni = secMap.get(c.id);
          return ni !== undefined ? { ...c, orderIndex: ni } : c;
        });
      }

      return {
        project: { ...s.project, chunks, updatedAt: new Date() },
        take: { ...s.take, moved: true },
      };
    });
  },

  moveTakeBack: () => {
    const { take, project } = get();
    if (!take.originalPosition) return;
    // Check if original section still exists
    const sectionExists = project.sections.some((s) => s.id === take.originalPosition!.sectionId);
    if (!sectionExists) return;
    get().moveTakeToPosition(take.originalPosition.sectionId, take.originalPosition.startOrderIndex);
    set((s) => ({ take: { ...s.take, moved: false } }));
  },

  // --- Cursor placement ---
  placeCursorInChunk: (chunkId, fraction) => {
    const chunk = get().project.chunks.find((c) => c.id === chunkId);
    if (!chunk) return;
    const duration = chunk.endTime - chunk.startTime;
    set((s) => ({
      playback: {
        ...s.playback,
        currentChunkId: chunkId,
        cursorPositionInChunk: Math.max(0, Math.min(1, fraction)),
        cursorTime: chunk.startTime + duration * fraction,
        insertionPoint: {
          sectionId: chunk.sectionId,
          orderIndex: fraction < 0.5 ? chunk.orderIndex : chunk.orderIndex + 1,
        },
      },
    }));
  },

  setPlaying: (isPlaying) =>
    set((s) => ({ playback: { ...s.playback, isPlaying } })),

  setRecording: (isRecording) =>
    set((s) => ({
      playback: { ...s.playback, isRecording, ...(!isRecording ? { recordingHead: null } : {}) },
    })),

  setRecordingHead: (head) =>
    set((s) => ({ playback: { ...s.playback, recordingHead: head } })),

  setCurrentChunk: (id) =>
    set((s) => ({ playback: { ...s.playback, currentChunkId: id } })),

  setCursorTime: (time) =>
    set((s) => ({ playback: { ...s.playback, cursorTime: time } })),

  setCursorPositionInChunk: (pos) =>
    set((s) => ({ playback: { ...s.playback, cursorPositionInChunk: pos } })),

  // --- Navigation ---
  navigateChunk: (direction, extend = false) => {
    const { project, playback, selection } = get();
    const ordered = getOrderedChunks(project.chunks, project.sections);
    if (ordered.length === 0) return;

    const currentIdx = ordered.findIndex((c) => c.id === playback.currentChunkId);
    let nextIdx: number;
    if (direction === 'next') {
      nextIdx = currentIdx < ordered.length - 1 ? currentIdx + 1 : ordered.length - 1;
    } else {
      nextIdx = currentIdx > 0 ? currentIdx - 1 : 0;
    }
    const nextChunk = ordered[nextIdx];

    if (extend) {
      // Shift+arrow: extend selection range from anchor to nextChunk
      const anchor = selection.anchorChunkId ?? playback.currentChunkId ?? nextChunk.id;
      const anchorIdx = ordered.findIndex((c) => c.id === anchor);
      const start = Math.min(anchorIdx, nextIdx);
      const end = Math.max(anchorIdx, nextIdx);
      const ids = ordered.slice(start, end + 1).map((c) => c.id);
      set((s) => ({
        playback: {
          ...s.playback,
          currentChunkId: nextChunk.id,
          cursorTime: nextChunk.startTime,
          cursorPositionInChunk: 0,
        },
        selection: {
          ...s.selection,
          selectedChunkIds: new Set(ids),
          // Keep anchor unchanged
        },
      }));
    } else {
      set((s) => ({
        playback: {
          ...s.playback,
          currentChunkId: nextChunk.id,
          cursorTime: nextChunk.startTime,
          cursorPositionInChunk: 0,
        },
        selection: {
          ...s.selection,
          selectedChunkIds: new Set([nextChunk.id]),
          anchorChunkId: nextChunk.id,
        },
      }));
    }
  },

  navigateSection: (direction) => {
    const { project, playback } = get();
    const sections = [...project.sections].sort((a, b) => a.orderIndex - b.orderIndex);
    const currentChunk = project.chunks.find((c) => c.id === playback.currentChunkId);
    const currentSectionIdx = currentChunk
      ? sections.findIndex((s) => s.id === currentChunk.sectionId)
      : 0;

    let nextSectionIdx: number;
    if (direction === 'next') {
      nextSectionIdx = Math.min(currentSectionIdx + 1, sections.length - 1);
    } else {
      nextSectionIdx = Math.max(currentSectionIdx - 1, 0);
    }

    const nextSection = sections[nextSectionIdx];
    const sectionChunks = getOrderedChunks(project.chunks, project.sections)
      .filter((c) => c.sectionId === nextSection.id);

    if (sectionChunks.length > 0) {
      const first = sectionChunks[0];
      set((s) => ({
        playback: {
          ...s.playback,
          currentChunkId: first.id,
          cursorTime: first.startTime,
          cursorPositionInChunk: 0,
        },
        selection: {
          ...s.selection,
          selectedChunkIds: new Set([first.id]),
          anchorChunkId: first.id,
        },
      }));
    }
  },

  navigateToStart: () => {
    const ordered = getOrderedChunks(get().project.chunks, get().project.sections);
    if (ordered.length > 0) {
      const first = ordered[0];
      set((s) => ({
        playback: { ...s.playback, currentChunkId: first.id, cursorTime: first.startTime, cursorPositionInChunk: 0 },
        selection: { ...s.selection, selectedChunkIds: new Set([first.id]), anchorChunkId: first.id },
      }));
    }
  },

  navigateToEnd: () => {
    const ordered = getOrderedChunks(get().project.chunks, get().project.sections);
    if (ordered.length > 0) {
      const last = ordered[ordered.length - 1];
      set((s) => ({
        playback: { ...s.playback, currentChunkId: last.id, cursorTime: last.endTime, cursorPositionInChunk: 1 },
        selection: { ...s.selection, selectedChunkIds: new Set([last.id]), anchorChunkId: last.id },
      }));
    }
  },

  pushUndo: (type) =>
    set((s) => ({
      project: {
        ...s.project,
        undoStack: [
          ...s.project.undoStack.slice(-199),
          {
            type,
            timestamp: Date.now(),
            previousState: {
              chunks: JSON.parse(JSON.stringify(s.project.chunks)),
              sections: JSON.parse(JSON.stringify(s.project.sections)),
            },
          },
        ],
        redoStack: [],
      },
    })),

  undo: () =>
    set((s) => {
      const stack = s.project.undoStack;
      if (stack.length === 0) return s;
      const action = stack[stack.length - 1];
      return {
        project: {
          ...s.project,
          chunks: action.previousState.chunks,
          sections: action.previousState.sections,
          undoStack: stack.slice(0, -1),
          redoStack: [
            ...s.project.redoStack,
            {
              type: action.type,
              timestamp: Date.now(),
              previousState: {
                chunks: JSON.parse(JSON.stringify(s.project.chunks)),
                sections: JSON.parse(JSON.stringify(s.project.sections)),
              },
            },
          ],
          updatedAt: new Date(),
        },
        take: { chunkIds: [], originalPosition: null, moved: false },
      };
    }),

  redo: () =>
    set((s) => {
      const stack = s.project.redoStack;
      if (stack.length === 0) return s;
      const action = stack[stack.length - 1];
      return {
        project: {
          ...s.project,
          chunks: action.previousState.chunks,
          sections: action.previousState.sections,
          redoStack: stack.slice(0, -1),
          undoStack: [
            ...s.project.undoStack,
            {
              type: action.type,
              timestamp: Date.now(),
              previousState: {
                chunks: JSON.parse(JSON.stringify(s.project.chunks)),
                sections: JSON.parse(JSON.stringify(s.project.sections)),
              },
            },
          ],
          updatedAt: new Date(),
        },
        take: { chunkIds: [], originalPosition: null, moved: false },
      };
    }),
}));
