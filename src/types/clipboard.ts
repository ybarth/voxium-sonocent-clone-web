import type { Chunk } from './index';

export interface ClipboardItem {
  id: string;
  chunks: Chunk[];
  mode: 'cut' | 'copy';
  sourceSectionId: string | null;
  timestamp: number;
  label: string;
  customOrder: number;
}

export type InsertionPosition = 'top' | 'bottom';
export type PasteMode = 'sticky' | 'sequential';
export type PasteDirection = 'ascending' | 'descending';
export type ClipboardSortField = 'custom' | 'timestamp' | 'chunkCount' | 'label';
export type SortDirection = 'asc' | 'desc';
