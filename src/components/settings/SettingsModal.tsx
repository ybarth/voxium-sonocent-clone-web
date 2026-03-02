import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useKeybindingStore } from '../../stores/keybindingStore';
import { useProjectStore } from '../../stores/projectStore';
import { COMMAND_REGISTRY, COMMAND_CATEGORIES, type CommandCategory } from '../../commands/commandRegistry';
import { PRESET_LABELS, type PresetId, normalizeDescriptor } from '../../commands/keybindingPresets';
import { KeybindingRow } from './KeybindingRow';
import { TtsEngine } from '../../utils/ttsEngine';
import type { TtsConfig, TtsAnnounceAt, TtsContentMode } from '../../types';
import { getApiKey, setApiKey, clearApiKey, hasApiKey } from '../../utils/aiGeneration';
import {
  getElevenLabsApiKey, setElevenLabsApiKey, clearElevenLabsApiKey, hasElevenLabsApiKey,
} from '../../utils/elevenLabsApi';

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
  const ttsConfig = useProjectStore(s => s.project.settings.ttsConfig);
  const setTtsConfig = useProjectStore(s => s.setTtsConfig);
  const defaultAttributes = useProjectStore(s => s.project.settings.defaultAttributes);
  const setDefaultAttributes = useProjectStore(s => s.setDefaultAttributes);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(hasApiKey());
  const [elApiKeyInput, setElApiKeyInput] = useState('');
  const [hasElKey, setHasElKey] = useState(hasElevenLabsApiKey());

  useEffect(() => {
    const tts = new TtsEngine();
    // Voices may load async
    const loadVoices = () => setVoices(tts.getAvailableVoices());
    loadVoices();
    const timer = setTimeout(loadVoices, 500);
    return () => clearTimeout(timer);
  }, []);

  const handlePreviewTts = () => {
    const tts = new TtsEngine();
    tts.speak('Chunk 3, Key Point', { ...ttsConfig, enabled: true, duckMainAudio: false });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Tooltips toggle */}
      <SettingToggleRow
        title="Show Keyboard Shortcut Tooltips"
        description="Display tooltips with keyboard shortcuts when hovering over toolbar buttons"
        value={showTooltips}
        onChange={() => setShowTooltips(!showTooltips)}
      />

      {/* ── TTS Announcements ── */}
      <SectionHeader>TTS Announcements</SectionHeader>

      <SettingToggleRow
        title="Enable TTS"
        description="Announce chunk information during playback using text-to-speech"
        value={ttsConfig.enabled}
        onChange={() => setTtsConfig({ enabled: !ttsConfig.enabled })}
      />

      {ttsConfig.enabled && (
        <>
          <SettingSelectRow
            title="Announce At"
            value={ttsConfig.announceAt}
            options={[
              { value: 'start', label: 'Chunk Start' },
              { value: 'end', label: 'Chunk End' },
              { value: 'both', label: 'Both' },
            ]}
            onChange={(v) => setTtsConfig({ announceAt: v as TtsAnnounceAt })}
          />

          <SettingSelectRow
            title="Content Mode"
            value={ttsConfig.contentMode}
            options={[
              { value: 'chunk-number', label: 'Chunk Number' },
              { value: 'section-and-chunk', label: 'Section + Chunk' },
              { value: 'color-label', label: 'Color Label + Chunk' },
            ]}
            onChange={(v) => setTtsConfig({ contentMode: v as TtsContentMode })}
          />

          <SettingSliderRow
            title="Speed"
            value={ttsConfig.speed}
            min={0.5}
            max={2.0}
            step={0.1}
            display={`${ttsConfig.speed.toFixed(1)}x`}
            onChange={(v) => setTtsConfig({ speed: v })}
          />

          {voices.length > 0 && (
            <SettingSelectRow
              title="Voice"
              value={ttsConfig.voiceUri}
              options={[
                { value: '', label: 'Default' },
                ...voices.map((v) => ({ value: v.voiceURI, label: `${v.name} (${v.lang})` })),
              ]}
              onChange={(v) => setTtsConfig({ voiceUri: v })}
            />
          )}

          <SettingToggleRow
            title="Duck Main Audio"
            description="Reduce main audio volume while TTS is speaking"
            value={ttsConfig.duckMainAudio}
            onChange={() => setTtsConfig({ duckMainAudio: !ttsConfig.duckMainAudio })}
          />

          {ttsConfig.duckMainAudio && (
            <SettingSliderRow
              title="Duck Level"
              value={ttsConfig.duckLevel}
              min={0}
              max={1}
              step={0.05}
              display={`${Math.round(ttsConfig.duckLevel * 100)}%`}
              onChange={(v) => setTtsConfig({ duckLevel: v })}
            />
          )}

          <button onClick={handlePreviewTts} style={previewBtnStyle}>
            Preview TTS
          </button>
        </>
      )}

      {/* ── AI Configuration ── */}
      <SectionHeader>AI Configuration</SectionHeader>

      <div style={settingRowStyle}>
        <div>
          <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500 }}>
            OpenAI API Key
          </div>
          <div style={{ fontSize: '11px', color: '#505060', marginTop: '2px' }}>
            Required for AI color and texture generation
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {hasKey ? (
            <>
              <span style={{ fontSize: '11px', color: '#22C55E' }}>Configured</span>
              <button
                onClick={() => { clearApiKey(); setHasKey(false); }}
                style={{ ...previewBtnStyle, color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)' }}
              >
                Clear
              </button>
            </>
          ) : (
            <>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-..."
                style={{
                  background: '#1a1a2e',
                  border: '1px solid #2a2a3e',
                  borderRadius: '6px',
                  color: '#e0e0e0',
                  padding: '4px 8px',
                  fontSize: '12px',
                  width: '180px',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => {
                  if (apiKeyInput.trim()) {
                    setApiKey(apiKeyInput.trim());
                    setHasKey(true);
                    setApiKeyInput('');
                  }
                }}
                style={previewBtnStyle}
              >
                Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* ElevenLabs API Key */}
      <div style={settingRowStyle}>
        <div>
          <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500 }}>
            ElevenLabs API Key
          </div>
          <div style={{ fontSize: '11px', color: '#505060', marginTop: '2px' }}>
            Required for generating custom template sound effects
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {hasElKey ? (
            <>
              <span style={{ fontSize: '11px', color: '#22C55E' }}>Configured</span>
              <button
                onClick={() => { clearElevenLabsApiKey(); setHasElKey(false); }}
                style={{ ...previewBtnStyle, color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)' }}
              >
                Clear
              </button>
            </>
          ) : (
            <>
              <input
                type="password"
                value={elApiKeyInput}
                onChange={(e) => setElApiKeyInput(e.target.value)}
                placeholder="sk_..."
                style={{
                  background: '#1a1a2e',
                  border: '1px solid #2a2a3e',
                  borderRadius: '6px',
                  color: '#e0e0e0',
                  padding: '4px 8px',
                  fontSize: '12px',
                  width: '180px',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => {
                  if (elApiKeyInput.trim()) {
                    setElevenLabsApiKey(elApiKeyInput.trim());
                    setHasElKey(true);
                    setElApiKeyInput('');
                  }
                }}
                style={previewBtnStyle}
              >
                Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Default Attributes ── */}
      <SectionHeader>Default Attributes</SectionHeader>

      <div style={settingRowStyle}>
        <div>
          <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500 }}>
            Default Color
          </div>
          <div style={{ fontSize: '11px', color: '#505060', marginTop: '2px' }}>
            Color used for chunks without a form assigned
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="color"
            value={defaultAttributes.color.hex}
            onChange={(e) => setDefaultAttributes({
              color: { ...defaultAttributes.color, hex: e.target.value },
            })}
            style={{ width: '32px', height: '24px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
          />
          <span style={{ fontSize: '11px', color: '#606070', fontFamily: 'monospace' }}>
            {defaultAttributes.color.hex}
          </span>
        </div>
      </div>

      <div style={settingRowStyle}>
        <div>
          <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500 }}>
            Default Shape
          </div>
          <div style={{ fontSize: '11px', color: '#505060', marginTop: '2px' }}>
            Shape profile for chunks without a form
          </div>
        </div>
        <select
          value={defaultAttributes.shape.builtinId}
          onChange={(e) => setDefaultAttributes({
            shape: { builtinId: e.target.value as any },
          })}
          style={{
            background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '6px',
            color: '#e0e0e0', padding: '4px 8px', fontSize: '12px', cursor: 'pointer',
          }}
        >
          {['default', 'sharp', 'rounded', 'tapered', 'scalloped', 'notched', 'wave', 'chevron'].map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '12px',
        fontWeight: 700,
        color: '#808090',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        paddingTop: '8px',
        borderTop: '1px solid #1a1a2e',
      }}
    >
      {children}
    </div>
  );
}

function SettingToggleRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description?: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <div style={settingRowStyle}>
      <div>
        <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500 }}>{title}</div>
        {description && (
          <div style={{ fontSize: '11px', color: '#505060', marginTop: '2px' }}>{description}</div>
        )}
      </div>
      <button
        onClick={onChange}
        style={{
          width: '40px',
          height: '22px',
          borderRadius: '11px',
          border: 'none',
          backgroundColor: value ? '#3B82F6' : '#2a2a3e',
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
            left: value ? '21px' : '3px',
            transition: 'left 0.2s',
          }}
        />
      </button>
    </div>
  );
}

function SettingSelectRow({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div style={settingRowStyle}>
      <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500 }}>{title}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: '#1a1a2e',
          border: '1px solid #2a2a3e',
          borderRadius: '6px',
          color: '#e0e0e0',
          padding: '4px 8px',
          fontSize: '12px',
          cursor: 'pointer',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SettingSliderRow({
  title,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  title: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <div style={settingRowStyle}>
      <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ width: '100px', accentColor: '#3B82F6' }}
        />
        <span style={{ fontSize: '12px', color: '#a0a0b0', minWidth: '40px', textAlign: 'right' }}>
          {display}
        </span>
      </div>
    </div>
  );
}

const settingRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  backgroundColor: 'rgba(255,255,255,0.02)',
  borderRadius: '6px',
  border: '1px solid #1a1a2e',
};

const previewBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  background: 'none',
  border: '1px solid #2a2a3e',
  borderRadius: '6px',
  color: '#a0a0b0',
  fontSize: '11px',
  cursor: 'pointer',
};

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
