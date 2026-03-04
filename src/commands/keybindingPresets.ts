// DAW-inspired keybinding presets.
// Key descriptor format: "Modifier+Key" with modifiers in order: Alt > Ctrl > Shift > Key
// "Ctrl" is automatically mapped to Cmd on macOS at runtime.

export type KeyDescriptor = string;
export type KeybindingMap = Record<string, KeyDescriptor>;

export type PresetId = 'ableton' | 'protools' | 'logic-cubase' | 'reaper' | 'custom';

export const PRESET_LABELS: Record<PresetId, string> = {
  ableton: 'Ableton',
  protools: 'Pro Tools',
  'logic-cubase': 'Logic / Cubase',
  reaper: 'Reaper',
  custom: 'Custom',
};

// ---------------------------------------------------------------------------
// Ableton — arrows navigate chunks, minimal modifiers
// ---------------------------------------------------------------------------
export const ABLETON_PRESET: KeybindingMap = {
  // Navigation
  'chunk.prev':           'ArrowLeft',
  'chunk.next':           'ArrowRight',
  'chunk.first':          'Home',
  'chunk.last':           'End',
  'chunk.firstInSection': 'Ctrl+Home',
  'chunk.lastInSection':  'Ctrl+End',

  // Selection
  'selection.extendPrev':   'Shift+ArrowLeft',
  'selection.extendNext':   'Shift+ArrowRight',
  'selection.all':          'Ctrl+Shift+A',
  'selection.allInSection': 'Ctrl+A',
  'selection.clear':        'Escape',
  'selection.invert':       'Ctrl+I',

  // Section
  'section.prev':            'Ctrl+ArrowLeft',
  'section.next':            'Ctrl+ArrowRight',
  'section.toggleCollapse':  'Ctrl+Shift+C',

  // Editing
  'edit.split':         'Ctrl+T',
  'edit.merge':         'M',
  'edit.mergeSections': 'Shift+M',
  'edit.delete':        'Delete',
  'edit.duplicate':     'Ctrl+D',

  // Nudge
  'nudge.left':           'Alt+ArrowLeft',
  'nudge.right':          'Alt+ArrowRight',
  'nudge.toSectionStart': 'Alt+Home',
  'nudge.toSectionEnd':   'Alt+End',
  'nudge.toPrevSection':  'Alt+ArrowUp',
  'nudge.toNextSection':  'Alt+ArrowDown',

  // Cursor (intra-chunk)
  'cursor.scrubLeft':      'ArrowDown',
  'cursor.scrubRight':     'ArrowUp',
  'cursor.scrubLeftFine':  'Shift+ArrowDown',
  'cursor.scrubRightFine': 'Shift+ArrowUp',
  'cursor.toChunkStart':   'Alt+Shift+ArrowLeft',
  'cursor.toChunkEnd':     'Alt+Shift+ArrowRight',

  // Transport
  'transport.togglePlay': 'Space',
  'transport.stop':       'Ctrl+Space',

  // View
  'view.zoomIn':           'Ctrl+=',
  'view.zoomOut':          'Ctrl+-',
  'view.zoomReset':        'Ctrl+0',
  'view.toggleVisualMode': 'Ctrl+Shift+W',

  // History
  'history.undo': 'Ctrl+Z',
  'history.redo': 'Ctrl+Shift+Z',

  // Color
  'color.apply1': '1', 'color.apply2': '2', 'color.apply3': '3',
  'color.apply4': '4', 'color.apply5': '5', 'color.apply6': '6',
  'color.apply7': '7', 'color.apply8': '8', 'color.apply9': '9',
  'color.clear':  '0',

  // Clipboard
  'edit.cut':  'Ctrl+X',
  'edit.copy': 'Ctrl+C',
  'edit.paste': 'Ctrl+V',

  // Settings
  'app.openSettings': 'Ctrl+,',
};

