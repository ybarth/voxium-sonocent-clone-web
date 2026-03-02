// Built-in attribute sets for mix-and-match scheme composition
import type { AttributeSet } from '../types/scheme';

// ─── Color sets ─────────────────────────────────────────────────────────────

export const COLOR_SET_WARM: AttributeSet = {
  id: 'color-warm',
  name: 'Warm',
  builtIn: true,
  attributeType: 'color',
  items: [
    { id: 'warm-1', label: 'Crimson', color: { hex: '#EF4444', alpha: 1 } },
    { id: 'warm-2', label: 'Orange', color: { hex: '#F97316', alpha: 1 } },
    { id: 'warm-3', label: 'Amber', color: { hex: '#EAB308', alpha: 1 } },
    { id: 'warm-4', label: 'Rose', color: { hex: '#EC4899', alpha: 1 } },
    { id: 'warm-5', label: 'Coral', color: { hex: '#FB7185', alpha: 1 } },
  ],
};

export const COLOR_SET_COOL: AttributeSet = {
  id: 'color-cool',
  name: 'Cool',
  builtIn: true,
  attributeType: 'color',
  items: [
    { id: 'cool-1', label: 'Blue', color: { hex: '#3B82F6', alpha: 1 } },
    { id: 'cool-2', label: 'Cyan', color: { hex: '#06B6D4', alpha: 1 } },
    { id: 'cool-3', label: 'Green', color: { hex: '#22C55E', alpha: 1 } },
    { id: 'cool-4', label: 'Teal', color: { hex: '#14B8A6', alpha: 1 } },
    { id: 'cool-5', label: 'Indigo', color: { hex: '#6366F1', alpha: 1 } },
  ],
};

export const COLOR_SET_PASTEL: AttributeSet = {
  id: 'color-pastel',
  name: 'Pastel',
  builtIn: true,
  attributeType: 'color',
  items: [
    { id: 'pastel-1', label: 'Blush', color: { hex: '#FCA5A5', alpha: 1 } },
    { id: 'pastel-2', label: 'Peach', color: { hex: '#FDE68A', alpha: 1 } },
    { id: 'pastel-3', label: 'Mint', color: { hex: '#A7F3D0', alpha: 1 } },
    { id: 'pastel-4', label: 'Sky', color: { hex: '#BFDBFE', alpha: 1 } },
    { id: 'pastel-5', label: 'Lavender', color: { hex: '#DDD6FE', alpha: 1 } },
  ],
};

export const COLOR_SET_VIVID: AttributeSet = {
  id: 'color-vivid',
  name: 'Vivid',
  builtIn: true,
  attributeType: 'color',
  items: [
    { id: 'vivid-1', label: 'Electric Blue', color: { hex: '#2563EB', alpha: 1 } },
    { id: 'vivid-2', label: 'Hot Pink', color: { hex: '#DB2777', alpha: 1 } },
    { id: 'vivid-3', label: 'Lime', color: { hex: '#65A30D', alpha: 1 } },
    { id: 'vivid-4', label: 'Violet', color: { hex: '#7C3AED', alpha: 1 } },
    { id: 'vivid-5', label: 'Sunflower', color: { hex: '#D97706', alpha: 1 } },
  ],
};

export const COLOR_SET_MONOCHROME: AttributeSet = {
  id: 'color-mono',
  name: 'Monochrome',
  builtIn: true,
  attributeType: 'color',
  items: [
    { id: 'mono-1', label: 'White', color: { hex: '#F5F5F5', alpha: 1 } },
    { id: 'mono-2', label: 'Light', color: { hex: '#A1A1AA', alpha: 1 } },
    { id: 'mono-3', label: 'Medium', color: { hex: '#6B7280', alpha: 1 } },
    { id: 'mono-4', label: 'Dark', color: { hex: '#44403C', alpha: 1 } },
    { id: 'mono-5', label: 'Charcoal', color: { hex: '#1C1917', alpha: 1 } },
  ],
};

