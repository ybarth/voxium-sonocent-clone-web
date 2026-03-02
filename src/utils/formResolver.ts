// Form resolver — bridges Forms & Schemes to the existing rendering pipeline.
// Resolves a chunk's visual attributes from formId → legacy color/style → defaults.

import type { Chunk, ChunkStyle } from '../types';
import type {
  Scheme, DefaultAttributes, ResolvedForm, Form,
  ColorAttribute, ShapeAttribute,
} from '../types/scheme';
import { DEFAULT_FORM_ATTRIBUTES } from '../types/scheme';

/**
 * Resolve a chunk's form to a fully-populated ResolvedForm.
 * Priority: formId in active scheme → legacy color/style → defaults.
 */
export function resolveChunkForm(
  chunk: Chunk,
  scheme: Scheme,
  defaults: DefaultAttributes = DEFAULT_FORM_ATTRIBUTES
): ResolvedForm {
  // 1. Try to resolve via formId
  if (chunk.formId) {
    const form = scheme.forms.find((f) => f.id === chunk.formId);
    if (form) {
      return resolveFormWithDefaults(form, defaults);
    }
  }

  // 2. Try to match legacy color to a form in the scheme
  const legacyColor = chunk.style?.color ?? chunk.color;
  if (legacyColor) {
    const matchingForm = scheme.forms.find((f) => f.color?.hex === legacyColor);
    if (matchingForm) {
      return resolveFormWithDefaults(matchingForm, defaults);
    }
  }

  // 3. Build from legacy style data directly
  if (chunk.style) {
    return {
      formId: null,
      label: '',
      color: {
        hex: chunk.style.color,
        alpha: chunk.style.alpha,
        gradient: chunk.style.gradient ?? undefined,
      },
      texture: chunk.style.texture ? { textureRef: chunk.style.texture } : null,
      shape: defaults.shape,
      sound: defaults.sound ?? null,
    };
  }

  // 4. Build from legacy color only
  if (chunk.color) {
    return {
      formId: null,
      label: '',
      color: { hex: chunk.color, alpha: 1 },
      texture: null,
      shape: defaults.shape,
      sound: defaults.sound ?? null,
    };
  }

  // 5. Fallback to defaults
  return {
    formId: null,
    label: '',
    color: defaults.color,
    texture: defaults.texture ? defaults.texture : null,
    shape: defaults.shape,
    sound: defaults.sound ?? null,
  };
}

/**
 * Resolve a Form into a ResolvedForm by filling in defaults for missing attributes.
 */
function resolveFormWithDefaults(
  form: Form,
  defaults: DefaultAttributes
): ResolvedForm {
  return {
    formId: form.id,
    label: form.label,
    color: form.color ?? defaults.color,
    texture: form.texture ?? defaults.texture ?? null,
    shape: form.shape ?? defaults.shape,
    sound: form.sound ?? defaults.sound ?? null,
  };
}

/**
 * Convert a ResolvedForm back to a ChunkStyle for backward compatibility
 * with existing rendering code (ChunkBar, textures, gradients).
 */
export function resolvedFormToChunkStyle(resolved: ResolvedForm): ChunkStyle {
  return {
    color: resolved.color.hex,
    alpha: resolved.color.alpha,
    texture: resolved.texture?.textureRef ?? null,
    gradient: resolved.color.gradient ?? null,
  };
}

/**
 * Get the base color hex from a ResolvedForm.
 */
export function getFormBaseColor(resolved: ResolvedForm): string {
  return resolved.color.hex;
}

/**
 * Get a form by shortcut key number from a scheme.
 */
export function getFormByShortcutKey(
  scheme: Scheme,
  shortcutKey: number
): Form | undefined {
  return scheme.forms.find((f) => f.shortcutKey === shortcutKey);
}