// ---------------------------------------------------------------------------
// Pro Tools — Tab-to-transient, arrows scrub, timeline-focused
// ---------------------------------------------------------------------------
export const PROTOOLS_PRESET: KeybindingMap = {
  // Navigation — Tab for "transient" (chunk boundary)
  'chunk.prev':           'Shift+Tab',
  'chunk.next':           'Tab',
  'chunk.first':          'Home',
  'chunk.last':           'End',
  'chunk.firstInSection': 'Ctrl+Home',
  'chunk.lastInSection':  'Ctrl+End',

  // Selection
  'selection.extendPrev':   'Shift+ArrowLeft',
  'selection.extendNext':   'Shift+ArrowRight',
  'selection.all':          'Ctrl+Shift+A',
  'selection.allInSection': 'Ctrl+A',
  'selection.clear':        'Escape',
  'selection.invert':       'Ctrl+I',

  // Section — comma/period for markers
  'section.prev':            ',',
  'section.next':            '.',
  'section.toggleCollapse':  'Ctrl+Shift+C',

  // Editing — Cmd+E for separate region
  'edit.split':         'Ctrl+E',
  'edit.merge':         'Ctrl+Shift+H',
  'edit.mergeSections': 'Shift+M',
  'edit.delete':        'Delete',
  'edit.duplicate':     'Ctrl+D',

  // Nudge — Option+Arrow
  'nudge.left':           'Alt+ArrowLeft',
  'nudge.right':          'Alt+ArrowRight',
  'nudge.toSectionStart': 'Alt+Home',
  'nudge.toSectionEnd':   'Alt+End',
  'nudge.toPrevSection':  'Alt+ArrowUp',
  'nudge.toNextSection':  'Alt+ArrowDown',

  // Cursor — arrows scrub
  'cursor.scrubLeft':      'ArrowLeft',
  'cursor.scrubRight':     'ArrowRight',
  'cursor.scrubLeftFine':  'Ctrl+ArrowLeft',
  'cursor.scrubRightFine': 'Ctrl+ArrowRight',
  'cursor.toChunkStart':   'ArrowUp',
  'cursor.toChunkEnd':     'ArrowDown',

  // Transport
  'transport.togglePlay': 'Space',
  'transport.stop':       'Enter',

  // View
  'view.zoomIn':           'Ctrl+=',
  'view.zoomOut':          'Ctrl+-',
  'view.zoomReset':        'Ctrl+0',
  'view.toggleVisualMode': 'Ctrl+Shift+W',

  // History
  'history.undo': 'Ctrl+Z',
  'history.redo': 'Ctrl+Shift+Z',

  // Color
  'color.apply1': '1', 'color.apply2': '2', 'color.apply3': '3',
  'color.apply4': '4', 'color.apply5': '5', 'color.apply6': '6',
  'color.apply7': '7', 'color.apply8': '8', 'color.apply9': '9',
  'color.clear':  '0',

  // Clipboard
  'edit.cut':  'Ctrl+X',
  'edit.copy': 'Ctrl+C',
  'edit.paste': 'Ctrl+V',

  // Settings
  'app.openSettings': 'Ctrl+,',
};

// ---------------------------------------------------------------------------
// Logic / Cubase — event-focused, comprehensive modifiers
// ---------------------------------------------------------------------------
export const LOGIC_CUBASE_PRESET: KeybindingMap = {
  // Navigation
  'chunk.prev':           'ArrowLeft',
  'chunk.next':           'ArrowRight',
  'chunk.first':          'Home',
  'chunk.last':           'End',
  'chunk.firstInSection': 'Ctrl+Home',
  'chunk.lastInSection':  'Ctrl+End',

  // Selection
  'selection.extendPrev':   'Shift+ArrowLeft',
  'selection.extendNext':   'Shift+ArrowRight',
  'selection.all':          'Ctrl+A',
  'selection.allInSection': 'Ctrl+Shift+A',
  'selection.clear':        'Escape',
  'selection.invert':       'Ctrl+I',

  // Section
  'section.prev':            'Alt+ArrowUp',
  'section.next':            'Alt+ArrowDown',
  'section.toggleCollapse':  'Ctrl+Shift+C',

  // Editing — Cmd+J for join
  'edit.split':         'Ctrl+T',
  'edit.merge':         'Ctrl+J',
  'edit.mergeSections': 'Shift+M',
  'edit.delete':        'Backspace',
  'edit.duplicate':     'Ctrl+D',

  // Nudge — Alt+Arrow for left/right, Ctrl+Alt for section move
  'nudge.left':           'Alt+ArrowLeft',
  'nudge.right':          'Alt+ArrowRight',
  'nudge.toSectionStart': 'Alt+Shift+ArrowLeft',
  'nudge.toSectionEnd':   'Alt+Shift+ArrowRight',
  'nudge.toPrevSection':  'Alt+Ctrl+ArrowUp',
  'nudge.toNextSection':  'Alt+Ctrl+ArrowDown',

  // Cursor
  'cursor.scrubLeft':      'ArrowDown',
  'cursor.scrubRight':     'ArrowUp',
  'cursor.scrubLeftFine':  'Ctrl+ArrowDown',
  'cursor.scrubRightFine': 'Ctrl+ArrowUp',
  'cursor.toChunkStart':   'Shift+Home',
  'cursor.toChunkEnd':     'Shift+End',

  // Transport
  'transport.togglePlay': 'Space',
  'transport.stop':       'Ctrl+Space',

  // View
  'view.zoomIn':           'Ctrl+=',
  'view.zoomOut':          'Ctrl+-',
  'view.zoomReset':        'Ctrl+0',
  'view.toggleVisualMode': 'Ctrl+Shift+W',

  // History — Ctrl+Y for redo (Cubase-style)
  'history.undo': 'Ctrl+Z',
  'history.redo': 'Ctrl+Y',

  // Color
  'color.apply1': '1', 'color.apply2': '2', 'color.apply3': '3',
  'color.apply4': '4', 'color.apply5': '5', 'color.apply6': '6',
  'color.apply7': '7', 'color.apply8': '8', 'color.apply9': '9',
  'color.clear':  '0',

  // Clipboard
  'edit.cut':  'Ctrl+X',
  'edit.copy': 'Ctrl+C',
  'edit.paste': 'Ctrl+V',

  // Settings
  'app.openSettings': 'Ctrl+,',
};

