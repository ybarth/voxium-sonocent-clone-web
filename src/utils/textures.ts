// Built-in texture definitions — CSS backgrounds and canvas rendering
// All textures are pure CSS (gradients, SVG data URLs) — no external assets

import type { TextureRef, GradientDef, ChunkStyle, BuiltinTextureId } from '../types';
import { hexToRgb } from './colorUtils';

// ─── Texture metadata ────────────────────────────────────────────────────────

export interface TextureMeta {
  id: BuiltinTextureId;
  label: string;
}

export const BUILTIN_TEXTURES: TextureMeta[] = [
  { id: 'stripes-horiz', label: 'Horizontal Stripes' },
  { id: 'stripes-vert', label: 'Vertical Stripes' },
  { id: 'stripes-diag-left', label: 'Diagonal Left' },
  { id: 'stripes-diag-right', label: 'Diagonal Right' },
  { id: 'dots-sm', label: 'Small Dots' },
  { id: 'dots-md', label: 'Medium Dots' },
  { id: 'dots-lg', label: 'Large Dots' },
  { id: 'crosshatch', label: 'Crosshatch' },
  { id: 'grid', label: 'Grid' },
  { id: 'waves', label: 'Waves' },
  { id: 'zigzag', label: 'Zigzag' },
  { id: 'chevron', label: 'Chevron' },
  { id: 'checkerboard', label: 'Checkerboard' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'noise-fine', label: 'Noise (Fine)' },
  { id: 'noise-coarse', label: 'Noise (Coarse)' },
];

// ─── CSS generation for individual textures ──────────────────────────────────

