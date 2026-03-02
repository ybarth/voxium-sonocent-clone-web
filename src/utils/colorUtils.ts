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

export function getLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function getContrastColor(hex: string): '#000000' | '#FFFFFF' {
  return getLuminance(hex) > 0.5 ? '#000000' : '#FFFFFF';
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
