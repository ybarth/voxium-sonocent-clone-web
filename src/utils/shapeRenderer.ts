// Shape renderer — resolves shape IDs to CSS clip-path and border-radius values.
// Memoized for performance since clip-paths are GPU-composited.

import type { BuiltinShapeId } from '../types/scheme';
import { SHAPE_MAP } from '../constants/shapes';

// Memoization cache: "shapeId:w:h" → clipPath
const clipPathCache = new Map<string, string>();
const MAX_CACHE_SIZE = 500;

/**
 * Get the CSS clip-path value for a shape at given dimensions.
 * Returns 'none' for the default rectangle shape.
 */
export function getShapeClipPath(
  shapeId: BuiltinShapeId | undefined,
  width: number,
  height: number
): string {
  if (!shapeId || shapeId === 'default') return 'none';

  const shape = SHAPE_MAP.get(shapeId);
  if (!shape) return 'none';

  // Use border-radius shapes don't need clip-path
  if (shape.borderRadius) return 'none';

  // Round dimensions for cache key
  const w = Math.round(width);
  const h = Math.round(height);
  const key = `${shapeId}:${w}:${h}`;

  const cached = clipPathCache.get(key);
  if (cached) return cached;

  const result = shape.getClipPath(w, h);

  // Evict oldest entries if cache is too large
  if (clipPathCache.size >= MAX_CACHE_SIZE) {
    const firstKey = clipPathCache.keys().next().value;
    if (firstKey) clipPathCache.delete(firstKey);
  }
  clipPathCache.set(key, result);

  return result;
}

/**
 * Get the CSS border-radius for a shape, if it uses border-radius instead of clip-path.
 */
export function getShapeBorderRadius(
  shapeId: BuiltinShapeId | undefined
): string | undefined {
  if (!shapeId || shapeId === 'default') return undefined;
  const shape = SHAPE_MAP.get(shapeId);
  return shape?.borderRadius;
}

/**
 * Check if a shape is compatible with waveform rendering.
 */
export function isShapeWaveformCompatible(
  shapeId: BuiltinShapeId | undefined
): boolean {
  if (!shapeId || shapeId === 'default') return true;
  const shape = SHAPE_MAP.get(shapeId);
  return shape?.waveformCompatible ?? true;
}