function rgba(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function getBuiltinTextureCssInternal(
  id: BuiltinTextureId,
  patternColor: string,
  scale: number
): { backgroundImage: string; backgroundSize: string } {
  const s = scale;
  const pc = rgba(patternColor, 0.45); // pattern color — 45% alpha for reliable visibility
  const tr = 'transparent';

  switch (id) {
    case 'stripes-horiz':
      return {
        backgroundImage: `repeating-linear-gradient(0deg, ${pc} 0px, ${pc} ${1 * s}px, ${tr} ${1 * s}px, ${tr} ${6 * s}px)`,
        backgroundSize: `100% ${6 * s}px`,
      };
    case 'stripes-vert':
      return {
        backgroundImage: `repeating-linear-gradient(90deg, ${pc} 0px, ${pc} ${1 * s}px, ${tr} ${1 * s}px, ${tr} ${6 * s}px)`,
        backgroundSize: `${6 * s}px 100%`,
      };
    case 'stripes-diag-left':
      return {
        backgroundImage: `repeating-linear-gradient(135deg, ${pc} 0px, ${pc} ${1 * s}px, ${tr} ${1 * s}px, ${tr} ${6 * s}px)`,
        backgroundSize: `${8.5 * s}px ${8.5 * s}px`,
      };
    case 'stripes-diag-right':
      return {
        backgroundImage: `repeating-linear-gradient(45deg, ${pc} 0px, ${pc} ${1 * s}px, ${tr} ${1 * s}px, ${tr} ${6 * s}px)`,
        backgroundSize: `${8.5 * s}px ${8.5 * s}px`,
      };
    case 'dots-sm':
      return {
        backgroundImage: `radial-gradient(circle ${1 * s}px, ${pc} 100%, ${tr} 100%)`,
        backgroundSize: `${5 * s}px ${5 * s}px`,
      };
    case 'dots-md':
      return {
        backgroundImage: `radial-gradient(circle ${2 * s}px, ${pc} 100%, ${tr} 100%)`,
        backgroundSize: `${8 * s}px ${8 * s}px`,
      };
    case 'dots-lg':
      return {
        backgroundImage: `radial-gradient(circle ${3 * s}px, ${pc} 100%, ${tr} 100%)`,
        backgroundSize: `${10 * s}px ${10 * s}px`,
      };
    case 'crosshatch':
      return {
        backgroundImage: [
          `repeating-linear-gradient(45deg, ${pc} 0px, ${pc} ${1 * s}px, ${tr} ${1 * s}px, ${tr} ${6 * s}px)`,
          `repeating-linear-gradient(135deg, ${pc} 0px, ${pc} ${1 * s}px, ${tr} ${1 * s}px, ${tr} ${6 * s}px)`,
        ].join(', '),
        backgroundSize: `${8.5 * s}px ${8.5 * s}px`,
      };
    case 'grid':
      return {
        backgroundImage: [
          `repeating-linear-gradient(0deg, ${pc} 0px, ${pc} ${1 * s}px, ${tr} ${1 * s}px, ${tr} ${8 * s}px)`,
          `repeating-linear-gradient(90deg, ${pc} 0px, ${pc} ${1 * s}px, ${tr} ${1 * s}px, ${tr} ${8 * s}px)`,
        ].join(', '),
        backgroundSize: `${8 * s}px ${8 * s}px`,
      };
    case 'waves': {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${20 * s}" height="${10 * s}"><path d="M0 ${5 * s} Q${5 * s} 0 ${10 * s} ${5 * s} T${20 * s} ${5 * s}" fill="none" stroke="${encodeURIComponent(pc)}" stroke-width="${1 * s}"/></svg>`;
      return {
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
        backgroundSize: `${20 * s}px ${10 * s}px`,
      };
    }
    case 'zigzag': {
      const size = 10 * s;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size * 2}" height="${size}"><polyline points="0,${size} ${size},0 ${size * 2},${size}" fill="none" stroke="${encodeURIComponent(pc)}" stroke-width="${1 * s}"/></svg>`;
      return {
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
        backgroundSize: `${size * 2}px ${size}px`,
      };
    }
    case 'chevron': {
      const size = 10 * s;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size * 2}" height="${size}"><polyline points="0,${size * 0.75} ${size},${size * 0.25} ${size * 2},${size * 0.75}" fill="none" stroke="${encodeURIComponent(pc)}" stroke-width="${1.5 * s}"/></svg>`;
      return {
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
        backgroundSize: `${size * 2}px ${size}px`,
      };
    }
    case 'checkerboard': {
      const sz = 6 * s;
      return {
        backgroundImage: [
          `conic-gradient(${pc} 25%, ${tr} 25%, ${tr} 50%, ${pc} 50%, ${pc} 75%, ${tr} 75%)`,
        ].join(', '),
        backgroundSize: `${sz * 2}px ${sz * 2}px`,
      };
    }
    case 'diamond': {
      const sz = 10 * s;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}"><polygon points="${sz / 2},0 ${sz},${sz / 2} ${sz / 2},${sz} 0,${sz / 2}" fill="none" stroke="${encodeURIComponent(pc)}" stroke-width="${1 * s}"/></svg>`;
      return {
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
        backgroundSize: `${sz}px ${sz}px`,
      };
    }
    case 'noise-fine': {
      // Pseudo-noise via many tiny radial gradients — lightweight approximation
      return {
        backgroundImage: [
          `radial-gradient(circle 0.5px at 20% 30%, ${pc} 100%, ${tr} 100%)`,
          `radial-gradient(circle 0.5px at 60% 70%, ${pc} 100%, ${tr} 100%)`,
          `radial-gradient(circle 0.5px at 80% 20%, ${pc} 100%, ${tr} 100%)`,
          `radial-gradient(circle 0.5px at 40% 90%, ${pc} 100%, ${tr} 100%)`,
          `radial-gradient(circle 0.5px at 10% 60%, ${pc} 100%, ${tr} 100%)`,
        ].join(', '),
        backgroundSize: `${4 * s}px ${4 * s}px`,
      };
    }
    case 'noise-coarse': {
      return {
        backgroundImage: [
          `radial-gradient(circle ${1.5 * s}px at 25% 35%, ${pc} 100%, ${tr} 100%)`,
          `radial-gradient(circle ${1 * s}px at 65% 75%, ${pc} 100%, ${tr} 100%)`,
          `radial-gradient(circle ${1.5 * s}px at 85% 15%, ${pc} 100%, ${tr} 100%)`,
        ].join(', '),
        backgroundSize: `${10 * s}px ${10 * s}px`,
      };
    }
  }
}

// ─── Public texture CSS ──────────────────────────────────────────────────────

export function getTextureCss(
  textureRef: TextureRef,
  baseColor: string
): React.CSSProperties {
  if (textureRef.type === 'builtin' && textureRef.builtinId) {
    const patternColor = getContrastPatternColor(baseColor);
    const { backgroundImage, backgroundSize } = getBuiltinTextureCssInternal(
      textureRef.builtinId,
      patternColor,
      textureRef.scale
    );
    return {
      backgroundImage,
      backgroundSize,
      backgroundRepeat: 'repeat',
      opacity: textureRef.opacity,
    };
  }
  if ((textureRef.type === 'custom' || textureRef.type === 'ai') && textureRef.imageUrl) {
    return {
      backgroundImage: `url(${textureRef.imageUrl})`,
      backgroundSize: `${64 * textureRef.scale}px`,
      backgroundRepeat: 'repeat',
      opacity: textureRef.opacity,
    };
  }
  return {};
}

// ─── Gradient CSS ────────────────────────────────────────────────────────────

const DIRECTION_MAP: Record<string, string> = {
  'to-right': 'to right',
  'to-left': 'to left',
  'to-top': 'to top',
  'to-bottom': 'to bottom',
};