export const COLOR_SET_EARTH: AttributeSet = {
  id: 'color-earth',
  name: 'Earth Tones',
  builtIn: true,
  attributeType: 'color',
  items: [
    { id: 'earth-1', label: 'Terracotta', color: { hex: '#C2410C', alpha: 1 } },
    { id: 'earth-2', label: 'Sand', color: { hex: '#D4A574', alpha: 1 } },
    { id: 'earth-3', label: 'Olive', color: { hex: '#4D7C0F', alpha: 1 } },
    { id: 'earth-4', label: 'Clay', color: { hex: '#92400E', alpha: 1 } },
    { id: 'earth-5', label: 'Stone', color: { hex: '#78716C', alpha: 1 } },
  ],
};

// ─── Texture sets ───────────────────────────────────────────────────────────

export const TEXTURE_SET_GEOMETRIC: AttributeSet = {
  id: 'texture-geometric',
  name: 'Geometric',
  builtIn: true,
  attributeType: 'texture',
  items: [
    { id: 'tex-stripes', label: 'Stripes', texture: { textureRef: { type: 'builtin', builtinId: 'stripes-diag-right', opacity: 0.3, scale: 1 } } },
    { id: 'tex-grid', label: 'Grid', texture: { textureRef: { type: 'builtin', builtinId: 'grid', opacity: 0.3, scale: 1 } } },
    { id: 'tex-crosshatch', label: 'Crosshatch', texture: { textureRef: { type: 'builtin', builtinId: 'crosshatch', opacity: 0.3, scale: 1 } } },
    { id: 'tex-checker', label: 'Checkerboard', texture: { textureRef: { type: 'builtin', builtinId: 'checkerboard', opacity: 0.3, scale: 1 } } },
    { id: 'tex-diamond', label: 'Diamond', texture: { textureRef: { type: 'builtin', builtinId: 'diamond', opacity: 0.3, scale: 1 } } },
  ],
};

export const TEXTURE_SET_ORGANIC: AttributeSet = {
  id: 'texture-organic',
  name: 'Organic',
  builtIn: true,
  attributeType: 'texture',
  items: [
    { id: 'tex-waves', label: 'Waves', texture: { textureRef: { type: 'builtin', builtinId: 'waves', opacity: 0.3, scale: 1 } } },
    { id: 'tex-dots', label: 'Dots', texture: { textureRef: { type: 'builtin', builtinId: 'dots-md', opacity: 0.3, scale: 1 } } },
    { id: 'tex-noise', label: 'Noise', texture: { textureRef: { type: 'builtin', builtinId: 'noise-fine', opacity: 0.3, scale: 1 } } },
    { id: 'tex-zigzag', label: 'Zigzag', texture: { textureRef: { type: 'builtin', builtinId: 'zigzag', opacity: 0.3, scale: 1 } } },
    { id: 'tex-chevron', label: 'Chevron', texture: { textureRef: { type: 'builtin', builtinId: 'chevron', opacity: 0.3, scale: 1 } } },
  ],
};

// ─── Shape sets ─────────────────────────────────────────────────────────────

export const SHAPE_SET_STANDARD: AttributeSet = {
  id: 'shape-standard',
  name: 'Standard',
  builtIn: true,
  attributeType: 'shape',
  items: [
    { id: 'shp-default', label: 'Rectangle', shape: { builtinId: 'default' } },
    { id: 'shp-sharp', label: 'Sharp', shape: { builtinId: 'sharp' } },
    { id: 'shp-rounded', label: 'Rounded', shape: { builtinId: 'rounded' } },
    { id: 'shp-tapered', label: 'Tapered', shape: { builtinId: 'tapered' } },
    { id: 'shp-scalloped', label: 'Scalloped', shape: { builtinId: 'scalloped' } },
    { id: 'shp-notched', label: 'Notched', shape: { builtinId: 'notched' } },
    { id: 'shp-wave', label: 'Wave', shape: { builtinId: 'wave' } },
    { id: 'shp-chevron', label: 'Chevron', shape: { builtinId: 'chevron' } },
  ],
};

export const SHAPE_SET_SUBTLE: AttributeSet = {
  id: 'shape-subtle',
  name: 'Subtle',
  builtIn: true,
  attributeType: 'shape',
  items: [
    { id: 'shps-default', label: 'Rectangle', shape: { builtinId: 'default' } },
    { id: 'shps-rounded', label: 'Rounded', shape: { builtinId: 'rounded' } },
    { id: 'shps-sharp', label: 'Sharp', shape: { builtinId: 'sharp' } },
  ],
};

// ─── Sound sets ─────────────────────────────────────────────────────────────

