// Built-in schemes — migrated from templates + new shape/sound-aware schemes
import type { Scheme, Form } from '../types/scheme';
import { BUILTIN_TEMPLATES } from './templates';
import { migrateTemplateToScheme } from '../utils/schemeMigration';

// Migrate existing 4 templates to Scheme format
export const BUILTIN_SCHEMES: Scheme[] = BUILTIN_TEMPLATES.map(migrateTemplateToScheme);

// Additional built-in scheme: Accessibility (shape-differentiated)
const accessibilityForms: Form[] = [
  { id: 'acc-1', label: 'Primary', shortcutKey: 1, color: { hex: '#3B82F6', alpha: 1 }, shape: { builtinId: 'default' } },
  { id: 'acc-2', label: 'Important', shortcutKey: 2, color: { hex: '#EF4444', alpha: 1 }, shape: { builtinId: 'sharp' } },
  { id: 'acc-3', label: 'Question', shortcutKey: 3, color: { hex: '#EAB308', alpha: 1 }, shape: { builtinId: 'rounded' } },
  { id: 'acc-4', label: 'Reference', shortcutKey: 4, color: { hex: '#22C55E', alpha: 1 }, shape: { builtinId: 'chevron' } },
  { id: 'acc-5', label: 'Example', shortcutKey: 5, color: { hex: '#8B5CF6', alpha: 1 }, shape: { builtinId: 'tapered' } },
  { id: 'acc-6', label: 'Note', shortcutKey: 6, color: { hex: '#06B6D4', alpha: 1 }, shape: { builtinId: 'notched' } },
  { id: 'acc-7', label: 'Action', shortcutKey: 7, color: { hex: '#F97316', alpha: 1 }, shape: { builtinId: 'scalloped' } },
  { id: 'acc-8', label: 'Review', shortcutKey: 8, color: { hex: '#EC4899', alpha: 1 }, shape: { builtinId: 'wave' } },
  { id: 'acc-9', label: 'Skip', shortcutKey: 9, color: { hex: '#6B7280', alpha: 1 }, shape: { builtinId: 'default' } },
];

export const ACCESSIBILITY_SCHEME: Scheme = {
  id: 'scheme-accessibility',
  name: 'Accessibility',
  builtIn: true,
  forms: accessibilityForms,
};

// Additional built-in scheme: Musical (sound-focused)
const musicalForms: Form[] = [
  { id: 'mus-1', label: 'Melody', shortcutKey: 1, color: { hex: '#3B82F6', alpha: 1 }, sound: { sfxRef: { type: 'builtin', builtinId: 'chime-gentle', volume: 0.4 }, trigger: 'start' } },
  { id: 'mus-2', label: 'Rhythm', shortcutKey: 2, color: { hex: '#EF4444', alpha: 1 }, sound: { sfxRef: { type: 'builtin', builtinId: 'perc-tap', volume: 0.5 }, trigger: 'start' } },
  { id: 'mus-3', label: 'Harmony', shortcutKey: 3, color: { hex: '#22C55E', alpha: 1 }, sound: { sfxRef: { type: 'builtin', builtinId: 'chime-bright', volume: 0.4 }, trigger: 'start' } },
  { id: 'mus-4', label: 'Bass', shortcutKey: 4, color: { hex: '#8B5CF6', alpha: 1 }, sound: { sfxRef: { type: 'builtin', builtinId: 'tone-low', volume: 0.4 }, trigger: 'start' } },
  { id: 'mus-5', label: 'Accent', shortcutKey: 5, color: { hex: '#F97316', alpha: 1 }, sound: { sfxRef: { type: 'builtin', builtinId: 'click-pop', volume: 0.5 }, trigger: 'boundary' } },
  { id: 'mus-6', label: 'Transition', shortcutKey: 6, color: { hex: '#06B6D4', alpha: 1 }, sound: { sfxRef: { type: 'builtin', builtinId: 'trans-swoop-up', volume: 0.4 }, trigger: 'start' } },
  { id: 'mus-7', label: 'Silence', shortcutKey: 7, color: { hex: '#6B7280', alpha: 1 }, sound: { sfxRef: { type: 'builtin', builtinId: 'silence-100', volume: 0 }, trigger: 'start' } },
];

export const MUSICAL_SCHEME: Scheme = {
  id: 'scheme-musical',
  name: 'Musical',
  builtIn: true,
  forms: musicalForms,
};

// Additional built-in scheme: Standard (generic multi-attribute)
const standardForms: Form[] = [
  { id: 'std-1', label: 'Color 1', shortcutKey: 1, color: { hex: '#EF4444', alpha: 1 }, shape: { builtinId: 'default' }, sound: { sfxRef: { type: 'builtin', builtinId: 'click-soft', volume: 0.4 }, trigger: 'start' } },
  { id: 'std-2', label: 'Color 2', shortcutKey: 2, color: { hex: '#F97316', alpha: 1 }, shape: { builtinId: 'sharp' }, sound: { sfxRef: { type: 'builtin', builtinId: 'tone-mid', volume: 0.4 }, trigger: 'start' } },
  { id: 'std-3', label: 'Color 3', shortcutKey: 3, color: { hex: '#EAB308', alpha: 1 }, shape: { builtinId: 'rounded' }, sound: { sfxRef: { type: 'builtin', builtinId: 'chime-gentle', volume: 0.4 }, trigger: 'start' } },
  { id: 'std-4', label: 'Color 4', shortcutKey: 4, color: { hex: '#22C55E', alpha: 1 }, shape: { builtinId: 'tapered' }, sound: { sfxRef: { type: 'builtin', builtinId: 'perc-tap', volume: 0.4 }, trigger: 'start' } },
  { id: 'std-5', label: 'Color 5', shortcutKey: 5, color: { hex: '#3B82F6', alpha: 1 }, shape: { builtinId: 'chevron' }, sound: { sfxRef: { type: 'builtin', builtinId: 'beep-standard', volume: 0.4 }, trigger: 'start' } },
  { id: 'std-6', label: 'Color 6', shortcutKey: 6, color: { hex: '#8B5CF6', alpha: 1 }, shape: { builtinId: 'notched' }, sound: { sfxRef: { type: 'builtin', builtinId: 'tone-warm', volume: 0.4 }, trigger: 'start' } },
  { id: 'std-7', label: 'Color 7', shortcutKey: 7, color: { hex: '#EC4899', alpha: 1 }, shape: { builtinId: 'scalloped' }, sound: { sfxRef: { type: 'builtin', builtinId: 'click-pop', volume: 0.4 }, trigger: 'start' } },
  { id: 'std-8', label: 'Color 8', shortcutKey: 8, color: { hex: '#06B6D4', alpha: 1 }, shape: { builtinId: 'wave' }, sound: { sfxRef: { type: 'builtin', builtinId: 'trans-swoop-up', volume: 0.4 }, trigger: 'start' } },
  { id: 'std-9', label: 'Color 9', shortcutKey: 9, color: { hex: '#6B7280', alpha: 1 }, shape: { builtinId: 'default' }, sound: { sfxRef: { type: 'builtin', builtinId: 'click-bubble', volume: 0.4 }, trigger: 'start' } },
];

export const STANDARD_SCHEME: Scheme = {
  id: 'scheme-standard',
  name: 'Standard',
  builtIn: true,
  forms: standardForms,
};

// All built-in schemes
export const ALL_BUILTIN_SCHEMES: Scheme[] = [
  STANDARD_SCHEME,
  ...BUILTIN_SCHEMES,
  ACCESSIBILITY_SCHEME,
  MUSICAL_SCHEME,
];
