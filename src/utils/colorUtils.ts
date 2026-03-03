// Color conversion, luminance, contrast, gradient sampling utilities

import type { ChunkStyle, GradientDef } from '../types';

// ─── Hex ↔ RGB ───────────────────────────────────────────────────────────────

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('');
}

export function parseHexAlpha(hex: string): { r: number; g: number; b: number; a: number } {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const a = h.length >= 8 ? parseInt(h.substring(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

// ─── Hex ↔ HSL ───────────────────────────────────────────────────────────────

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rf) h = ((gf - bf) / d + (gf < bf ? 6 : 0)) / 6;
    else if (max === gf) h = ((bf - rf) / d + 2) / 6;
    else h = ((rf - gf) / d + 4) / 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h: number, s: number, l: number): string {
  const sf = s / 100, lf = l / 100;
  const a = sf * Math.min(lf, 1 - lf);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lf - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color);
  };
  return rgbToHex(f(0), f(8), f(4));
}

// ─── Hex ↔ HSV ───────────────────────────────────────────────────────────────

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const { r, g, b } = hexToRgb(hex);
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    if (max === rf) h = ((gf - bf) / d + (gf < bf ? 6 : 0)) / 6;
    else if (max === gf) h = ((bf - rf) / d + 2) / 6;
    else h = ((rf - gf) / d + 4) / 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const sf = s / 100, vf = v / 100;
  const c = vf * sf;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vf - c;
  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }

  return rgbToHex(
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  );
}

// ─── Luminance & contrast ────────────────────────────────────────────────────

/** Simplified luminance (legacy — used by existing callers) */
export function getLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Simple black/white pick (legacy — used by cursor, duration label) */
export function getContrastColor(hex: string): '#000000' | '#FFFFFF' {
  return getLuminance(hex) > 0.5 ? '#000000' : '#FFFFFF';
}

// ─── WCAG 2.1 contrast utilities ────────────────────────────────────────────

/** Linearize a single sRGB channel (0-255) per IEC 61966-2-1 */
function srgbChannelToLinear(c8: number): number {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.1 relative luminance (properly gamma-linearized) */
export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * srgbChannelToLinear(r)
       + 0.7152 * srgbChannelToLinear(g)
       + 0.0722 * srgbChannelToLinear(b);
}

/** WCAG 2.1 contrast ratio between two colors (1:1 to 21:1) */
export function getWcagContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Alpha-composite a foreground color over a background color */
function alphaComposite(fgHex: string, alpha: number, bgHex: string): string {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  const a = Math.max(0, Math.min(1, alpha));
  return rgbToHex(
    fg.r * a + bg.r * (1 - a),
    fg.g * a + bg.g * (1 - a),
    fg.b * a + bg.b * (1 - a),
  );
}

/** App dark background color used for alpha compositing */
const APP_BG = '#1a1a2e';

/**
 * Compute the optimal high-contrast text color for a chunk number badge.
 *
 * Accounts for:
 * - WCAG 2.1 relative luminance with proper sRGB linearization
 * - Gradient sampling at the badge position (top-left corner)
 * - Alpha compositing against the dark app background
 * - Waveform mode's reduced-alpha chunk overlay
 *
 * Returns '#000000' or '#FFFFFF' — whichever yields the higher WCAG contrast ratio.
 */
