/**
 * Document sync hook — maps playback cursor to document text spans.
 * Provides active span and highlighted spans for the original document view.
 */

import { useMemo } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { useTranscriptionSync } from './useTranscriptionSync';
import type { DocumentRegionMap, DocumentTextSpan } from '../types/document';
import { spansForChunk, spanForWord } from '../utils/documentCoordMapper';

interface DocumentSyncResult {
  activeSpan: DocumentTextSpan | null;
  highlightedSpans: DocumentTextSpan[];
}

export function useDocumentSync(
  regionMap: DocumentRegionMap | null,
): DocumentSyncResult {
  const currentChunkId = useProjectStore(s => s.playback.currentChunkId);
  const { activeWordId } = useTranscriptionSync();

  return useMemo(() => {
    if (!regionMap || !currentChunkId) {
      return { activeSpan: null, highlightedSpans: [] };
    }

    // Active span from active word
    const activeSpan = activeWordId
      ? spanForWord(regionMap, activeWordId)
      : null;

    // All spans for the current chunk
    const highlightedSpans = spansForChunk(regionMap, currentChunkId);

    return { activeSpan, highlightedSpans };
  }, [regionMap, currentChunkId, activeWordId]);
}
