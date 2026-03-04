import { useRef, useMemo, useEffect, useCallback, memo } from 'react';
import type { Chunk } from '../../types';
import { useProjectStore } from '../../stores/projectStore';
import { DEFAULT_CHUNK_COLOR } from '../../types';
import { type ModifierMode, MODIFIER_MODE_META } from '../../hooks/useModifierKeys';
import { getContrastColor, getAdaptiveCursorStyle, getChunkNumberColor } from '../../utils/colorUtils';
import { getCompositeCssBackground, renderTextureToCanvas, getGradientCss } from '../../utils/textures';
import { resolveChunkForm, resolvedFormToChunkStyle, getFormBaseColor } from '../../utils/formResolver';
import { getShapeClipPath, getShapeBorderRadius } from '../../utils/shapeRenderer';
import { CHUNK_NUMBER_PRESET_MAP } from '../../constants/chunkNumberPresets';

interface ChunkBarProps {
  chunk: Chunk;
  chunkNumber: number;
  sectionChunkNumber: number;
  isSelected: boolean;
  isChecked: boolean;
  isCurrent: boolean;
  cursorPosition: number; // 0-1
  modifierMode: ModifierMode;
  isFilterDimmed?: boolean;
  isDragTarget?: boolean;
  onChunkClick: (chunkId: string, fraction: number, e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent, sectionId: string, orderIndex: number) => void;
  onDragStart?: (e: React.DragEvent, chunkId: string) => void;
  onDragOver?: (e: React.DragEvent, chunkId: string, orderIndex: number) => void;
  onDrop?: (e: React.DragEvent, sectionId: string, orderIndex: number) => void;
}

const BASE_PX_PER_SECOND = 12;
const MIN_WIDTH = 15;
const MAX_WIDTH = 800;
const BASE_BAR_HEIGHT = 24;

