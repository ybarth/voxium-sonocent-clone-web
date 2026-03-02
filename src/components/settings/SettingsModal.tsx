import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useKeybindingStore } from '../../stores/keybindingStore';
import { COMMAND_REGISTRY, COMMAND_CATEGORIES, type CommandCategory } from '../../commands/commandRegistry';
import { PRESET_LABELS, type PresetId, normalizeDescriptor } from '../../commands/keybindingPresets';
import { KeybindingRow } from './KeybindingRow';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const activePresetId = useKeybindingStore(s => s.activePresetId);
  const setPreset = useKeybindingStore(s => s.setPreset);
  const resetToPreset = useKeybindingStore(s => s.resetToPreset);
  const getConflicts = useKeybindingStore(s => s.getConflicts);
  const getResolvedBindings = useKeybindingStore(s => s.getResolvedBindings);

  const [collapsedCategories, setCollapsedCategories] = useState<Set<CommandCategory>>(new Set());
  const [activeTab, setActiveTab] = useState<'keybindings' | 'general'>('keybindings');

  const resolved = getResolvedBindings();
  const conflicts = getConflicts();

  // Build a set of command IDs that are in conflict
  const conflictingCommands = new Set<string>();
  for (const cmds of conflicts.values()) {
    for (const cmd of cmds) conflictingCommands.add(cmd);
  }

  const toggleCategory = (cat: CommandCategory) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Close on Escape or click outside
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const commandsByCategory = COMMAND_CATEGORIES.map(cat => ({
    ...cat,
    commands: Object.values(COMMAND_REGISTRY).filter(cmd => cmd.category === cat.id),
  }));

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: '700px',
          maxWidth: '90vw',
          maxHeight: '85vh',
          backgroundColor: '#0d0d18',
          border: '1px solid #1a1a2e',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #1a1a2e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#e0e0e0' }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#808090',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1a1a2e', padding: '0 20px' }}>
          <TabButton
            label="Keybindings"
            active={activeTab === 'keybindings'}
            onClick={() => setActiveTab('keybindings')}
          />
          <TabButton
            label="General"
            active={activeTab === 'general'}
            onClick={() => setActiveTab('general')}
          />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {activeTab === 'keybindings' && (
            <>
              {/* Preset selector */}
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ fontSize: '13px', color: '#a0a0b0', fontWeight: 600 }}>
                  Preset:
                </label>
                <select
                  value={activePresetId}
                  onChange={(e) => {
                    const id = e.target.value as PresetId;
                    if (id === 'custom') return;
                    setPreset(id);
                  }}
                  style={{
                    background: '#1a1a2e',
                    border: '1px solid #2a2a3e',
                    borderRadius: '6px',
                    color: '#e0e0e0',
                    padding: '6px 12px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {(Object.entries(PRESET_LABELS) as [PresetId, string][]).map(([id, label]) => (
                    <option key={id} value={id} disabled={id === 'custom' && activePresetId !== 'custom'}>
                      {label}
                    </option>
                  ))}
                </select>

                {activePresetId === 'custom' && (
                  <button
                    onClick={() => resetToPreset('ableton')}
                    style={{
                      background: 'none',
                      border: '1px solid #2a2a3e',
                      borderRadius: '6px',
                      color: '#808090',
                      padding: '4px 10px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Reset to Ableton
                  </button>
                )}
              </div>

              {/* Conflict summary */}
              {conflicts.size > 0 && (
                <div
                  style={{
                    padding: '8px 12px',
                    marginBottom: '12px',
                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#EAB308',
                  }}
                >
                  {conflicts.size} keybinding conflict{conflicts.size > 1 ? 's' : ''} detected.
                  Commands sharing the same key may not work as expected.
                </div>
              )}

              {/* Command categories */}
              {commandsByCategory.map(({ id, label, commands }) => (
                <div key={id} style={{ marginBottom: '8px' }}>
                  <button
                    onClick={() => toggleCategory(id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'none',
                      border: 'none',
                      color: '#808090',
                      fontSize: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      padding: '6px 0',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    <span style={{
                      display: 'inline-block',
                      transform: collapsedCategories.has(id) ? 'rotate(-90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.15s',
                    }}>
                      ▼
                    </span>
                    {label}
                    <span style={{ color: '#505060', fontWeight: 400 }}>({commands.length})</span>
                  </button>

                  {!collapsedCategories.has(id) && (
                    <div style={{ marginLeft: '4px' }}>
                      {commands.map(cmd => (
                        <KeybindingRow
                          key={cmd.id}
                          commandId={cmd.id}
                          label={cmd.label}
                          description={cmd.description}
                          currentBinding={resolved[cmd.id] ?? ''}
                          hasConflict={conflictingCommands.has(cmd.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {activeTab === 'general' && (
            <GeneralSettings />
          )}
        </div>
      </div>
    </div>
  );
}

function GeneralSettings() {
  const showTooltips = useKeybindingStore(s => s.showTooltips);
  const setShowTooltips = useKeybindingStore(s => s.setShowTooltips);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          backgroundColor: 'rgba(255,255,255,0.02)',
          borderRadius: '6px',
          border: '1px solid #1a1a2e',
        }}
      >
        <div>
          <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500 }}>
            Show Keyboard Shortcut Tooltips
          </div>
          <div style={{ fontSize: '11px', color: '#505060', marginTop: '2px' }}>
            Display tooltips with keyboard shortcuts when hovering over toolbar buttons
          </div>
        </div>
        <button
          onClick={() => setShowTooltips(!showTooltips)}
          style={{
            width: '40px',
            height: '22px',
            borderRadius: '11px',
            border: 'none',
            backgroundColor: showTooltips ? '#3B82F6' : '#2a2a3e',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background-color 0.2s',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: '#e0e0e0',
              position: 'absolute',
              top: '3px',
              left: showTooltips ? '21px' : '3px',
              transition: 'left 0.2s',
            }}
          />
        </button>
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid #3B82F6' : '2px solid transparent',
        color: active ? '#e0e0e0' : '#606070',
        fontSize: '13px',
        fontWeight: 600,
        padding: '10px 16px',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}
