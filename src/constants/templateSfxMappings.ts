// SFX mapping arrays for built-in templates
// Each maps template colors to pre-generated MP3 files in public/sfx/
import type { SfxMapping } from '../types';

function colorSfx(templateId: string, colorHex: string, fileName: string): SfxMapping {
  return {
    id: `${templateId}-sfx-${fileName}`,
    matchType: 'color',
    colorHex,
    position: 'start',
    sfxRef: { type: 'custom', audioUrl: `/sfx/${templateId}/${fileName}.mp3`, volume: 0.5 },
  };
}

// ─── Lecture ─────────────────────────────────────────────────────────────────

export const LECTURE_SFX: SfxMapping[] = [
  colorSfx('tpl-lecture', '#EF4444', 'key-point'),
  colorSfx('tpl-lecture', '#F97316', 'example'),
  colorSfx('tpl-lecture', '#EAB308', 'question'),
  colorSfx('tpl-lecture', '#3B82F6', 'definition'),
  colorSfx('tpl-lecture', '#22C55E', 'summary'),
  colorSfx('tpl-lecture', '#8B5CF6', 'review'),
  colorSfx('tpl-lecture', '#EC4899', 'action'),
  colorSfx('tpl-lecture', '#6B7280', 'skip'),
  colorSfx('tpl-lecture', '#06B6D4', 'aside'),
];

// ─── Interview ──────────────────────────────────────────────────────────────

export const INTERVIEW_SFX: SfxMapping[] = [
  colorSfx('tpl-interview', '#3B82F6', 'speaker-a'),
  colorSfx('tpl-interview', '#22C55E', 'speaker-b'),
  colorSfx('tpl-interview', '#F97316', 'follow-up'),
  colorSfx('tpl-interview', '#EAB308', 'notable-quote'),
  colorSfx('tpl-interview', '#6B7280', 'off-topic'),
  colorSfx('tpl-interview', '#8B5CF6', 'insight'),
  colorSfx('tpl-interview', '#EF4444', 'correction'),
  colorSfx('tpl-interview', '#EC4899', 'emotion'),
  colorSfx('tpl-interview', '#06B6D4', 'context'),
];

// ─── Meeting ────────────────────────────────────────────────────────────────

export const MEETING_SFX: SfxMapping[] = [
  colorSfx('tpl-meeting', '#EF4444', 'decision'),
  colorSfx('tpl-meeting', '#F97316', 'action-item'),
  colorSfx('tpl-meeting', '#3B82F6', 'discussion'),
  colorSfx('tpl-meeting', '#EAB308', 'parking-lot'),
  colorSfx('tpl-meeting', '#22C55E', 'agreement'),
  colorSfx('tpl-meeting', '#6B7280', 'fyi'),
  colorSfx('tpl-meeting', '#8B5CF6', 'risk'),
  colorSfx('tpl-meeting', '#EC4899', 'deadline'),
  colorSfx('tpl-meeting', '#06B6D4', 'follow-up'),
];

// ─── Research ───────────────────────────────────────────────────────────────

export const RESEARCH_SFX: SfxMapping[] = [
  colorSfx('tpl-research', '#3B82F6', 'source'),
  colorSfx('tpl-research', '#EAB308', 'hypothesis'),
  colorSfx('tpl-research', '#22C55E', 'evidence'),
  colorSfx('tpl-research', '#EF4444', 'contradiction'),
  colorSfx('tpl-research', '#8B5CF6', 'methodology'),
  colorSfx('tpl-research', '#6B7280', 'note'),
  colorSfx('tpl-research', '#F97316', 'comparison'),
  colorSfx('tpl-research', '#EC4899', 'conclusion'),
  colorSfx('tpl-research', '#06B6D4', 'reference'),
];