export const ChunkBar = memo(function ChunkBar({
  chunk,
  chunkNumber,
  sectionChunkNumber,
  isSelected,
  isChecked,
  isCurrent,
  cursorPosition,
  modifierMode,
  isFilterDimmed = false,
  isDragTarget = false,
  onChunkClick,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
}: ChunkBarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const settings = useProjectStore((s) => s.project.settings);
  const scheme = useProjectStore((s) => s.project.scheme);
  const paintbrushActive = useProjectStore((s) => !!s.paintbrushMode);
  const checkSelectionMode = useProjectStore((s) => s.checkSelectionMode);
  const toggleCheckChunk = useProjectStore((s) => s.toggleCheckChunk);
  const classicMode = settings.classicMode;
  const visualMode = classicMode ? 'flat' as const : settings.visualMode;
  const numberDisplay = settings.chunkNumberDisplay;
  const zoomLevel = settings.zoomLevel ?? 1.0;

  const currentPxPerSecond = BASE_PX_PER_SECOND * zoomLevel;
  const currentBarHeight = BASE_BAR_HEIGHT * zoomLevel;

  const duration = chunk.endTime - chunk.startTime;
  const width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, duration * currentPxPerSecond));

  // Resolve form attributes (formId → legacy → defaults)
  const resolvedForm = useMemo(
    () => resolveChunkForm(chunk, scheme, settings.defaultAttributes),
    [chunk.formId, chunk.color, chunk.style, scheme, settings.defaultAttributes]
  );
  const resolvedStyle = useMemo(
    () => resolvedFormToChunkStyle(resolvedForm),
    [resolvedForm]
  );

  const baseColor = chunk.style?.color ?? chunk.color ?? DEFAULT_CHUNK_COLOR;
  const hasStyle = !!chunk.style;

  // Shape clip-path and border-radius from resolved form
  const shapeClipPath = useMemo(
    () => getShapeClipPath(resolvedForm.shape?.builtinId, width, currentBarHeight),
    [resolvedForm.shape?.builtinId, width, currentBarHeight]
  );
  const shapeBorderRadius = useMemo(
    () => getShapeBorderRadius(resolvedForm.shape?.builtinId),
    [resolvedForm.shape?.builtinId]
  );

  // Background style (CSS properties) for flat mode with rich styling
  const flatBgStyle = useMemo(() => {
    if (hasStyle && chunk.style) {
      return getCompositeCssBackground(chunk.style);
    }
    return {};
  }, [hasStyle, chunk.style]);

  const bgColor = useMemo(() => {
    if (hasStyle) return undefined; // handled by flatBgStyle
    if (visualMode === 'flat') return baseColor;
    return baseColor + '40';
  }, [baseColor, visualMode, hasStyle]);

  // Cursor/text contrast color — adaptive for gradients
  const contrastColor = useMemo(() => {
    if (hasStyle && chunk.style?.gradient) {
      return getAdaptiveCursorStyle(chunk.style, baseColor, 0.5).color;
    }
    return getContrastColor(baseColor);
  }, [baseColor, hasStyle, chunk.style]);

  // WCAG-optimal contrast color for chunk number badge
  // Uses proper sRGB linearization, gradient sampling at badge position,
  // and alpha compositing against the dark app background
  const numberContrastColor = useMemo(() => {
    return getChunkNumberColor(chunk.style ?? null, baseColor, visualMode);
  }, [chunk.style, baseColor, visualMode]);

  // Adaptive cursor style (updates per frame for gradients)
  const cursorStyle = useMemo(() => {
    if (hasStyle && chunk.style) {
      return getAdaptiveCursorStyle(chunk.style, baseColor, cursorPosition);
    }
    return { color: MODIFIER_MODE_META[modifierMode].color, shadow: `0 0 ${4 * zoomLevel}px ${MODIFIER_MODE_META[modifierMode].color}cc` };
  }, [hasStyle, chunk.style, baseColor, cursorPosition, modifierMode, zoomLevel]);

  // Draw waveform
  useEffect(() => {
    if (visualMode !== 'waveform' || !canvasRef.current || !chunk.waveformData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = currentBarHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, currentBarHeight);

    const peaks = chunk.waveformData;
    const barWidth = width / peaks.length;
    const mid = currentBarHeight / 2;

    // Gradient fill for waveform bars if style has gradient
    if (hasStyle && chunk.style?.gradient && chunk.style.gradient.stops.length >= 2) {
      const dir = chunk.style.gradient.direction;
      let canvasGrad: CanvasGradient;
      if (dir === 'to-right' || dir === 'to-left') {
        canvasGrad = ctx.createLinearGradient(
          dir === 'to-left' ? width : 0, 0,
          dir === 'to-left' ? 0 : width, 0
        );
      } else {
        canvasGrad = ctx.createLinearGradient(
          0, dir === 'to-top' ? currentBarHeight : 0,
          0, dir === 'to-top' ? 0 : currentBarHeight
        );
      }
      for (const stop of chunk.style.gradient.stops) {
        canvasGrad.addColorStop(stop.position, stop.color);
      }
      ctx.fillStyle = canvasGrad;
    } else {
      ctx.fillStyle = baseColor;
    }

    for (let i = 0; i < peaks.length; i++) {
      const h = Math.max(1, peaks[i] * mid * 0.8);
      ctx.fillRect(i * barWidth, mid - h, Math.max(1, barWidth * 0.8), h * 2);
    }

    // Overlay texture on waveform using source-atop compositing
    if (hasStyle && chunk.style?.texture) {
      ctx.globalCompositeOperation = 'source-atop';
      renderTextureToCanvas(ctx, chunk.style.texture, width, currentBarHeight, baseColor);
      ctx.globalCompositeOperation = 'source-over';
    }
  }, [chunk.waveformData, width, baseColor, visualMode, currentBarHeight, hasStyle, chunk.style]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const fraction = Math.max(0, Math.min(1, x / rect.width));
      onChunkClick(chunk.id, fraction, e);
    },
    [chunk.id, onChunkClick]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (onContextMenu) {
        onContextMenu(e, chunk.sectionId, chunk.orderIndex + 1);
      }
    },
    [chunk.sectionId, chunk.orderIndex, onContextMenu]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', chunk.id);
      onDragStart?.(e, chunk.id);
    },
    [chunk.id, onDragStart]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      onDragOver?.(e, chunk.id, chunk.orderIndex);
    },
    [chunk.id, chunk.orderIndex, onDragOver]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      onDrop?.(e, chunk.sectionId, chunk.orderIndex);
    },
    [chunk.sectionId, chunk.orderIndex, onDrop]
  );

  const numberLabel = useMemo(() => {
    switch (numberDisplay) {
      case 'section-relative': return `${sectionChunkNumber}`;
      case 'document-relative': return `${chunkNumber}`;
      case 'both': {
        // Narrow chunk guard: show only project number when too tight
        if (width < 35 * zoomLevel) return `${chunkNumber}`;
        return `${sectionChunkNumber} (${chunkNumber})`;
      }
      case 'hidden': return null;
    }
  }, [numberDisplay, chunkNumber, sectionChunkNumber, width, zoomLevel]);

  const numberPreset = useMemo(() => {
    const id = settings.chunkNumberStyle ?? 'default';
    return CHUNK_NUMBER_PRESET_MAP.get(id) ?? CHUNK_NUMBER_PRESET_MAP.get('default')!;
  }, [settings.chunkNumberStyle]);

  // Show cursor line whenever this is the current chunk (playing or not)
  const showCursor = isCurrent;

  // Build container style
  const defaultRadius = `${3 * zoomLevel}px`;
  const containerStyle: React.CSSProperties = classicMode
    ? {
        // ── Sonocent Classic: clean flat solid bar ──
        width: `${width}px`,
        height: `${currentBarHeight}px`,
        borderRadius: `${2 * zoomLevel}px`,
        position: 'relative',
        cursor: paintbrushActive ? 'crosshair' : MODIFIER_MODE_META[modifierMode].cursor,
        margin: `${1.5 * zoomLevel}px ${1 * zoomLevel}px`,
        display: 'inline-block',
        verticalAlign: 'top',
        transition: 'box-shadow 0.15s, width 0.28s linear',
        backgroundColor: baseColor,
        boxShadow: isSelected
          ? `0 0 0 ${2 * zoomLevel}px #2563EB`
          : `0 ${0.5 * zoomLevel}px ${1 * zoomLevel}px rgba(0,0,0,0.12)`,
        overflow: 'hidden',
        userSelect: 'none',
        zIndex: isCurrent ? 10 : 1,
        ...(isFilterDimmed ? { opacity: 0.2, filter: 'grayscale(0.8)' } : {}),
      }
    : {
        width: `${width}px`,
        height: `${currentBarHeight}px`,
        borderRadius: shapeBorderRadius ?? defaultRadius,
        position: 'relative',
        cursor: paintbrushActive ? 'crosshair' : MODIFIER_MODE_META[modifierMode].cursor,
        margin: `${2 * zoomLevel}px`,
        display: 'inline-block',
        verticalAlign: 'top',
        transition: 'transform 0.15s, box-shadow 0.15s, width 0.28s linear, height 0.1s',
        transform: isCurrent ? 'scale(1.05)' : 'none',
        boxShadow: isSelected
          ? `0 0 0 ${2 * zoomLevel}px #3B82F6, 0 0 ${6 * zoomLevel}px rgba(59,130,246,0.4)`
          : `0 ${1 * zoomLevel}px ${2 * zoomLevel}px rgba(0,0,0,0.1)`,
        overflow: 'hidden',
        userSelect: 'none',
        zIndex: isCurrent ? 10 : 1,
        // Shape clip-path
        ...(shapeClipPath !== 'none' ? { clipPath: shapeClipPath } : {}),
        // Filter dimming
        ...(isFilterDimmed ? { opacity: 0.2, filter: 'grayscale(0.8)' } : {}),
      };

  // Apply background: either rich style or simple color (skip in classic mode — already set above)
  if (!classicMode) {
    if (hasStyle && visualMode === 'flat') {
      Object.assign(containerStyle, flatBgStyle);
    } else {
      containerStyle.backgroundColor = bgColor;
    }
  }

  return (
    <div
      ref={barRef}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      draggable={isSelected}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        ...containerStyle,
        ...(isDragTarget ? { outline: `2px solid #3B82F6`, outlineOffset: '-2px' } : {}),
      }}
    >
      {/* Texture overlay for flat mode with rich style — handled by getCompositeCssBackground */}

      {/* Selection overlay — light blue tint */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderRadius: `${3 * zoomLevel}px`,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Waveform canvas (disabled in classic mode) */}
      {!classicMode && visualMode === 'waveform' && (
        <canvas
          ref={canvasRef}
          style={{
            width: `${width}px`,
            height: `${currentBarHeight}px`,
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Cursor line — adaptive for gradients */}
      {showCursor && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: `${cursorPosition * 100}%`,
            width: `${Math.max(1, 2 * zoomLevel)}px`,
            height: '100%',
            backgroundColor: cursorStyle.color,
            boxShadow: cursorStyle.shadow,
            zIndex: 3,
            transition: 'left 0.03s linear',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Nudge grab indicator */}
      {isSelected && modifierMode === 'nudge' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            border: `${Math.max(1, 2 * zoomLevel)}px dashed #F97316`,
            borderRadius: `${3 * zoomLevel}px`,
            zIndex: 4,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Chunk number badge */}
      {numberLabel && (
        <div
          style={classicMode ? {
            position: 'absolute',
            top: `${1 * zoomLevel}px`,
            left: `${3 * zoomLevel}px`,
            fontSize: `${Math.max(7, 9 * zoomLevel)}px`,
            fontWeight: 700,
            color: getContrastColor(baseColor),
            opacity: 0.85,
            whiteSpace: 'nowrap',
            zIndex: 1,
            lineHeight: 1,
            pointerEvents: 'none',
          } : {
            position: 'absolute',
            top: `${1 * zoomLevel}px`,
            left: `${3 * zoomLevel}px`,
            fontSize: `${Math.max(numberPreset.fontSizeMin, numberPreset.fontSizeBase * zoomLevel)}px`,
            fontWeight: numberPreset.fontWeight,
            fontFamily: numberPreset.fontFamily,
            color: numberPreset.textColor ?? numberContrastColor,
            opacity: numberPreset.opacity,
            background: numberPreset.background,
            padding: numberPreset.padding,
            borderRadius: numberPreset.borderRadius,
            textShadow: numberPreset.textShadow,
            letterSpacing: numberPreset.letterSpacing,
            whiteSpace: 'nowrap',
            zIndex: 1,
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          {numberLabel}
        </div>
      )}

      {/* Duration label - only show if width allows (hidden in classic mode for cleaner look) */}
      {!classicMode && width > 40 * zoomLevel && (
        <div
          style={{
            position: 'absolute',
            bottom: `${1 * zoomLevel}px`,
            right: `${3 * zoomLevel}px`,
            fontSize: `${Math.max(5, 8 * zoomLevel)}px`,
            color: contrastColor,
            opacity: 0.6,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        >
          {duration.toFixed(1)}s
        </div>
      )}

      {/* Checkbox — visible when check selection mode is active */}
      {checkSelectionMode && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            toggleCheckChunk(chunk.id);
          }}
          style={{
            position: 'absolute',
            top: `${1 * zoomLevel}px`,
            right: `${3 * zoomLevel}px`,
            width: `${Math.max(12, 14 * zoomLevel)}px`,
            height: `${Math.max(12, 14 * zoomLevel)}px`,
            borderRadius: `${2 * zoomLevel}px`,
            border: isChecked ? '2px solid #22C55E' : '2px solid rgba(255,255,255,0.5)',
            backgroundColor: isChecked ? '#22C55E' : 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 6,
            transition: 'background-color 0.1s, border-color 0.1s',
          }}
        >
          {isChecked && (
            <span style={{
              color: '#fff',
              fontSize: `${Math.max(8, 10 * zoomLevel)}px`,
              lineHeight: 1,
              fontWeight: 700,
            }}>
              ✓
            </span>
          )}
        </div>
      )}

      {/* Tag badges */}
      {(chunk.tags ?? []).length > 0 && width > 30 * zoomLevel && (
        <div
          style={{
            position: 'absolute',
            bottom: `${1 * zoomLevel}px`,
            left: `${3 * zoomLevel}px`,
            display: 'flex',
            gap: `${1 * zoomLevel}px`,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        >
          {(chunk.tags ?? []).slice(0, 2).map(tag => (
            <span
              key={tag}
              style={{
                fontSize: `${Math.max(5, 7 * zoomLevel)}px`,
                backgroundColor: 'rgba(0,0,0,0.4)',
                color: '#e0e0e0',
                borderRadius: `${2 * zoomLevel}px`,
                padding: `0 ${2 * zoomLevel}px`,
                lineHeight: 1.4,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>

  );
});
