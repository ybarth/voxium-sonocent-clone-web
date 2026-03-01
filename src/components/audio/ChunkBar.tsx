import { useRef, useMemo, useEffect, useCallback } from 'react';
import type { Chunk } from '../../types';
import { useProjectStore } from '../../stores/projectStore';
import { DEFAULT_CHUNK_COLOR } from '../../types';

interface ChunkBarProps {
  chunk: Chunk;
  chunkNumber: number;
  sectionChunkNumber: number;
  isSelected: boolean;
  isCurrent: boolean;
  cursorPosition: number; // 0-1
  onChunkClick: (chunkId: string, fraction: number, e: React.MouseEvent) => void;
}

const PX_PER_SECOND = 40;
const MIN_WIDTH = 30;
const MAX_WIDTH = 600;
const BAR_HEIGHT = 64;

export function ChunkBar({
  chunk,
  chunkNumber,
  sectionChunkNumber,
  isSelected,
  isCurrent,
  cursorPosition,
  onChunkClick,
}: ChunkBarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const visualMode = useProjectStore((s) => s.project.settings.visualMode);
  const numberDisplay = useProjectStore((s) => s.project.settings.chunkNumberDisplay);

  const duration = chunk.endTime - chunk.startTime;
  const width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, duration * PX_PER_SECOND));
  const color = chunk.color ?? DEFAULT_CHUNK_COLOR;

  const bgColor = useMemo(() => {
    if (visualMode === 'flat') return color;
    return color + '40';
  }, [color, visualMode]);

  // Cursor/text contrast color
  const contrastColor = useMemo(() => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  }, [color]);

  // Draw waveform
  useEffect(() => {
    if (visualMode !== 'waveform' || !canvasRef.current || !chunk.waveformData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = BAR_HEIGHT * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, BAR_HEIGHT);

    const peaks = chunk.waveformData;
    const barWidth = width / peaks.length;
    const mid = BAR_HEIGHT / 2;

    ctx.fillStyle = color;
    for (let i = 0; i < peaks.length; i++) {
      const h = Math.max(2, peaks[i] * mid * 0.9);
      ctx.fillRect(i * barWidth, mid - h, barWidth * 0.8, h * 2);
    }
  }, [chunk.waveformData, width, color, visualMode]);

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

  const numberLabel = useMemo(() => {
    switch (numberDisplay) {
      case 'section-relative': return `${sectionChunkNumber}`;
      case 'document-relative': return `${chunkNumber}`;
      case 'both': return `${sectionChunkNumber} (${chunkNumber})`;
      case 'hidden': return null;
    }
  }, [numberDisplay, chunkNumber, sectionChunkNumber]);

  // Show cursor line whenever this is the current chunk (playing or not)
  const showCursor = isCurrent;

  return (
    <div
      ref={barRef}
      onClick={handleClick}
      style={{
        width: `${width}px`,
        height: `${BAR_HEIGHT}px`,
        backgroundColor: visualMode === 'flat' ? color : bgColor,
        borderRadius: '6px',
        position: 'relative',
        cursor: 'text', // I-beam cursor for precise placement
        margin: '3px',
        display: 'inline-block',
        verticalAlign: 'top',
        transition: 'transform 0.15s, box-shadow 0.15s',
        transform: isCurrent ? 'scale(1.02)' : 'none',
        boxShadow: isSelected
          ? `0 0 0 2.5px #3B82F6, 0 0 8px rgba(59,130,246,0.4)`
          : '0 1px 3px rgba(0,0,0,0.15)',
        overflow: 'hidden',
        userSelect: 'none',
        // Prominent selection indicator: bright blue ring + glow
        outline: isSelected ? 'none' : 'none',
      }}
    >
      {/* Selection overlay — light blue tint */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderRadius: '6px',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Waveform canvas */}
      {visualMode === 'waveform' && (
        <canvas
          ref={canvasRef}
          style={{
            width: `${width}px`,
            height: `${BAR_HEIGHT}px`,
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Cursor line — shown even when not playing */}
      {showCursor && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: `${cursorPosition * 100}%`,
            width: '2px',
            height: '100%',
            backgroundColor: '#F59E0B', // Amber — highly visible
            boxShadow: '0 0 6px rgba(245,158,11,0.8)',
            zIndex: 3,
            transition: 'left 0.03s linear',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Chunk number badge */}
      {numberLabel && (
        <div
          style={{
            position: 'absolute',
            top: '3px',
            left: '5px',
            fontSize: '10px',
            fontWeight: 700,
            color: contrastColor,
            opacity: 0.7,
            zIndex: 1,
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          {numberLabel}
        </div>
      )}

      {/* Duration label */}
      <div
        style={{
          position: 'absolute',
          bottom: '3px',
          right: '5px',
          fontSize: '9px',
          color: contrastColor,
          opacity: 0.5,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        {duration.toFixed(1)}s
      </div>
    </div>
  );
}
