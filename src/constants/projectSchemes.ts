// Built-in project schemes — pre-linked chunk scheme + section scheme pairs.
// Uses stable IDs from existing built-in schemes.

import type { ProjectScheme } from '../types/scheme';

export const STANDARD_PROJECT_SCHEME: ProjectScheme = {
  id: 'project-scheme-standard',
  name: 'Standard',
  builtIn: true,
  chunkSchemeId: 'scheme-standard',
  sectionSchemeId: 'section-scheme-standard',
};

export const BUILTIN_PROJECT_SCHEMES: ProjectScheme[] = [
  STANDARD_PROJECT_SCHEME,
  {
    id: 'project-scheme-lecture-vivid',
    name: 'Lecture + Vivid',
    builtIn: true,
    chunkSchemeId: 'scheme-tpl-lecture',       // migrated Lecture template
    sectionSchemeId: 'section-scheme-vivid',
  },
  {
    id: 'project-scheme-accessibility-vivid',
    name: 'Accessibility + Vivid',
    builtIn: true,
    chunkSchemeId: 'scheme-accessibility',
    sectionSchemeId: 'section-scheme-vivid',
  },
  {
    id: 'project-scheme-musical-warm',
    name: 'Musical + Warm',
    builtIn: true,
    chunkSchemeId: 'scheme-musical',
    sectionSchemeId: 'section-scheme-warm',
  },
];

export const ALL_BUILTIN_PROJECT_SCHEMES: ProjectScheme[] = BUILTIN_PROJECT_SCHEMES;
