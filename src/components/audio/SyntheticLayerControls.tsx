/**
 * SyntheticLayerControls — popover/panel for configuring the TTS synthetic layer.
 * Controls: toggle, TTS engine, mix mode, volume, duck level, pan, voice, regenerate.
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import type { SyntheticLayerMixMode, SyntheticTtsEngine } from '../../types';
import { KOKORO_VOICES } from '../../utils/headTtsProvider';
import { ELEVENLABS_VOICES, ELEVENLABS_MODELS } from '../../utils/elevenLabsTtsProvider';
import { QWEN_VOICES } from '../../utils/qwenTtsProvider';
import { hasElevenLabsApiKey } from '../../utils/elevenLabsApi';
import { getAllChunkStatuses, onStatusChange, clearSyntheticCache } from '../../utils/syntheticLayerGenerator';

const MIX_MODE_LABELS: Record<SyntheticLayerMixMode, string> = {
  'solo-primary': 'Solo Primary',
  'solo-synthetic': 'Solo Synthetic',
  'mix': 'Mix',
  'stereo-split': 'Stereo Split',
};

const ENGINE_LABELS: Record<SyntheticTtsEngine, string> = {
  'kokoro': 'Kokoro (In-Browser)',
  'elevenlabs': 'ElevenLabs',
  'qwen': 'Qwen TTS (CosyVoice)',
};

const ENGINE_DESCRIPTIONS: Record<SyntheticTtsEngine, string> = {
  'kokoro': 'High-quality in-browser TTS via Kokoro-82M. Pre-generates audio buffers with word-level timestamps.',
  'elevenlabs': 'Premium cloud TTS via ElevenLabs API. Requires API key. Natural-sounding voices.',
  'qwen': 'Alibaba CosyVoice model via Hugging Face. Requires HF API token.',
};

interface SyntheticLayerControlsProps {
  onClose: () => void;
}

export function SyntheticLayerControls({ onClose }: SyntheticLayerControlsProps) {
  const config = useProjectStore(s => s.project.settings.syntheticLayer);
  const setSyntheticLayerEnabled = useProjectStore(s => s.setSyntheticLayerEnabled);
  const updateConfig = useProjectStore(s => s.updateSyntheticLayerConfig);
  const setSyntheticMixMode = useProjectStore(s => s.setSyntheticMixMode);

  // Subscribe to generation status changes
  const [statusVersion, setStatusVersion] = useState(0);
  useEffect(() => {
    return onStatusChange(() => setStatusVersion(v => v + 1));
  }, []);

  const statuses = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    statusVersion; // dependency trigger
    return getAllChunkStatuses();
  }, [statusVersion]);

  const statusCounts = useMemo(() => {
    let generating = 0, ready = 0, error = 0, pending = 0;
    for (const status of statuses.values()) {
      if (status === 'generating') generating++;
      else if (status === 'ready') ready++;
      else if (status === 'error') error++;
      else pending++;
    }
    return { generating, ready, error, pending, total: statuses.size };
  }, [statuses]);

  const handleRegenerate = useCallback(() => {
    clearSyntheticCache();
  }, []);

  // When engine changes, reset voice to a sensible default
  const handleEngineChange = useCallback((engine: SyntheticTtsEngine) => {
    const updates: Partial<typeof config> = { ttsEngine: engine };

    switch (engine) {
      case 'kokoro':
        updates.voiceId = 'af_bella';
        break;
      case 'elevenlabs':
        updates.voiceId = ELEVENLABS_VOICES[0].id;
        break;
      case 'qwen':
        updates.voiceId = QWEN_VOICES[0].id;
        break;
    }

    updateConfig(updates);
  }, [updateConfig]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 60,
        right: 16,
        width: 340,
        backgroundColor: '#1e1e2e',
        border: '1px solid #3a3a5c',
        borderRadius: 12,
        padding: 16,
        zIndex: 1000,
        color: '#e0e0f0',
        fontSize: 13,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Synthetic TTS Layer</div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: '#888', cursor: 'pointer',
            fontSize: 18, padding: '0 4px', lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Enable toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={e => setSyntheticLayerEnabled(e.target.checked)}
          style={{ accentColor: '#8b5cf6' }}
        />
        <span>Enable synthetic layer</span>
      </label>

      {!config.enabled && (
        <div style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>
          Enable to hear transcriptions read back via TTS.
        </div>
      )}

      {config.enabled && (
        <>
          {/* TTS Engine Selector */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              TTS Engine
            </div>
            <select
              value={config.ttsEngine}
              onChange={e => handleEngineChange(e.target.value as SyntheticTtsEngine)}
              style={selectStyle}
            >
              {(Object.keys(ENGINE_LABELS) as SyntheticTtsEngine[]).map(engine => (
                <option key={engine} value={engine}>{ENGINE_LABELS[engine]}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: '#777', marginTop: 4, lineHeight: 1.4 }}>
              {ENGINE_DESCRIPTIONS[config.ttsEngine]}
            </div>

            {/* Engine-specific warnings */}
            {config.ttsEngine === 'elevenlabs' && !hasElevenLabsApiKey() && (
              <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
                ElevenLabs API key not set. Configure it in Settings &gt; AI Configuration.
              </div>
            )}
          </div>

          {/* Mix Mode */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Mix Mode
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(Object.keys(MIX_MODE_LABELS) as SyntheticLayerMixMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setSyntheticMixMode(mode)}
                  style={{
                    flex: 1,
                    padding: '4px 2px',
                    fontSize: 11,
                    border: config.mixMode === mode ? '1px solid #8b5cf6' : '1px solid #3a3a5c',
                    borderRadius: 6,
                    backgroundColor: config.mixMode === mode ? '#8b5cf620' : 'transparent',
                    color: config.mixMode === mode ? '#c4b5fd' : '#999',
                    cursor: 'pointer',
                  }}
                >
                  {MIX_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
          </div>

          {/* Volume slider */}
          <SliderControl
            label="Synthetic Volume"
            value={config.volume}
            onChange={v => updateConfig({ volume: v })}
          />

          {/* Duck level (only in mix mode) */}
          {config.mixMode === 'mix' && (
            <SliderControl
              label="Primary Duck Level"
              value={config.primaryDuckLevel}
              onChange={v => updateConfig({ primaryDuckLevel: v })}
            />
          )}

          {/* Pan controls (only in stereo-split) */}
          {config.mixMode === 'stereo-split' && (
            <>
              <SliderControl
                label="Primary Pan (L/R)"
                value={config.primaryPan}
                min={-1}
                max={1}
                step={0.1}
                onChange={v => updateConfig({ primaryPan: v })}
                format={v => v < 0 ? `L ${Math.abs(v).toFixed(1)}` : v > 0 ? `R ${v.toFixed(1)}` : 'C'}
              />
              <SliderControl
                label="Synthetic Pan (L/R)"
                value={config.syntheticPan}
                min={-1}
                max={1}
                step={0.1}
                onChange={v => updateConfig({ syntheticPan: v })}
                format={v => v < 0 ? `L ${Math.abs(v).toFixed(1)}` : v > 0 ? `R ${v.toFixed(1)}` : 'C'}
              />
            </>
          )}

          {/* Voice selector — engine-specific */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Voice
            </div>
            {config.ttsEngine === 'kokoro' && (
              <select
                value={config.voiceId}
                onChange={e => updateConfig({ voiceId: e.target.value })}
                style={selectStyle}
              >
                {KOKORO_VOICES.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            )}
            {config.ttsEngine === 'elevenlabs' && (
              <>
                <select
                  value={config.voiceId}
                  onChange={e => updateConfig({ voiceId: e.target.value })}
                  style={selectStyle}
                >
                  {ELEVENLABS_VOICES.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                {/* Model selector */}
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Model
                  </div>
                  <select
                    value={config.elevenLabsModelId}
                    onChange={e => updateConfig({ elevenLabsModelId: e.target.value })}
                    style={selectStyle}
                  >
                    {ELEVENLABS_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {config.ttsEngine === 'qwen' && (
              <select
                value={config.voiceId}
                onChange={e => updateConfig({ voiceId: e.target.value })}
                style={selectStyle}
              >
                {QWEN_VOICES.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* TTS Speed */}
          <SliderControl
            label="TTS Speed"
            value={config.headTtsSpeed}
            min={0.5}
            max={2.0}
            step={0.1}
            onChange={v => updateConfig({ headTtsSpeed: v })}
            format={v => `${v.toFixed(1)}x`}
          />

          {/* Mute toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.muted}
              onChange={e => updateConfig({ muted: e.target.checked })}
              style={{ accentColor: '#8b5cf6' }}
            />
            <span>Mute synthetic layer</span>
          </label>

          {/* Auto-regenerate toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.autoRegenerate}
              onChange={e => updateConfig({ autoRegenerate: e.target.checked })}
              style={{ accentColor: '#8b5cf6' }}
            />
            <span>Auto-regenerate on text changes</span>
          </label>

          {/* Status indicator */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, fontSize: 11, color: '#999' }}>
            {statusCounts.generating > 0 && (
              <span style={{ color: '#eab308' }}>Generating: {statusCounts.generating}</span>
            )}
            {statusCounts.ready > 0 && (
              <span style={{ color: '#22c55e' }}>Ready: {statusCounts.ready}</span>
            )}
            {statusCounts.error > 0 && (
              <span style={{ color: '#ef4444' }}>Error: {statusCounts.error}</span>
            )}
            {statusCounts.pending > 0 && (
              <span>Pending: {statusCounts.pending}</span>
            )}
          </div>

          {/* Regenerate All button */}
          <button
            onClick={handleRegenerate}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#8b5cf620',
              border: '1px solid #8b5cf6',
              borderRadius: 8,
              color: '#c4b5fd',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Regenerate All
          </button>
        </>
      )}
    </div>
  );
}

// ─── Shared styles ──────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  backgroundColor: '#2a2a3e',
  border: '1px solid #3a3a5c',
  borderRadius: 6,
  color: '#e0e0f0',
  fontSize: 12,
};

// ─── Slider helper ──────────────────────────────────────────────────────────

function SliderControl({
  label, value, onChange, min = 0, max = 1, step = 0.05,
  format = (v: number) => `${Math.round(v * 100)}%`,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
        <span style={{ fontSize: 11, color: '#c4b5fd' }}>{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#8b5cf6' }}
      />
    </div>
  );
}
