import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { Chunk } from '../types';
import type {
  ClipboardItem,
  InsertionPosition,
  PasteMode,
  PasteDirection,
  ClipboardSortField,
  SortDirection,
} from '../types/clipboard';

interface ClipboardStore {
  // State
  items: ClipboardItem[];
  insertionPosition: InsertionPosition;
  pasteMode: PasteMode;
  pasteDirection: PasteDirection;
  sortField: ClipboardSortField;
  sortDirection: SortDirection;
  searchQuery: string;
  pasteCursorIndex: number;

  // Clipboard-local undo/redo
  undoStack: ClipboardItem[][];
  redoStack: ClipboardItem[][];

  // Actions
  addItem: (chunks: Chunk[], mode: 'cut' | 'copy', sourceSectionId: string | null) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
  renameItem: (id: string, label: string) => void;
  reorderItems: (fromIndex: number, toIndex: number) => void;
  setInsertionPosition: (pos: InsertionPosition) => void;
  setPasteMode: (mode: PasteMode) => void;
  setPasteDirection: (dir: PasteDirection) => void;
  setSortField: (field: ClipboardSortField) => void;
  setSortDirection: (dir: SortDirection) => void;
  setSearchQuery: (query: string) => void;
  pasteSpecificItem: (id: string) => ClipboardItem | null;

  // Clipboard-local undo/redo actions
  pushClipboardUndo: () => void;
  clipboardUndo: () => void;
  clipboardRedo: () => void;

  // Cross-store snapshot/restore
  snapshotItems: () => ClipboardItem[];
  restoreItems: (items: ClipboardItem[]) => void;

  // Helpers
  getSortedFilteredItems: () => ClipboardItem[];
  getItemToPaste: () => ClipboardItem | null;
  advancePasteCursor: () => void;
}

function stripWaveformData(chunks: Chunk[]): Chunk[] {
  return chunks.map(c => ({ ...c, waveformData: null }));
}