export const SOUND_SET_CLICKS: AttributeSet = {
  id: 'sound-clicks',
  name: 'Clicks',
  builtIn: true,
  attributeType: 'sound',
  items: [
    { id: 'snd-click-soft', label: 'Soft Click', sound: { sfxRef: { type: 'builtin', builtinId: 'click-soft', volume: 0.5 }, trigger: 'start' } },
    { id: 'snd-click-sharp', label: 'Sharp Click', sound: { sfxRef: { type: 'builtin', builtinId: 'click-sharp', volume: 0.5 }, trigger: 'start' } },
    { id: 'snd-click-pop', label: 'Pop', sound: { sfxRef: { type: 'builtin', builtinId: 'click-pop', volume: 0.5 }, trigger: 'start' } },
  ],
};

export const SOUND_SET_TONES: AttributeSet = {
  id: 'sound-tones',
  name: 'Tones',
  builtIn: true,
  attributeType: 'sound',
  items: [
    { id: 'snd-tone-low', label: 'Low Tone', sound: { sfxRef: { type: 'builtin', builtinId: 'tone-low', volume: 0.4 }, trigger: 'start' } },
    { id: 'snd-tone-mid', label: 'Mid Tone', sound: { sfxRef: { type: 'builtin', builtinId: 'tone-mid', volume: 0.4 }, trigger: 'start' } },
    { id: 'snd-tone-high', label: 'High Tone', sound: { sfxRef: { type: 'builtin', builtinId: 'tone-high', volume: 0.4 }, trigger: 'start' } },
  ],
};

export const SOUND_SET_CHIMES: AttributeSet = {
  id: 'sound-chimes',
  name: 'Chimes',
  builtIn: true,
  attributeType: 'sound',
  items: [
    { id: 'snd-chime-gentle', label: 'Gentle Chime', sound: { sfxRef: { type: 'builtin', builtinId: 'chime-gentle', volume: 0.4 }, trigger: 'start' } },
    { id: 'snd-chime-bright', label: 'Bright Chime', sound: { sfxRef: { type: 'builtin', builtinId: 'chime-bright', volume: 0.4 }, trigger: 'start' } },
    { id: 'snd-chime-deep', label: 'Deep Chime', sound: { sfxRef: { type: 'builtin', builtinId: 'chime-deep', volume: 0.4 }, trigger: 'start' } },
  ],
};

export const SOUND_SET_PERCUSSIVE: AttributeSet = {
  id: 'sound-percussive',
  name: 'Percussive',
  builtIn: true,
  attributeType: 'sound',
  items: [
    { id: 'snd-perc-hit', label: 'Hit', sound: { sfxRef: { type: 'builtin', builtinId: 'perc-hit', volume: 0.5 }, trigger: 'start' } },
    { id: 'snd-perc-tap', label: 'Tap', sound: { sfxRef: { type: 'builtin', builtinId: 'perc-tap', volume: 0.5 }, trigger: 'start' } },
    { id: 'snd-perc-rim', label: 'Rim', sound: { sfxRef: { type: 'builtin', builtinId: 'perc-rim', volume: 0.5 }, trigger: 'start' } },
  ],
};

// ─── All sets ───────────────────────────────────────────────────────────────

export const ALL_COLOR_SETS: AttributeSet[] = [
  COLOR_SET_WARM, COLOR_SET_COOL, COLOR_SET_PASTEL,
  COLOR_SET_VIVID, COLOR_SET_MONOCHROME, COLOR_SET_EARTH,
];

export const ALL_TEXTURE_SETS: AttributeSet[] = [
  TEXTURE_SET_GEOMETRIC, TEXTURE_SET_ORGANIC,
];

export const ALL_SHAPE_SETS: AttributeSet[] = [
  SHAPE_SET_STANDARD, SHAPE_SET_SUBTLE,
];

export const ALL_SOUND_SETS: AttributeSet[] = [
  SOUND_SET_CLICKS, SOUND_SET_TONES, SOUND_SET_CHIMES, SOUND_SET_PERCUSSIVE,
];

export const ALL_ATTRIBUTE_SETS: AttributeSet[] = [
  ...ALL_COLOR_SETS, ...ALL_TEXTURE_SETS, ...ALL_SHAPE_SETS, ...ALL_SOUND_SETS,
];
