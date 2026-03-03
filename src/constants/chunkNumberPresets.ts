// Chunk number badge style presets
import type { ChunkNumberPresetId } from '../types';

export interface ChunkNumberPreset {
  id: ChunkNumberPresetId;
  label: string;
  fontFamily?: string;
  fontSizeBase: number;   // px at zoom 1
  fontSizeMin: number;    // px minimum
  fontWeight: number;
  opacity: number;
  background?: string;
  padding?: string;
  borderRadius?: string;
  textColor?: string;     // override contrast-based color
  textShadow?: string;
  letterSpacing?: string;
}

export const CHUNK_NUMBER_PRESETS: ChunkNumberPreset[] = [
  {
    id: 'default',
    label: 'Default',
    fontSizeBase: 9,
    fontSizeMin: 6,
    fontWeight: 700,
    opacity: 0.8,
  },
  {
    id: 'badge',
    label: 'Badge',
    fontSizeBase: 8,
    fontSizeMin: 6,
    fontWeight: 700,
    opacity: 1,
    textColor: '#ffffff',
    background: 'rgba(0,0,0,0.45)',
    padding: '1px 4px',
    borderRadius: '8px',
  },
  {
    id: 'monospace',
    label: 'Monospace',
    fontFamily: "'JetBrains Mono', 'Consolas', 'Monaco', monospace",
    fontSizeBase: 9,
    fontSizeMin: 6,
    fontWeight: 500,
    opacity: 0.85,
    letterSpacing: '0.5px',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    fontSizeBase: 7,
    fontSizeMin: 5,
    fontWeight: 400,
    opacity: 0.4,
  },
  {
    id: 'outlined',
    label: 'Outlined',
    fontSizeBase: 9,
    fontSizeMin: 6,
    fontWeight: 700,
    opacity: 1,
    textColor: '#ffffff',
    textShadow: '1px 0 0 rgba(0,0,0,0.7), -1px 0 0 rgba(0,0,0,0.7), 0 1px 0 rgba(0,0,0,0.7), 0 -1px 0 rgba(0,0,0,0.7)',
  },
  {
    id: 'large',
    label: 'Large',
    fontSizeBase: 12,
    fontSizeMin: 8,
    fontWeight: 800,
    opacity: 0.95,
  },
];

export const CHUNK_NUMBER_PRESET_MAP = new Map(
  CHUNK_NUMBER_PRESETS.map((p) => [p.id, p])
);
