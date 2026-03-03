import { useState } from 'react';
import type { SectionSoundAttribute, SectionSoundTrigger } from '../../types/scheme';
import { BUILTIN_SFX_LIST } from '../../constants/builtinSfx';
import { getSfxEngine } from '../../hooks/usePlayback';
import { useAssetLibraryStore } from '../../stores/assetLibraryStore';

interface SectionSoundPickerProps {
  value?: SectionSoundAttribute;
  onChange: (sound: SectionSoundAttribute | undefined) => void;
}

export function SectionSoundPicker({ value, onChange }: SectionSoundPickerProps) {
  const [enabled, setEnabled] = useState(!!value);
  const { sounds } = useAssetLibraryStore();

  const handleToggle = () => {
    if (enabled) {
      setEnabled(false);
      onChange(undefined);
    } else {
      setEnabled(true);
      onChange({
        sfxRef: { type: 'builtin', builtinId: 'click-soft', volume: 0.5 },
        trigger: 'section-begin',
      });
    }
  };

  const handleSfxChange = (selectValue: string) => {
    if (selectValue.startsWith('library:')) {
      const assetId = selectValue.slice(8);
      const asset = sounds.find((s) => s.id === assetId);
      if (asset) {
        onChange({
          sfxRef: { type: 'library', libraryAssetId: assetId, audioUrl: asset.dataUrl, volume: value?.volume ?? 0.5 },
          trigger: value?.trigger ?? 'section-begin',
          volume: value?.volume,
        });
        const engine = getSfxEngine();
        engine?.loadCustomSfx(asset.dataUrl);
      }
    } else {
      onChange({
        sfxRef: { type: 'builtin', builtinId: selectValue, volume: value?.volume ?? 0.5 },
        trigger: value?.trigger ?? 'section-begin',
        volume: value?.volume,
      });
    }
  };

  const handleTriggerChange = (trigger: SectionSoundTrigger) => {
    if (!value) return;
    onChange({ ...value, trigger });
  };

  const handleVolumeChange = (vol: number) => {
    if (!value) return;
    onChange({ ...value, sfxRef: { ...value.sfxRef, volume: vol }, volume: vol });
  };

  const handlePreview = () => {
    if (!value) return;
    if (value.sfxRef.type === 'library' && value.sfxRef.audioUrl) {
      const audio = new Audio(value.sfxRef.audioUrl);
      audio.volume = value.sfxRef.volume;
      audio.play();
    } else {
      const engine = getSfxEngine();
      engine?.previewSfx(value.sfxRef);
    }
  };

  // Group SFX by category
  const categories = [...new Set(BUILTIN_SFX_LIST.map((s) => s.category))];

  // Determine current select value
  const currentSelectValue = value?.sfxRef.type === 'library' && value.sfxRef.libraryAssetId
    ? `library:${value.sfxRef.libraryAssetId}`
    : value?.sfxRef.builtinId ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Enable toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: '#a0a0b0' }}>Section Sound</span>
        <button
          onClick={handleToggle}
          style={{
            width: '36px', height: '20px', borderRadius: '10px', border: 'none',
            backgroundColor: enabled ? '#3B82F6' : '#2a2a3e', cursor: 'pointer',
            position: 'relative', transition: 'background-color 0.2s',
          }}
        >
          <div style={{
            width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#e0e0e0',
            position: 'absolute', top: '3px', left: enabled ? '19px' : '3px',
            transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {enabled && value && (
        <>
          {/* SFX selector */}
          <select
            value={currentSelectValue}
            onChange={(e) => handleSfxChange(e.target.value)}
            style={{
              background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '6px',
              color: '#e0e0e0', padding: '4px 8px', fontSize: '11px', cursor: 'pointer',
            }}
          >
            {categories.map((cat) => (
              <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                {BUILTIN_SFX_LIST.filter((s) => s.category === cat).map((sfx) => (
                  <option key={sfx.id} value={sfx.id}>{sfx.label}</option>
                ))}
              </optgroup>
            ))}
            {sounds.length > 0 && (
              <optgroup label="Library">
                {sounds.map((asset) => (
                  <option key={asset.id} value={`library:${asset.id}`}>
                    {asset.name}
                    {asset.durationSeconds ? ` (${asset.durationSeconds.toFixed(1)}s)` : ''}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {/* Trigger selector */}
          <div>
            <div style={{ fontSize: '10px', color: '#606070', fontWeight: 600, marginBottom: '4px' }}>
              Play At
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {([
                { value: 'section-begin', label: 'Section Begin' },
                { value: 'section-end', label: 'Section End' },
                { value: 'both', label: 'Both' },
              ] as { value: SectionSoundTrigger; label: string }[]).map((t) => (
                <button
                  key={t.value}
                  onClick={() => handleTriggerChange(t.value)}
                  style={{
                    flex: 1, padding: '3px 4px', fontSize: '10px',
                    backgroundColor: value.trigger === t.value ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.02)',
                    border: value.trigger === t.value ? '1px solid rgba(59,130,246,0.4)' : '1px solid #1a1a2e',
                    borderRadius: '4px', color: value.trigger === t.value ? '#93c5fd' : '#606070',
                    cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Volume */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#606070' }}>Vol</span>
            <input
              type="range"
              min={0} max={1} step={0.05}
              value={value.volume ?? value.sfxRef.volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: '#3B82F6' }}
            />
            <span style={{ fontSize: '10px', color: '#606070', minWidth: '28px', textAlign: 'right' }}>
              {Math.round((value.volume ?? value.sfxRef.volume) * 100)}%
            </span>
          </div>

          {/* Preview */}
          <button
            onClick={handlePreview}
            style={{
              padding: '4px 10px', background: 'none',
              border: '1px solid #2a2a3e', borderRadius: '6px',
              color: '#a0a0b0', fontSize: '11px', cursor: 'pointer',
            }}
          >
            Preview
          </button>
        </>
      )}
    </div>
  );
}
