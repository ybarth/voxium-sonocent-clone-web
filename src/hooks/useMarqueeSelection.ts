import { useCallback, useRef, useState } from 'react';
import { useProjectStore } from '../stores/projectStore';

interface MarqueeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function useMarqueeSelection(containerRef: React.RefObject<HTMLElement | null>) {
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const prevSelectedRef = useRef<Set<string>>(new Set());
  const modeRef = useRef<'replace' | 'toggle' | 'add'>('replace');

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;

    // Only activate on empty space — ignore if click is on a chunk
    const target = e.target as HTMLElement;
    if (target.closest('[data-chunk-id]')) return;

    // Only primary button
    if (e.button !== 0) return;

    // Determine modifier mode
    if (e.ctrlKey || e.metaKey) {
      modeRef.current = 'toggle';
    } else if (e.shiftKey) {
      modeRef.current = 'add';
    } else {
      modeRef.current = 'replace';
    }

    // Capture current selection for toggle/add modes
    const currentSelection = useProjectStore.getState().selection.selectedChunkIds;
    prevSelectedRef.current = new Set(currentSelection);

    const containerRect = container.getBoundingClientRect();
    const x = e.clientX - containerRect.left + container.scrollLeft;
    const y = e.clientY - containerRect.top + container.scrollTop;
    startRef.current = { x, y };

    // Clear selection on plain click (will be refined on move)
    if (modeRef.current === 'replace') {
      useProjectStore.getState().clearSelection();
    }

    const handleMouseMove = (moveE: MouseEvent) => {
      if (!startRef.current || !container) return;

      const cr = container.getBoundingClientRect();
      const curX = moveE.clientX - cr.left + container.scrollLeft;
      const curY = moveE.clientY - cr.top + container.scrollTop;

      const left = Math.min(startRef.current.x, curX);
      const top = Math.min(startRef.current.y, curY);
      const width = Math.abs(curX - startRef.current.x);
      const height = Math.abs(curY - startRef.current.y);

      setMarquee({ left, top, width, height });

      // Skip selection computation for tiny drags
      if (width < 4 && height < 4) return;

      // Marquee rect in viewport coords for intersection
      const marqueeViewport = {
        left: left - container.scrollLeft + cr.left,
        top: top - container.scrollTop + cr.top,
        right: left + width - container.scrollLeft + cr.left,
        bottom: top + height - container.scrollTop + cr.top,
      };

      // Find all chunks that intersect
      const chunkEls = container.querySelectorAll('[data-chunk-id]');
      const intersecting = new Set<string>();
      chunkEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const overlaps = !(
          rect.right < marqueeViewport.left ||
          rect.left > marqueeViewport.right ||
          rect.bottom < marqueeViewport.top ||
          rect.top > marqueeViewport.bottom
        );
        if (overlaps) {
          const id = (el as HTMLElement).dataset.chunkId;
          if (id) intersecting.add(id);
        }
      });

      // Build final selection set
      const mode = modeRef.current;
      let finalIds: Set<string>;

      if (mode === 'replace') {
        finalIds = intersecting;
      } else if (mode === 'add') {
        finalIds = new Set([...prevSelectedRef.current, ...intersecting]);
      } else {
        // toggle — XOR
        finalIds = new Set(prevSelectedRef.current);
        intersecting.forEach((id) => {
          if (finalIds.has(id)) {
            finalIds.delete(id);
          } else {
            finalIds.add(id);
          }
        });
      }

      // Batch update selection
      useProjectStore.setState((s) => ({
        selection: {
          ...s.selection,
          selectedChunkIds: finalIds,
        },
      }));
    };

    const handleMouseUp = () => {
      startRef.current = null;
      setMarquee(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [containerRef]);

  return { marquee, onMouseDown };
}