export function getGradientCss(gradient: GradientDef): string {
  const dir = DIRECTION_MAP[gradient.direction] ?? 'to right';
  const stops = [...gradient.stops]
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${(s.position * 100).toFixed(1)}%`)
    .join(', ');
  return `linear-gradient(${dir}, ${stops})`;
}

// ─── Composite CSS background (color + texture + gradient) ───────────────────

export function getCompositeCssBackground(style: ChunkStyle): React.CSSProperties {
  const layers: string[] = [];

  // Texture overlay (topmost)
  if (style.texture) {
    if (style.texture.type === 'builtin' && style.texture.builtinId) {
      const patternColor = getContrastPatternColor(style.color);
      const { backgroundImage } = getBuiltinTextureCssInternal(
        style.texture.builtinId,
        patternColor,
        style.texture.scale
      );
      layers.push(backgroundImage);
    } else if (style.texture.imageUrl) {
      layers.push(`url(${style.texture.imageUrl})`);
    }
  }

  // Gradient layer
  if (style.gradient && style.gradient.stops.length >= 2) {
    layers.push(getGradientCss(style.gradient));
  }

  if (layers.length === 0) {
    // Solid color only
    return {
      backgroundColor: style.color,
      opacity: style.alpha,
    };
  }

  return {
    backgroundImage: layers.join(', '),
    backgroundColor: style.color,
    opacity: style.alpha,
  };
}

// ─── Canvas rendering for waveform mode ─────────────────────────────────────

export function renderTextureToCanvas(
  ctx: CanvasRenderingContext2D,
  textureRef: TextureRef,
  width: number,
  height: number,
  baseColor: string
): void {
  if (textureRef.type === 'builtin' && textureRef.builtinId) {
    ctx.save();
    ctx.globalAlpha = textureRef.opacity;
    // Simple canvas texture rendering — draw pattern-like lines
    const patternColor = getContrastPatternColor(baseColor);
    const { r, g, b } = hexToRgb(patternColor);
    ctx.strokeStyle = `rgba(${r},${g},${b},0.45)`;
    ctx.lineWidth = 1;

    const s = textureRef.scale;
    const id = textureRef.builtinId;

    if (id === 'stripes-horiz') {
      for (let y = 0; y < height; y += 6 * s) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else if (id === 'stripes-vert') {
      for (let x = 0; x < width; x += 6 * s) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    } else if (id === 'stripes-diag-right' || id === 'stripes-diag-left') {
      const step = 6 * s;
      const dir = id === 'stripes-diag-right' ? 1 : -1;
      for (let d = -height; d < width + height; d += step) {
        ctx.beginPath();
        ctx.moveTo(d, dir === 1 ? 0 : height);
        ctx.lineTo(d + height * dir, dir === 1 ? height : 0);
        ctx.stroke();
      }
    } else if (id.startsWith('dots')) {
      const radius = id === 'dots-sm' ? 1 * s : id === 'dots-md' ? 2 * s : 3 * s;
      const spacing = id === 'dots-sm' ? 5 * s : id === 'dots-md' ? 8 * s : 10 * s;
      ctx.fillStyle = `rgba(${r},${g},${b},0.45)`;
      for (let x = spacing / 2; x < width; x += spacing) {
        for (let y = spacing / 2; y < height; y += spacing) {
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (id === 'grid') {
      for (let x = 0; x < width; x += 8 * s) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y < height; y += 8 * s) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }
    } else if (id === 'crosshatch') {
      const step = 6 * s;
      for (let d = -height; d < width + height; d += step) {
        ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + height, height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(d, height); ctx.lineTo(d + height, 0); ctx.stroke();
      }
    }
    // Other patterns degrade gracefully to no canvas texture

    ctx.restore();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute a pattern color that contrasts with the base color.
 * For very dark or very bright backgrounds the default 30% opacity used in
 * `getBuiltinTextureCssInternal` can be invisible, so we boost the effective
 * opacity via a semi-transparent color that adapts to mid-range luminance.
 */
function getContrastPatternColor(baseColor: string): string {
  const { r, g, b } = hexToRgb(baseColor);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  // For mid-range backgrounds (0.25-0.65) the existing black/white at 30%
  // opacity works fine. For extremes we shift toward an intermediate gray
  // so the 30% alpha still produces a visible contrast difference.
  if (lum > 0.65) return '#000000';       // dark pattern on light bg
  if (lum < 0.15) return '#FFFFFF';       // white pattern on very dark bg
  // Medium-dark range (0.15-0.65): use a lighter gray so the 0.3 alpha
  // produces enough contrast against the mid-tone base.
  return lum > 0.5 ? '#1a1a1a' : '#e0e0e0';
}

// Re-export for convenience
export { hexToRgb } from './colorUtils';
