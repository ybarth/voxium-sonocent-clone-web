// Command registry — single source of truth for all keyboard-driven actions.

export type CommandCategory =
  | 'navigation'
  | 'selection'
  | 'section'
  | 'editing'
  | 'nudge'
  | 'cursor'
  | 'transport'
  | 'view'
  | 'history'
  | 'color'
  | 'form';

export interface CommandDefinition {
  id: string;
  label: string;
  category: CommandCategory;
  description: string;
  requiresSelection?: boolean;
  audioPaneOnly?: boolean;
}

export const COMMAND_CATEGORIES: { id: CommandCategory; label: string }[] = [
  { id: 'navigation', label: 'Navigation' },
  { id: 'selection', label: 'Selection' },
  { id: 'section', label: 'Sections' },
  { id: 'editing', label: 'Editing' },
  { id: 'nudge', label: 'Nudge / Reorder' },
  { id: 'cursor', label: 'Playback Cursor' },
  { id: 'transport', label: 'Transport' },
  { id: 'view', label: 'View' },
  { id: 'history', label: 'History' },
  { id: 'color', label: 'Colors' },
  { id: 'form', label: 'Forms & Schemes' },
];

export const COMMAND_REGISTRY: Record<string, CommandDefinition> = {
  // --- Navigation ---
  'chunk.prev': {
    id: 'chunk.prev', label: 'Previous Chunk', category: 'navigation',
    description: 'Navigate to the previous chunk', audioPaneOnly: true,
  },
  'chunk.next': {
    id: 'chunk.next', label: 'Next Chunk', category: 'navigation',
    description: 'Navigate to the next chunk', audioPaneOnly: true,
  },
  'chunk.first': {
    id: 'chunk.first', label: 'First Chunk', category: 'navigation',
    description: 'Jump to the first chunk in the project', audioPaneOnly: true,
  },
  'chunk.last': {
    id: 'chunk.last', label: 'Last Chunk', category: 'navigation',
    description: 'Jump to the last chunk in the project', audioPaneOnly: true,
  },
  'chunk.firstInSection': {
    id: 'chunk.firstInSection', label: 'First Chunk in Section', category: 'navigation',
    description: 'Jump to the first chunk in the current section', audioPaneOnly: true,
  },
  'chunk.lastInSection': {
    id: 'chunk.lastInSection', label: 'Last Chunk in Section', category: 'navigation',
    description: 'Jump to the last chunk in the current section', audioPaneOnly: true,
  },

  // --- Selection ---
  'selection.extendPrev': {
    id: 'selection.extendPrev', label: 'Extend Selection Left', category: 'selection',
    description: 'Extend selection to include the previous chunk', audioPaneOnly: true,
  },
  'selection.extendNext': {
    id: 'selection.extendNext', label: 'Extend Selection Right', category: 'selection',
    description: 'Extend selection to include the next chunk', audioPaneOnly: true,
  },
  'selection.all': {
    id: 'selection.all', label: 'Select All (Project)', category: 'selection',
    description: 'Select all chunks in the entire project', audioPaneOnly: true,
  },
  'selection.allInSection': {
    id: 'selection.allInSection', label: 'Select All in Section', category: 'selection',
    description: 'Select all chunks in the current section', audioPaneOnly: true,
  },
  'selection.clear': {
    id: 'selection.clear', label: 'Clear Selection', category: 'selection',
    description: 'Deselect all chunks', audioPaneOnly: true,
  },
  'selection.invert': {
    id: 'selection.invert', label: 'Invert Selection', category: 'selection',
    description: 'Toggle selected/unselected chunks in the current section', audioPaneOnly: true,
  },

  // --- Section ---
  'section.prev': {
    id: 'section.prev', label: 'Previous Section', category: 'section',
    description: 'Navigate to the previous section', audioPaneOnly: true,
  },
  'section.next': {
    id: 'section.next', label: 'Next Section', category: 'section',
    description: 'Navigate to the next section', audioPaneOnly: true,
  },
  'section.toggleCollapse': {
    id: 'section.toggleCollapse', label: 'Toggle Section Collapse', category: 'section',
    description: 'Collapse or expand the current section', audioPaneOnly: true,
  },

  // --- Editing ---
  'edit.split': {
    id: 'edit.split', label: 'Split at Cursor', category: 'editing',
    description: 'Split the current chunk at the cursor position', audioPaneOnly: true,
  },
  'edit.merge': {
    id: 'edit.merge', label: 'Merge Selected', category: 'editing',
    description: 'Merge two or more selected chunks', audioPaneOnly: true, requiresSelection: true,
  },
  'edit.mergeSections': {
    id: 'edit.mergeSections', label: 'Merge Selected Sections', category: 'editing',
    description: 'Merge two or more selected sections', audioPaneOnly: true,
  },
  'edit.delete': {
    id: 'edit.delete', label: 'Delete Selected', category: 'editing',
    description: 'Delete all selected chunks', audioPaneOnly: true, requiresSelection: true,
  },
  'edit.duplicate': {
    id: 'edit.duplicate', label: 'Duplicate Selected', category: 'editing',
    description: 'Duplicate selected chunks after their originals', audioPaneOnly: true, requiresSelection: true,
  },

  // --- Nudge / Reorder ---
  'nudge.left': {
    id: 'nudge.left', label: 'Nudge Left', category: 'nudge',
    description: 'Move selected chunks one position left', audioPaneOnly: true, requiresSelection: true,
  },
  'nudge.right': {
    id: 'nudge.right', label: 'Nudge Right', category: 'nudge',
    description: 'Move selected chunks one position right', audioPaneOnly: true, requiresSelection: true,
  },
  'nudge.toSectionStart': {
    id: 'nudge.toSectionStart', label: 'Nudge to Section Start', category: 'nudge',
    description: 'Move selected chunks to the start of their section', audioPaneOnly: true, requiresSelection: true,
  },
  'nudge.toSectionEnd': {
    id: 'nudge.toSectionEnd', label: 'Nudge to Section End', category: 'nudge',
    description: 'Move selected chunks to the end of their section', audioPaneOnly: true, requiresSelection: true,
  },
  'nudge.toPrevSection': {
    id: 'nudge.toPrevSection', label: 'Move to Previous Section', category: 'nudge',
    description: 'Move selected chunks to the previous section', audioPaneOnly: true, requiresSelection: true,
  },
  'nudge.toNextSection': {
    id: 'nudge.toNextSection', label: 'Move to Next Section', category: 'nudge',
    description: 'Move selected chunks to the next section', audioPaneOnly: true, requiresSelection: true,
  },

  // --- Playback Cursor (intra-chunk) ---
  'cursor.scrubLeft': {
    id: 'cursor.scrubLeft', label: 'Scrub Cursor Left', category: 'cursor',
    description: 'Move cursor 10% left within the current chunk', audioPaneOnly: true,
  },
  'cursor.scrubRight': {
    id: 'cursor.scrubRight', label: 'Scrub Cursor Right', category: 'cursor',
    description: 'Move cursor 10% right within the current chunk', audioPaneOnly: true,
  },
  'cursor.scrubLeftFine': {
    id: 'cursor.scrubLeftFine', label: 'Fine Scrub Left', category: 'cursor',
    description: 'Move cursor 2% left within the current chunk', audioPaneOnly: true,
  },
  'cursor.scrubRightFine': {
    id: 'cursor.scrubRightFine', label: 'Fine Scrub Right', category: 'cursor',
    description: 'Move cursor 2% right within the current chunk', audioPaneOnly: true,
  },
  'cursor.toChunkStart': {
    id: 'cursor.toChunkStart', label: 'Cursor to Chunk Start', category: 'cursor',
    description: 'Jump cursor to the beginning of the current chunk', audioPaneOnly: true,
  },
  'cursor.toChunkEnd': {
    id: 'cursor.toChunkEnd', label: 'Cursor to Chunk End', category: 'cursor',
    description: 'Jump cursor to the end of the current chunk', audioPaneOnly: true,
  },

  // --- Transport ---
  'transport.togglePlay': {
    id: 'transport.togglePlay', label: 'Play / Pause', category: 'transport',
    description: 'Toggle playback',
  },
  'transport.stop': {
    id: 'transport.stop', label: 'Stop', category: 'transport',
    description: 'Stop playback and reset cursor',
  },

  // --- View ---
  'view.zoomIn': {
    id: 'view.zoomIn', label: 'Zoom In', category: 'view',
    description: 'Increase zoom level',
  },
  'view.zoomOut': {
    id: 'view.zoomOut', label: 'Zoom Out', category: 'view',
    description: 'Decrease zoom level',
  },
  'view.zoomReset': {
    id: 'view.zoomReset', label: 'Reset Zoom', category: 'view',
    description: 'Reset zoom to 1.0x',
  },
  'view.toggleVisualMode': {
    id: 'view.toggleVisualMode', label: 'Toggle Waveform / Flat', category: 'view',
    description: 'Switch between waveform and flat visual mode',
  },

  // --- History ---
  'history.undo': {
    id: 'history.undo', label: 'Undo', category: 'history',
    description: 'Undo the last action',
  },
  'history.redo': {
    id: 'history.redo', label: 'Redo', category: 'history',
    description: 'Redo the last undone action',
  },

  // --- Color ---
  'color.apply1': { id: 'color.apply1', label: 'Apply Color 1', category: 'color', description: 'Apply color key 1 to selected chunks', audioPaneOnly: true, requiresSelection: true },
  'color.apply2': { id: 'color.apply2', label: 'Apply Color 2', category: 'color', description: 'Apply color key 2 to selected chunks', audioPaneOnly: true, requiresSelection: true },
  'color.apply3': { id: 'color.apply3', label: 'Apply Color 3', category: 'color', description: 'Apply color key 3 to selected chunks', audioPaneOnly: true, requiresSelection: true },
  'color.apply4': { id: 'color.apply4', label: 'Apply Color 4', category: 'color', description: 'Apply color key 4 to selected chunks', audioPaneOnly: true, requiresSelection: true },
  'color.apply5': { id: 'color.apply5', label: 'Apply Color 5', category: 'color', description: 'Apply color key 5 to selected chunks', audioPaneOnly: true, requiresSelection: true },
  'color.apply6': { id: 'color.apply6', label: 'Apply Color 6', category: 'color', description: 'Apply color key 6 to selected chunks', audioPaneOnly: true, requiresSelection: true },
  'color.apply7': { id: 'color.apply7', label: 'Apply Color 7', category: 'color', description: 'Apply color key 7 to selected chunks', audioPaneOnly: true, requiresSelection: true },
  'color.apply8': { id: 'color.apply8', label: 'Apply Color 8', category: 'color', description: 'Apply color key 8 to selected chunks', audioPaneOnly: true, requiresSelection: true },
  'color.apply9': { id: 'color.apply9', label: 'Apply Color 9', category: 'color', description: 'Apply color key 9 to selected chunks', audioPaneOnly: true, requiresSelection: true },
  'color.clear': { id: 'color.clear', label: 'Clear Color', category: 'color', description: 'Remove color from selected chunks', audioPaneOnly: true, requiresSelection: true },

  // --- Phase 2: Style / Filter ---
  'style.openEditor': {
    id: 'style.openEditor', label: 'Open Style Editor', category: 'color',
    description: 'Open the style editor for selected chunks', audioPaneOnly: true, requiresSelection: true,
  },
  'filter.toggle': {
    id: 'filter.toggle', label: 'Toggle Filter Panel', category: 'view',
    description: 'Expand or collapse the filter panel in the sidebar',
  },
  'filter.clear': {
    id: 'filter.clear', label: 'Clear Filters', category: 'view',
    description: 'Clear all active filter criteria',
  },

  // Extended palette colors (10-20, no default keybindings)
  'color.apply10': { id: 'color.apply10', label: 'Apply Color 10', category: 'color', description: 'Apply extended color 10 to selected chunks', audioPaneOnly: true, requiresSelection: true },
  'color.apply11': { id: 'color.apply11', label: 'Apply Color 11', category: 'color', description: 'Apply extended color 11 to selected chunks', audioPaneOnly: true, requiresSelection: true },
  'color.apply12': { id: 'color.apply12', label: 'Apply Color 12', category: 'color', description: 'Apply extended color 12 to selected chunks', audioPaneOnly: true, requiresSelection: true },
  'color.apply13': { id: 'color.apply13', label: 'Apply Color 13', category: 'color', description: 'Apply extended color 13 to selected chunks', audioPaneOnly: true, requiresSelection: true },
  'color.apply14': { id: 'color.apply14', label: 'Apply Color 14', category: 'color', description: 'Apply extended color 14 to selected chunks', audioPaneOnly: true, requiresSelection: true },
  'color.apply15': { id: 'color.apply15', label: 'Apply Color 15', category: 'color', description: 'Apply extended color 15 to selected chunks', audioPaneOnly: true, requiresSelection: true },
  'color.apply16': { id: 'color.apply16', label: 'Apply Color 16', category: 'color', description: 'Apply extended color 16 to selected chunks', audioPaneOnly: true, requiresSelection: true },
  'color.apply17': { id: 'color.apply17', label: 'Apply Color 17', category: 'color', description: 'Apply extended color 17 to selected chunks', audioPaneOnly: true, requiresSelection: true },
  'color.apply18': { id: 'color.apply18', label: 'Apply Color 18', category: 'color', description: 'Apply extended color 18 to selected chunks', audioPaneOnly: true, requiresSelection: true },
  'color.apply19': { id: 'color.apply19', label: 'Apply Color 19', category: 'color', description: 'Apply extended color 19 to selected chunks', audioPaneOnly: true, requiresSelection: true },
  'color.apply20': { id: 'color.apply20', label: 'Apply Color 20', category: 'color', description: 'Apply extended color 20 to selected chunks', audioPaneOnly: true, requiresSelection: true },

  // --- Settings ---
  'app.openSettings': {
    id: 'app.openSettings', label: 'Open Settings', category: 'view',
    description: 'Open the settings modal',
  },

  // --- Forms (aliases for color commands, routed through scheme) ---
  'form.apply1': { id: 'form.apply1', label: 'Apply Form 1', category: 'form', description: 'Apply form 1 from active scheme', audioPaneOnly: true, requiresSelection: true },
  'form.apply2': { id: 'form.apply2', label: 'Apply Form 2', category: 'form', description: 'Apply form 2 from active scheme', audioPaneOnly: true, requiresSelection: true },
  'form.apply3': { id: 'form.apply3', label: 'Apply Form 3', category: 'form', description: 'Apply form 3 from active scheme', audioPaneOnly: true, requiresSelection: true },
  'form.apply4': { id: 'form.apply4', label: 'Apply Form 4', category: 'form', description: 'Apply form 4 from active scheme', audioPaneOnly: true, requiresSelection: true },
  'form.apply5': { id: 'form.apply5', label: 'Apply Form 5', category: 'form', description: 'Apply form 5 from active scheme', audioPaneOnly: true, requiresSelection: true },
  'form.apply6': { id: 'form.apply6', label: 'Apply Form 6', category: 'form', description: 'Apply form 6 from active scheme', audioPaneOnly: true, requiresSelection: true },
  'form.apply7': { id: 'form.apply7', label: 'Apply Form 7', category: 'form', description: 'Apply form 7 from active scheme', audioPaneOnly: true, requiresSelection: true },
  'form.apply8': { id: 'form.apply8', label: 'Apply Form 8', category: 'form', description: 'Apply form 8 from active scheme', audioPaneOnly: true, requiresSelection: true },
  'form.apply9': { id: 'form.apply9', label: 'Apply Form 9', category: 'form', description: 'Apply form 9 from active scheme', audioPaneOnly: true, requiresSelection: true },
  'form.clear': { id: 'form.clear', label: 'Clear Form', category: 'form', description: 'Remove form from selected chunks', audioPaneOnly: true, requiresSelection: true },
  'scheme.switch': { id: 'scheme.switch', label: 'Switch Scheme', category: 'form', description: 'Open the scheme selector' },
  'scheme.openManager': { id: 'scheme.openManager', label: 'Scheme Manager', category: 'form', description: 'Open the scheme manager' },
  'forge.open': { id: 'forge.open', label: 'Open The Forge', category: 'form', description: 'Open the AI generation modal' },
};

export type CommandId = keyof typeof COMMAND_REGISTRY;