export const useClipboardStore = create<ClipboardStore>((set, get) => ({
  items: [],
  insertionPosition: 'top',
  pasteMode: 'sticky',
  pasteDirection: 'ascending',
  sortField: 'custom',
  sortDirection: 'desc',
  searchQuery: '',
  pasteCursorIndex: 0,
  undoStack: [],
  redoStack: [],

  addItem: (chunks, mode, sourceSectionId) => {
    get().pushClipboardUndo();
    const state = get();
    const newItem: ClipboardItem = {
      id: uuid(),
      chunks: stripWaveformData(chunks.map(c => ({ ...c }))),
      mode,
      sourceSectionId,
      timestamp: Date.now(),
      label: `${mode === 'cut' ? 'Cut' : 'Copy'} ${chunks.length} chunk${chunks.length !== 1 ? 's' : ''}`,
      customOrder: state.insertionPosition === 'top'
        ? (state.items.length > 0 ? Math.min(...state.items.map(i => i.customOrder)) - 1 : 0)
        : (state.items.length > 0 ? Math.max(...state.items.map(i => i.customOrder)) + 1 : 0),
    };

    set({
      items: state.insertionPosition === 'top'
        ? [newItem, ...state.items]
        : [...state.items, newItem],
      pasteCursorIndex: state.insertionPosition === 'top' ? 0 : state.items.length,
    });
  },

  removeItem: (id) => {
    get().pushClipboardUndo();
    const state = get();
    const newItems = state.items.filter(i => i.id !== id);
    set({
      items: newItems,
      pasteCursorIndex: Math.min(state.pasteCursorIndex, Math.max(0, newItems.length - 1)),
    });
  },

  clearAll: () => {
    get().pushClipboardUndo();
    set({ items: [], pasteCursorIndex: 0 });
  },

  renameItem: (id, label) => {
    get().pushClipboardUndo();
    set(s => ({
      items: s.items.map(i => i.id === id ? { ...i, label } : i),
    }));
  },

  reorderItems: (fromIndex, toIndex) => {
    get().pushClipboardUndo();
    const state = get();
    const sorted = state.getSortedFilteredItems();
    if (fromIndex < 0 || fromIndex >= sorted.length || toIndex < 0 || toIndex >= sorted.length) return;

    const movedItem = sorted[fromIndex];
    const targetItem = sorted[toIndex];

    // Swap custom orders
    set(s => ({
      items: s.items.map(i => {
        if (i.id === movedItem.id) return { ...i, customOrder: targetItem.customOrder };
        if (i.id === targetItem.id) return { ...i, customOrder: movedItem.customOrder };
        return i;
      }),
      sortField: 'custom' as ClipboardSortField,
    }));
  },

  setInsertionPosition: (pos) => set({ insertionPosition: pos }),
  setPasteMode: (mode) => set({ pasteMode: mode, pasteCursorIndex: 0 }),
  setPasteDirection: (dir) => set({ pasteDirection: dir, pasteCursorIndex: 0 }),
  setSortField: (field) => set({ sortField: field }),
  setSortDirection: (dir) => set({ sortDirection: dir }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  pasteSpecificItem: (id) => {
    const state = get();
    return state.items.find(i => i.id === id) ?? null;
  },

  pushClipboardUndo: () => {
    const { items, undoStack } = get();
    set({
      undoStack: [...undoStack.slice(-49), JSON.parse(JSON.stringify(items))],
      redoStack: [],
    });
  },

  clipboardUndo: () => {
    const { items, undoStack, redoStack } = get();
    if (undoStack.length === 0) return;
    const snapshot = undoStack[undoStack.length - 1];
    set({
      items: snapshot,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, JSON.parse(JSON.stringify(items))],
      pasteCursorIndex: 0,
    });
  },

  clipboardRedo: () => {
    const { items, undoStack, redoStack } = get();
    if (redoStack.length === 0) return;
    const snapshot = redoStack[redoStack.length - 1];
    set({
      items: snapshot,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, JSON.parse(JSON.stringify(items))],
      pasteCursorIndex: 0,
    });
  },

  snapshotItems: () => {
    return JSON.parse(JSON.stringify(get().items));
  },

  restoreItems: (items) => {
    set({ items, pasteCursorIndex: 0 });
  },

  getSortedFilteredItems: () => {
    const { items, sortField, sortDirection, searchQuery } = get();
    let filtered = items;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(i =>
        i.label.toLowerCase().includes(q) ||
        i.mode.toLowerCase().includes(q) ||
        `${i.chunks.length} chunk`.includes(q)
      );
    }

    const sorted = [...filtered];
    const dir = sortDirection === 'asc' ? 1 : -1;

    switch (sortField) {
      case 'custom':
        sorted.sort((a, b) => (a.customOrder - b.customOrder) * dir);
        break;
      case 'timestamp':
        sorted.sort((a, b) => (a.timestamp - b.timestamp) * dir);
        break;
      case 'chunkCount':
        sorted.sort((a, b) => (a.chunks.length - b.chunks.length) * dir);
        break;
      case 'label':
        sorted.sort((a, b) => a.label.localeCompare(b.label) * dir);
        break;
    }

    return sorted;
  },

  getItemToPaste: () => {
    const state = get();
    const sorted = state.getSortedFilteredItems();
    if (sorted.length === 0) return null;

    if (state.pasteMode === 'sticky') {
      return sorted[0];
    }

    // Sequential mode
    const idx = Math.min(state.pasteCursorIndex, sorted.length - 1);
    return sorted[idx] ?? null;
  },

  advancePasteCursor: () => {
    const state = get();
    const sorted = state.getSortedFilteredItems();
    if (sorted.length === 0) return;

    if (state.pasteDirection === 'ascending') {
      const next = state.pasteCursorIndex + 1;
      set({ pasteCursorIndex: next >= sorted.length ? 0 : next });
    } else {
      const next = state.pasteCursorIndex - 1;
      set({ pasteCursorIndex: next < 0 ? sorted.length - 1 : next });
    }
  },
}));
