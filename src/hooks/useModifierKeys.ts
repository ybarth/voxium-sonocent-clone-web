import { useState, useEffect } from 'react';

export type ModifierMode =
  | 'navigate'    // default — no modifiers
  | 'select'      // Shift
  | 'command'     // Ctrl/Cmd
  | 'nudge'       // Alt/Option
  | 'selectAll'   // Ctrl+Shift
  | 'fineScrub'   // Alt+Shift
  | 'sectionMove'; // Ctrl+Alt

export const MODIFIER_MODE_META: Record<ModifierMode, { label: string; cursor: string; color: string }> = {
  navigate:    { label: 'Navigate',       cursor: 'text',       color: '#F59E0B' }, // amber
  select:      { label: 'Selection',      cursor: 'crosshair',  color: '#3B82F6' }, // blue
  command:     { label: 'Command',        cursor: 'pointer',    color: '#8B5CF6' }, // purple
  nudge:       { label: 'Nudge',          cursor: 'grab',       color: '#F97316' }, // orange
  selectAll:   { label: 'Select All',     cursor: 'cell',       color: '#3B82F6' }, // blue
  fineScrub:   { label: 'Fine Scrub',     cursor: 'col-resize', color: '#F59E0B' }, // amber
  sectionMove: { label: 'Section Move',   cursor: 'move',       color: '#F97316' }, // orange
};

function computeMode(shift: boolean, ctrl: boolean, alt: boolean): ModifierMode {
  if (ctrl && alt) return 'sectionMove';
  if (alt && shift) return 'fineScrub';
  if (ctrl && shift) return 'selectAll';
  if (alt) return 'nudge';
  if (ctrl) return 'command';
  if (shift) return 'select';
  return 'navigate';
}

export function useModifierKeys(): ModifierMode {
  const [mode, setMode] = useState<ModifierMode>('navigate');

  useEffect(() => {
    let shift = false;
    let ctrl = false;
    let alt = false;

    const update = () => {
      setMode(computeMode(shift, ctrl, alt));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      let changed = false;
      if (e.key === 'Shift' && !shift) { shift = true; changed = true; }
      if ((e.key === 'Control' || e.key === 'Meta') && !ctrl) { ctrl = true; changed = true; }
      if (e.key === 'Alt' && !alt) { alt = true; changed = true; }
      if (changed) update();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      let changed = false;
      if (e.key === 'Shift' && shift) { shift = false; changed = true; }
      if ((e.key === 'Control' || e.key === 'Meta') && ctrl) { ctrl = false; changed = true; }
      if (e.key === 'Alt' && alt) { alt = false; changed = true; }
      if (changed) update();
    };

    const handleBlur = () => {
      shift = false;
      ctrl = false;
      alt = false;
      update();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return mode;
}