// ---------------------------------------------------------------------------
// Reaper — single-letter, action-based
// ---------------------------------------------------------------------------
export const REAPER_PRESET: KeybindingMap = {
  // Navigation — J/K for item nav
  'chunk.prev':           'J',
  'chunk.next':           'K',
  'chunk.first':          'Home',
  'chunk.last':           'End',
  'chunk.firstInSection': 'Ctrl+Home',
  'chunk.lastInSection':  'Ctrl+End',

  // Selection
  'selection.extendPrev':   'Shift+J',
  'selection.extendNext':   'Shift+K',
  'selection.all':          'Ctrl+A',
  'selection.allInSection': 'Ctrl+Shift+A',
  'selection.clear':        'Escape',
  'selection.invert':       'Ctrl+I',

  // Section — arrow up/down for tracks
  'section.prev':            'ArrowUp',
  'section.next':            'ArrowDown',
  'section.toggleCollapse':  'Ctrl+Shift+C',

  // Editing — S for split, Ctrl+G for glue
  'edit.split':         'S',
  'edit.merge':         'Ctrl+G',
  'edit.mergeSections': 'Shift+M',
  'edit.delete':        'Delete',
  'edit.duplicate':     'Ctrl+D',

  // Nudge — Alt+Arrow
  'nudge.left':           'Alt+ArrowLeft',
  'nudge.right':          'Alt+ArrowRight',
  'nudge.toSectionStart': 'Alt+Home',
  'nudge.toSectionEnd':   'Alt+End',
  'nudge.toPrevSection':  'Alt+ArrowUp',
  'nudge.toNextSection':  'Alt+ArrowDown',

  // Cursor — arrows for timeline
  'cursor.scrubLeft':      'ArrowLeft',
  'cursor.scrubRight':     'ArrowRight',
  'cursor.scrubLeftFine':  'Ctrl+ArrowLeft',
  'cursor.scrubRightFine': 'Ctrl+ArrowRight',
  'cursor.toChunkStart':   '[',
  'cursor.toChunkEnd':     ']',

  // Transport
  'transport.togglePlay': 'Space',
  'transport.stop':       'Ctrl+Space',

  // View
  'view.zoomIn':           'Ctrl+=',
  'view.zoomOut':          'Ctrl+-',
  'view.zoomReset':        'Ctrl+0',
  'view.toggleVisualMode': 'Ctrl+Shift+W',

  // History
  'history.undo': 'Ctrl+Z',
  'history.redo': 'Ctrl+Shift+Z',

  // Color
  'color.apply1': '1', 'color.apply2': '2', 'color.apply3': '3',
  'color.apply4': '4', 'color.apply5': '5', 'color.apply6': '6',
  'color.apply7': '7', 'color.apply8': '8', 'color.apply9': '9',
  'color.clear':  '0',

  // Clipboard
  'edit.cut':  'Ctrl+X',
  'edit.copy': 'Ctrl+C',
  'edit.paste': 'Ctrl+V',

  // Settings
  'app.openSettings': 'Ctrl+,',
};

export const PRESETS: Record<Exclude<PresetId, 'custom'>, KeybindingMap> = {
  ableton: ABLETON_PRESET,
  protools: PROTOOLS_PRESET,
  'logic-cubase': LOGIC_CUBASE_PRESET,
  reaper: REAPER_PRESET,
};

// Normalise a binding string: sort modifier tokens alphabetically, then append key.
export function normalizeDescriptor(descriptor: string): string {
  const parts = descriptor.split('+');
  const key = parts.pop()!;
  const mods = parts.map(m => m.toLowerCase()).sort();
  return [...mods, key].join('+');
}

// Convert a DOM KeyboardEvent into a normalised descriptor.
export function eventToDescriptor(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.altKey) parts.push('alt');
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');

  let key = e.key;
  if (key === ' ') key = 'Space';
  // Avoid double-counting modifier keys themselves
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(key)) return '';

  parts.push(key);
  return parts.join('+');
}

// Keys the browser/OS intercepts — never bindable.
export const RESERVED_KEYS = new Set([
  normalizeDescriptor('Ctrl+W'),
  normalizeDescriptor('Ctrl+N'),
  normalizeDescriptor('Ctrl+Tab'),
  normalizeDescriptor('Ctrl+Shift+Tab'),
  normalizeDescriptor('Ctrl+L'),
  normalizeDescriptor('Alt+F4'),
  normalizeDescriptor('F5'),
  normalizeDescriptor('F11'),
  normalizeDescriptor('F12'),
]);
