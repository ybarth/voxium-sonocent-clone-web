// Forms & Schemes type system
// Replaces the color-centric chunk attribute model with a richer multi-attribute system.

import type { TextureRef, GradientDef, SfxRef } from './index';

// ─── Attribute types ────────────────────────────────────────────────────────

export type AttributeType = 'color' | 'texture' | 'shape' | 'sound';

export interface ColorAttribute {
  hex: string;
  alpha: number;          // 0-1
  gradient?: GradientDef;
}

export interface TextureAttribute {
  textureRef: TextureRef;
}

export type BuiltinShapeId =
  | 'default'
  | 'sharp'
  | 'rounded'
  | 'tapered'
  | 'scalloped'
  | 'notched'
  | 'wave'
  | 'chevron';

export interface ShapeAttribute {
  builtinId: BuiltinShapeId;
  customClipPath?: string; // CSS clip-path value for custom shapes
}

export type SoundTrigger = 'start' | 'end' | 'both' | 'boundary';

export interface SoundAttribute {
  sfxRef: SfxRef;
  trigger: SoundTrigger;
  volume?: number; // 0-1, overrides sfxRef.volume
}

// ─── Form ───────────────────────────────────────────────────────────────────
// A Form is a named combination of attributes that can be applied to chunks.
// Replaces ColorKeyEntry as the primary chunk annotation unit.

export interface Form {
  id: string;
  label: string;
  shortcutKey: number;        // 1-20, 0 for no shortcut
  color?: ColorAttribute;
  texture?: TextureAttribute;
  shape?: ShapeAttribute;
  sound?: SoundAttribute;
}

// ─── Attribute Set ──────────────────────────────────────────────────────────
// A collection of attribute values for a single type, used for mix-and-match.

export interface AttributeSetItem {
  id: string;
  label: string;
  color?: ColorAttribute;
  texture?: TextureAttribute;
  shape?: ShapeAttribute;
  sound?: SoundAttribute;
}

export interface AttributeSet {
  id: string;
  name: string;
  builtIn: boolean;
  attributeType: AttributeType;
  items: AttributeSetItem[];
}

// ─── Scheme ─────────────────────────────────────────────────────────────────
// A Scheme is a collection of Forms applied to a project.
// Replaces ColorKeyTemplate.

export interface Scheme {
  id: string;
  name: string;
  builtIn: boolean;
  forms: Form[];
  sourceSetIds?: string[]; // IDs of attribute sets used to compose this scheme
}

// ─── Default Attributes ─────────────────────────────────────────────────────
// Fallback values for unset form slots.

export interface DefaultAttributes {
  color: ColorAttribute;
  texture?: TextureAttribute;
  shape: ShapeAttribute;
  sound?: SoundAttribute;
}

// ─── Resolved Form ──────────────────────────────────────────────────────────
// A form with all defaults merged in, ready for rendering.

export interface ResolvedForm {
  formId: string | null;
  label: string;
  color: ColorAttribute;
  texture: TextureAttribute | null;
  shape: ShapeAttribute;
  sound: SoundAttribute | null;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULT_FORM_ATTRIBUTES: DefaultAttributes = {
  color: { hex: '#D1D5DB', alpha: 1 },
  shape: { builtinId: 'default' },
};

// ─── Section Forms & Schemes ────────────────────────────────────────────────
// Separate from chunk Forms — only color + texture attributes (no shape/sound).

export interface SectionForm {
  id: string;
  label: string;
  shortcutKey: number;        // 1-9, 0 for no shortcut
  color?: ColorAttribute;
  texture?: TextureAttribute;
}

export interface SectionScheme {
  id: string;
  name: string;
  builtIn: boolean;
  forms: SectionForm[];
}

export interface ResolvedSectionForm {
  formId: string | null;
  label: string;
  color: ColorAttribute;
  texture: TextureAttribute | null;
}
