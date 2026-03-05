/**
 * Document coordinate mapper — maps document text spans to rendered coordinates.
 * Enables click-to-seek and playback highlighting in the original document view.
 */

import type { DocumentTextSpan, DocumentRegionMap, DocumentRenderCoords } from '../types/document';

// ─── Build Region Map ───────────────────────────────────────────────────────

export function buildRegionMap(wordSpans: DocumentTextSpan[]): DocumentRegionMap {
  const sorted = [...wordSpans].sort((a, b) => a.charStart - b.charStart);

  const byWordId = new Map<string, DocumentTextSpan>();
  const byChunkId = new Map<string, DocumentTextSpan[]>();

  for (const span of sorted) {
    byWordId.set(span.wordId, span);

    const existing = byChunkId.get(span.chunkId);
    if (existing) {
      existing.push(span);
    } else {
      byChunkId.set(span.chunkId, [span]);
    }
  }

  return { spans: sorted, byWordId, byChunkId };
}

// ─── Resolve HTML Coordinates ───────────────────────────────────────────────

/**
 * For DOCX/EPUB/RTF/MD rendered as HTML — walk text nodes to resolve bounding boxes.
 */
export function resolveHtmlCoords(
  map: DocumentRegionMap,
  containerEl: HTMLElement,
): void {
  // Collect all text nodes with cumulative char offsets
  const textNodes: { node: Text; startOffset: number; endOffset: number }[] = [];
  let charCount = 0;

  function walkTextNodes(el: Node) {
    if (el.nodeType === Node.TEXT_NODE) {
      const text = el.textContent || '';
      textNodes.push({
        node: el as Text,
        startOffset: charCount,
        endOffset: charCount + text.length,
      });
      charCount += text.length;
    } else if (el.nodeType === Node.ELEMENT_NODE) {
      // Check for data-char-start attribute for more precise mapping
      const element = el as HTMLElement;
      const charStart = element.getAttribute('data-char-start');
      if (charStart !== null) {
        charCount = parseInt(charStart, 10);
      }

      for (const child of Array.from(el.childNodes)) {
        walkTextNodes(child);
      }
    }
  }

  walkTextNodes(containerEl);

  const containerRect = containerEl.getBoundingClientRect();

  // For each span, find the text node(s) that contain its character range
  for (const span of map.spans) {
    const coords = resolveSpanCoords(span, textNodes, containerRect);
    if (coords) {
      span.renderCoords = coords;
    }
  }
}

function resolveSpanCoords(
  span: DocumentTextSpan,
  textNodes: { node: Text; startOffset: number; endOffset: number }[],
  containerRect: DOMRect,
): DocumentRenderCoords | null {
  // Find the text node(s) containing this span's character range
  for (const tn of textNodes) {
    if (tn.endOffset <= span.charStart) continue;
    if (tn.startOffset >= span.charEnd) break;

    // This text node contains at least part of the span
    const localStart = Math.max(0, span.charStart - tn.startOffset);
    const localEnd = Math.min(tn.node.length, span.charEnd - tn.startOffset);

    try {
      const range = document.createRange();
      range.setStart(tn.node, localStart);
      range.setEnd(tn.node, localEnd);
      const rect = range.getBoundingClientRect();

      return {
        x: rect.left - containerRect.left,
        y: rect.top - containerRect.top,
        width: rect.width,
        height: rect.height,
      };
    } catch {
      continue;
    }
  }

  return null;
}

// ─── Resolve PDF Coordinates ────────────────────────────────────────────────

export interface PdfTextItem {
  str: string;
  transform: number[]; // [scaleX, skewX, skewY, scaleY, x, y]
  width: number;
  height?: number;
  charStart: number; // pre-computed char offset in plainText
  charEnd: number;
  pageNumber: number;
}

/**
 * For PDF — maps cached pdfjs text items to span char ranges.
 */
export function resolvePdfCoords(
  map: DocumentRegionMap,
  pdfTextItems: PdfTextItem[],
  viewportScale: number,
): void {
  for (const span of map.spans) {
    for (const item of pdfTextItems) {
      if (item.charEnd <= span.charStart) continue;
      if (item.charStart >= span.charEnd) break;

      // Compute fraction of this text item that the span covers
      const overlapStart = Math.max(span.charStart, item.charStart);
      const overlapEnd = Math.min(span.charEnd, item.charEnd);
      const itemLength = item.charEnd - item.charStart;
      const startFrac = (overlapStart - item.charStart) / itemLength;
      const endFrac = (overlapEnd - item.charStart) / itemLength;

      // Apply viewport transform
      const x = (item.transform[4] + startFrac * item.width) * viewportScale;
      const y = item.transform[5] * viewportScale;
      const width = (endFrac - startFrac) * item.width * viewportScale;
      const height = (item.height ?? 12) * viewportScale;

      span.renderCoords = {
        pageNumber: item.pageNumber,
        x, y, width, height,
      };
      break;
    }
  }
}

// ─── Lookup Utilities ───────────────────────────────────────────────────────

/**
 * Binary search for the span at a given character offset.
 */
export function spanAtCharOffset(
  spans: DocumentTextSpan[],
  charOffset: number,
): DocumentTextSpan | null {
  let lo = 0;
  let hi = spans.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const span = spans[mid];

    if (charOffset < span.charStart) {
      hi = mid - 1;
    } else if (charOffset >= span.charEnd) {
      lo = mid + 1;
    } else {
      return span;
    }
  }

  return null;
}

/**
 * Get all spans for a given chunk.
 */
export function spansForChunk(
  map: DocumentRegionMap,
  chunkId: string,
): DocumentTextSpan[] {
  return map.byChunkId.get(chunkId) ?? [];
}

/**
 * Get the span for a given word.
 */
export function spanForWord(
  map: DocumentRegionMap,
  wordId: string,
): DocumentTextSpan | null {
  return map.byWordId.get(wordId) ?? null;
}

/**
 * Given a click position in the container, find the character offset in the plainText.
 * Uses document.caretRangeFromPoint for HTML views.
 */
export function charOffsetFromPoint(
  containerEl: HTMLElement,
  clientX: number,
  clientY: number,
): number | null {
  // caretRangeFromPoint is available in most browsers
  if (!('caretRangeFromPoint' in document)) return null;

  const range = document.caretRangeFromPoint(clientX, clientY);
  if (!range) return null;

  // Walk up to find nearest element with data-char-start
  let el = range.startContainer as Node | null;
  while (el && el !== containerEl) {
    if (el instanceof HTMLElement) {
      const charStart = el.getAttribute('data-char-start');
      if (charStart !== null) {
        // Compute offset within this element
        const baseOffset = parseInt(charStart, 10);
        // Count characters up to the caret position
        const textBefore = getTextContentUpToOffset(el, range.startContainer, range.startOffset);
        return baseOffset + textBefore.length;
      }
    }
    el = el.parentNode;
  }

  return null;
}

function getTextContentUpToOffset(
  rootEl: HTMLElement,
  targetNode: Node,
  targetOffset: number,
): string {
  let result = '';
  let found = false;

  function walk(node: Node) {
    if (found) return;
    if (node === targetNode) {
      if (node.nodeType === Node.TEXT_NODE) {
        result += (node.textContent || '').substring(0, targetOffset);
      }
      found = true;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || '';
    } else {
      for (const child of Array.from(node.childNodes)) {
        walk(child);
        if (found) return;
      }
    }
  }

  walk(rootEl);
  return result;
}
