// Built-in shape definitions for chunk edge profiles via CSS clip-path
import type { BuiltinShapeId } from '../types/scheme';

export interface BuiltinShapeDef {
  id: BuiltinShapeId;
  label: string;
  /** Returns CSS clip-path value for given width/height */
  getClipPath: (w: number, h: number) => string;
  /** Optional border-radius override (used instead of clip-path for simple shapes) */
  borderRadius?: string;
  /** Whether waveform rendering looks good with this shape */
  waveformCompatible: boolean;
}

export const BUILTIN_SHAPES: BuiltinShapeDef[] = [
  {
    id: 'default',
    label: 'Rectangle',
    getClipPath: () => 'none',
    waveformCompatible: true,
  },
  {
    id: 'sharp',
    label: 'Sharp',
    getClipPath: (_w, h) => {
      const inset = Math.min(6, h * 0.15);
      return `polygon(${inset}px 0%, 100% 0%, calc(100% - ${inset}px) 100%, 0% 100%)`;
    },
    waveformCompatible: true,
  },
  {
    id: 'rounded',
    label: 'Rounded',
    getClipPath: () => 'none',
    borderRadius: '999px',
    waveformCompatible: true,
  },
  {
    id: 'tapered',
    label: 'Tapered',
    getClipPath: (_w, h) => {
      const inset = Math.min(4, h * 0.12);
      return `polygon(0% ${inset}px, 100% 0%, 100% 100%, 0% calc(100% - ${inset}px))`;
    },
    waveformCompatible: true,
  },
  {
    id: 'scalloped',
    label: 'Scalloped',
    getClipPath: (_w, h) => {
      const r = Math.min(6, h * 0.2);
      // Scallop on left and right edges
      return `polygon(${r}px 0%, calc(100% - ${r}px) 0%, 100% 50%, calc(100% - ${r}px) 100%, ${r}px 100%, 0% 50%)`;
    },
    waveformCompatible: false,
  },
  {
    id: 'notched',
    label: 'Notched',
    getClipPath: (_w, h) => {
      const n = Math.min(4, h * 0.12);
      return `polygon(0% 0%, calc(100% - ${n}px) 0%, 100% ${n}px, 100% calc(100% - ${n}px), calc(100% - ${n}px) 100%, 0% 100%)`;
    },
    waveformCompatible: true,
  },
  {
    id: 'wave',
    label: 'Wave',
    getClipPath: (w, h) => {
      // Sine-wave top edge using polygon points
      const points: string[] = [];
      const amplitude = Math.min(3, h * 0.1);
      const steps = Math.max(8, Math.min(20, Math.round(w / 8)));
      // Top edge (wave)
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * 100;
        const y = amplitude * Math.sin((i / steps) * Math.PI * 2);
        points.push(`${x}% ${y + amplitude}px`);
      }
      // Bottom edge (flat)
      points.push('100% 100%', '0% 100%');
      return `polygon(${points.join(', ')})`;
    },
    waveformCompatible: false,
  },
  {
    id: 'chevron',
    label: 'Chevron',
    getClipPath: (_w, h) => {
      const arrow = Math.min(8, h * 0.25);
      return `polygon(0% 0%, calc(100% - ${arrow}px) 0%, 100% 50%, calc(100% - ${arrow}px) 100%, 0% 100%, ${arrow}px 50%)`;
    },
    waveformCompatible: false,
  },
];

export const SHAPE_MAP = new Map(BUILTIN_SHAPES.map((s) => [s.id, s]));