export function getChunkNumberColor(
  style: ChunkStyle | null,
  baseColor: string,
  visualMode: 'waveform' | 'flat',
): string {
  let effectiveBg: string;

  if (style?.gradient && style.gradient.stops.length >= 2) {
    // Sample the gradient at the number badge position.
    // Badge is at top-left: for horizontal gradients use x≈0.05,
    // for vertical gradients use y≈0.05.
    const dir = style.gradient.direction;
    let frac: number;
    if (dir === 'to-right') frac = 0.05;
    else if (dir === 'to-left') frac = 0.95;
    else if (dir === 'to-bottom') frac = 0.05;
    else /* to-top */ frac = 0.95;
    effectiveBg = sampleGradientColorAt(style.gradient, frac);
    // Apply style alpha
    if (style.alpha < 1) {
      effectiveBg = alphaComposite(effectiveBg, style.alpha, APP_BG);
    }
  } else if (style) {
    effectiveBg = style.color;
    if (style.alpha < 1) {
      effectiveBg = alphaComposite(effectiveBg, style.alpha, APP_BG);
    }
  } else if (visualMode === 'waveform') {
    // Waveform mode: chunk bg is baseColor at ~25% alpha over dark background
    effectiveBg = alphaComposite(baseColor, 0.25, APP_BG);
  } else {
    effectiveBg = baseColor;
  }

  // Pick black or white based on highest WCAG contrast ratio
  const ratioBlack = getWcagContrastRatio(effectiveBg, '#000000');
  const ratioWhite = getWcagContrastRatio(effectiveBg, '#FFFFFF');
  return ratioWhite >= ratioBlack ? '#FFFFFF' : '#000000';
}

// ─── Gradient sampling ───────────────────────────────────────────────────────

function lerpColor(c1: string, c2: string, t: number): string {
  const rgb1 = hexToRgb(c1);
  const rgb2 = hexToRgb(c2);
  return rgbToHex(
    rgb1.r + (rgb2.r - rgb1.r) * t,
    rgb1.g + (rgb2.g - rgb1.g) * t,
    rgb1.b + (rgb2.b - rgb1.b) * t,
  );
}

export function sampleGradientColorAt(gradient: GradientDef, fraction: number): string {
  const stops = [...gradient.stops].sort((a, b) => a.position - b.position);
  if (stops.length === 0) return '#FFFFFF';
  if (stops.length === 1) return stops[0].color;
  if (fraction <= stops[0].position) return stops[0].color;
  if (fraction >= stops[stops.length - 1].position) return stops[stops.length - 1].color;

  for (let i = 0; i < stops.length - 1; i++) {
    if (fraction >= stops[i].position && fraction <= stops[i + 1].position) {
      const range = stops[i + 1].position - stops[i].position;
      const t = range === 0 ? 0 : (fraction - stops[i].position) / range;
      return lerpColor(stops[i].color, stops[i + 1].color, t);
    }
  }
  return stops[stops.length - 1].color;
}

// ─── Section saturation utilities ────────────────────────────────────────────

/** Check if a hex color has HSL saturation >= the given minimum (default 75%) */
export function isHighSaturation(hex: string, min = 75): boolean {
  const { s } = hexToHsl(hex);
  return s >= min;
}

/** Clamp HSL saturation upward to at least `min`% (default 75%) */
export function enforceMinSaturation(hex: string, min = 75): string {
  const { h, s, l } = hexToHsl(hex);
  if (s >= min) return hex;
  return hslToHex(h, min, l);
}

/** Reduce saturation by `step * depth` percentage points (default step=10) */
export function desaturateByDepth(hex: string, depth: number, step = 10): string {
  if (depth <= 0) return hex;
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, Math.max(0, s - step * depth), l);
}

// ─── Adaptive cursor style ──────────────────────────────────────────────────

export function getAdaptiveCursorStyle(
  style: ChunkStyle | null,
  baseColor: string,
  xFraction: number
): { color: string; shadow: string } {
  let sampleColor = baseColor;

  if (style?.gradient) {
    // For horizontal gradients, sample at cursor X position
    const dir = style.gradient.direction;
    if (dir === 'to-right' || dir === 'to-left') {
      const frac = dir === 'to-left' ? 1 - xFraction : xFraction;
      sampleColor = sampleGradientColorAt(style.gradient, frac);
    } else {
      // Vertical gradients — sample at 0.5
      sampleColor = sampleGradientColorAt(style.gradient, 0.5);
    }
  } else if (style) {
    sampleColor = style.color;
  }

  const lum = getLuminance(sampleColor);
  const cursorColor = lum > 0.5 ? '#000000' : '#FFFFFF';
  const shadowColor = lum > 0.5 ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
  return { color: cursorColor, shadow: `0 0 2px ${shadowColor}` };
}
