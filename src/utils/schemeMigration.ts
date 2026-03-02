// Migration utilities: convert legacy ColorKey/Templates to Forms & Schemes
import { v4 as uuid } from 'uuid';
import type { ColorKeyEntry, ChunkStyle, SfxMapping, Chunk } from '../types';
import type { Scheme, Form, ColorAttribute, SoundAttribute } from '../types/scheme';

/**
 * Migrate a ColorKey + styles + SFX mappings into a Scheme.
 */
export function migrateColorKeyToScheme(
  colorKeyColors: ColorKeyEntry[],
  styles: Record<string, ChunkStyle>,
  sfxMappings: SfxMapping[],
  schemeName = 'Default'
): Scheme {
  const forms: Form[] = colorKeyColors.map((entry) => {
    const style = styles[entry.hex] ?? entry.style;

    const color: ColorAttribute = {
      hex: style?.color ?? entry.hex,
      alpha: style?.alpha ?? 1,
      gradient: style?.gradient ?? undefined,
    };

    // Map SFX mappings for this color
    const sfx = sfxMappings.find(
      (m) => m.matchType === 'color' && m.colorHex === entry.hex
    );
    const sound: SoundAttribute | undefined = sfx
      ? {
          sfxRef: sfx.sfxRef,
          trigger: sfx.position === 'both' ? 'both' : sfx.position,
          volume: sfx.sfxRef.volume,
        }
      : undefined;

    const form: Form = {
      id: uuid(),
      label: entry.label,
      shortcutKey: entry.shortcutKey,
      color,
      texture: style?.texture ? { textureRef: style.texture } : undefined,
      shape: undefined, // No shape data in legacy
      sound,
    };

    return form;
  });

  return {
    id: uuid(),
    name: schemeName,
    builtIn: false,
    forms,
  };
}

/**
 * Migrate a ColorKeyTemplate to a Scheme.
 */
export function migrateTemplateToScheme(template: {
  id: string;
  name: string;
  builtIn: boolean;
  colorKey: ColorKeyEntry[];
  styles: Record<string, ChunkStyle>;
  sfxMappings: SfxMapping[];
}): Scheme {
  const scheme = migrateColorKeyToScheme(
    template.colorKey,
    template.styles,
    template.sfxMappings,
    template.name
  );
  return {
    ...scheme,
    id: `scheme-${template.id}`,
    builtIn: template.builtIn,
  };
}

/**
 * Attempt to resolve a formId from legacy chunk color data.
 * Returns the form ID if a matching form is found in the scheme.
 */
export function resolveFormIdFromLegacy(
  chunk: Chunk,
  scheme: Scheme
): string | null {
  const chunkColor = chunk.style?.color ?? chunk.color;
  if (!chunkColor) return null;

  const matchingForm = scheme.forms.find(
    (f) => f.color?.hex === chunkColor
  );
  return matchingForm?.id ?? null;
}
