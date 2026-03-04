// Built-in section schemes — high-saturation colors for section annotation.
// Subsections auto-inherit parent color at 10% lower saturation per depth level.

import type { SectionScheme, SectionForm } from '../types/scheme';

// ─── Vivid Sections (6 forms) ────────────────────────────────────────────────

const vividForms: SectionForm[] = [
  { id: 'sec-vivid-1', label: 'Blue',   shortcutKey: 1, color: { hex: '#2563EB', alpha: 1 } },   // H=220 S=84% L=53%
  { id: 'sec-vivid-2', label: 'Red',    shortcutKey: 2, color: { hex: '#DC2626', alpha: 1 } },   // H=0   S=84% L=50%
  { id: 'sec-vivid-3', label: 'Green',  shortcutKey: 3, color: { hex: '#16A34A', alpha: 1 } },   // H=142 S=75% L=36%
  { id: 'sec-vivid-4', label: 'Purple', shortcutKey: 4, color: { hex: '#9333EA', alpha: 1 } },   // H=271 S=82% L=56%
  { id: 'sec-vivid-5', label: 'Orange', shortcutKey: 5, color: { hex: '#EA580C', alpha: 1 } },   // H=21  S=88% L=48%
  { id: 'sec-vivid-6', label: 'Cyan',   shortcutKey: 6, color: { hex: '#06B6D4', alpha: 1 } },   // H=189 S=93% L=43%
];

export const VIVID_SECTION_SCHEME: SectionScheme = {
  id: 'section-scheme-vivid',
  name: 'Vivid Sections',
  builtIn: true,
  forms: vividForms,
};

// ─── Warm Sections (5 forms) ─────────────────────────────────────────────────

const warmForms: SectionForm[] = [
  { id: 'sec-warm-1', label: 'Fire',   shortcutKey: 1, color: { hex: '#DC2626', alpha: 1 } },   // S=84%
  { id: 'sec-warm-2', label: 'Amber',  shortcutKey: 2, color: { hex: '#D97706', alpha: 1 } },   // S=90%
  { id: 'sec-warm-3', label: 'Rose',   shortcutKey: 3, color: { hex: '#E11D48', alpha: 1 } },   // S=81%
  { id: 'sec-warm-4', label: 'Orange', shortcutKey: 4, color: { hex: '#EA580C', alpha: 1 } },   // S=88%
  { id: 'sec-warm-5', label: 'Coral',  shortcutKey: 5, color: { hex: '#E04545', alpha: 1 } },   // S=75%
];

export const WARM_SECTION_SCHEME: SectionScheme = {
  id: 'section-scheme-warm',
  name: 'Warm Sections',
  builtIn: true,
  forms: warmForms,
};

// ─── Cool Sections (5 forms) ─────────────────────────────────────────────────

const coolForms: SectionForm[] = [
  { id: 'sec-cool-1', label: 'Ocean',  shortcutKey: 1, color: { hex: '#2563EB', alpha: 1 } },   // S=84%
  { id: 'sec-cool-2', label: 'Teal',   shortcutKey: 2, color: { hex: '#0D9488', alpha: 1 } },   // S=83%
  { id: 'sec-cool-3', label: 'Indigo', shortcutKey: 3, color: { hex: '#6366F1', alpha: 1 } },   // S=85%
  { id: 'sec-cool-4', label: 'Cyan',   shortcutKey: 4, color: { hex: '#06B6D4', alpha: 1 } },   // S=93%
  { id: 'sec-cool-5', label: 'Violet', shortcutKey: 5, color: { hex: '#8B5CF6', alpha: 1 } },   // S=91%
];

export const COOL_SECTION_SCHEME: SectionScheme = {
  id: 'section-scheme-cool',
  name: 'Cool Sections',
  builtIn: true,
  forms: coolForms,
};

// ─── Standard Sections (6 forms) ─────────────────────────────────────────────

const standardForms: SectionForm[] = [
  { id: 'sec-std-1', label: 'Section 1', shortcutKey: 1, color: { hex: '#2563EB', alpha: 1 } },
  { id: 'sec-std-2', label: 'Section 2', shortcutKey: 2, color: { hex: '#DC2626', alpha: 1 } },
  { id: 'sec-std-3', label: 'Section 3', shortcutKey: 3, color: { hex: '#16A34A', alpha: 1 } },
  { id: 'sec-std-4', label: 'Section 4', shortcutKey: 4, color: { hex: '#9333EA', alpha: 1 } },
  { id: 'sec-std-5', label: 'Section 5', shortcutKey: 5, color: { hex: '#EA580C', alpha: 1 } },
  { id: 'sec-std-6', label: 'Section 6', shortcutKey: 6, color: { hex: '#06B6D4', alpha: 1 } },
];

export const STANDARD_SECTION_SCHEME: SectionScheme = {
  id: 'section-scheme-standard',
  name: 'Standard Sections',
  builtIn: true,
  forms: standardForms,
};

// All built-in section schemes
export const ALL_BUILTIN_SECTION_SCHEMES: SectionScheme[] = [
  STANDARD_SECTION_SCHEME,
  VIVID_SECTION_SCHEME,
  WARM_SECTION_SCHEME,
  COOL_SECTION_SCHEME,
];
