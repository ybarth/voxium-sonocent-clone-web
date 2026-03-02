// Built-in color key templates for common use cases
import type { ColorKeyTemplate, ColorKeyEntry, SfxMapping } from '../types';
import { LECTURE_SFX, INTERVIEW_SFX, MEETING_SFX, RESEARCH_SFX } from './templateSfxMappings';

const lectureColors: ColorKeyEntry[] = [
  { hex: '#EF4444', label: 'Key Point', shortcutKey: 1, style: null },
  { hex: '#F97316', label: 'Example', shortcutKey: 2, style: null },
  { hex: '#EAB308', label: 'Question', shortcutKey: 3, style: null },
  { hex: '#3B82F6', label: 'Definition', shortcutKey: 4, style: null },
  { hex: '#22C55E', label: 'Summary', shortcutKey: 5, style: null },
  { hex: '#8B5CF6', label: 'Review', shortcutKey: 6, style: null },
  { hex: '#EC4899', label: 'Action', shortcutKey: 7, style: null },
  { hex: '#6B7280', label: 'Skip', shortcutKey: 8, style: null },
  { hex: '#06B6D4', label: 'Aside', shortcutKey: 9, style: null },
];

const interviewColors: ColorKeyEntry[] = [
  { hex: '#3B82F6', label: 'Speaker A', shortcutKey: 1, style: null },
  { hex: '#22C55E', label: 'Speaker B', shortcutKey: 2, style: null },
  { hex: '#F97316', label: 'Follow-up', shortcutKey: 3, style: null },
  { hex: '#EAB308', label: 'Notable Quote', shortcutKey: 4, style: null },
  { hex: '#6B7280', label: 'Off-topic', shortcutKey: 5, style: null },
  { hex: '#8B5CF6', label: 'Insight', shortcutKey: 6, style: null },
  { hex: '#EF4444', label: 'Correction', shortcutKey: 7, style: null },
  { hex: '#EC4899', label: 'Emotion', shortcutKey: 8, style: null },
  { hex: '#06B6D4', label: 'Context', shortcutKey: 9, style: null },
];

const meetingColors: ColorKeyEntry[] = [
  { hex: '#EF4444', label: 'Decision', shortcutKey: 1, style: null },
  { hex: '#F97316', label: 'Action Item', shortcutKey: 2, style: null },
  { hex: '#3B82F6', label: 'Discussion', shortcutKey: 3, style: null },
  { hex: '#EAB308', label: 'Parking Lot', shortcutKey: 4, style: null },
  { hex: '#22C55E', label: 'Agreement', shortcutKey: 5, style: null },
  { hex: '#6B7280', label: 'FYI', shortcutKey: 6, style: null },
  { hex: '#8B5CF6', label: 'Risk', shortcutKey: 7, style: null },
  { hex: '#EC4899', label: 'Deadline', shortcutKey: 8, style: null },
  { hex: '#06B6D4', label: 'Follow-up', shortcutKey: 9, style: null },
];

const researchColors: ColorKeyEntry[] = [
  { hex: '#3B82F6', label: 'Source', shortcutKey: 1, style: null },
  { hex: '#EAB308', label: 'Hypothesis', shortcutKey: 2, style: null },
  { hex: '#22C55E', label: 'Evidence', shortcutKey: 3, style: null },
  { hex: '#EF4444', label: 'Contradiction', shortcutKey: 4, style: null },
  { hex: '#8B5CF6', label: 'Methodology', shortcutKey: 5, style: null },
  { hex: '#6B7280', label: 'Note', shortcutKey: 6, style: null },
  { hex: '#F97316', label: 'Comparison', shortcutKey: 7, style: null },
  { hex: '#EC4899', label: 'Conclusion', shortcutKey: 8, style: null },
  { hex: '#06B6D4', label: 'Reference', shortcutKey: 9, style: null },
];

export const BUILTIN_TEMPLATES: ColorKeyTemplate[] = [
  {
    id: 'tpl-lecture',
    name: 'Lecture',
    builtIn: true,
    colorKey: lectureColors,
    styles: {},
    sfxMappings: LECTURE_SFX,
  },
  {
    id: 'tpl-interview',
    name: 'Interview',
    builtIn: true,
    colorKey: interviewColors,
    styles: {},
    sfxMappings: INTERVIEW_SFX,
  },
  {
    id: 'tpl-meeting',
    name: 'Meeting',
    builtIn: true,
    colorKey: meetingColors,
    styles: {},
    sfxMappings: MEETING_SFX,
  },
  {
    id: 'tpl-research',
    name: 'Research',
    builtIn: true,
    colorKey: researchColors,
    styles: {},
    sfxMappings: RESEARCH_SFX,
  },
];
