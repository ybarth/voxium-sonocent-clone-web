import { useState } from 'react';
import { ChevronRight, ChevronDown, Volume2, Play } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useProjectStore } from '../../stores/projectStore';
import type { SfxMapping, SfxRef, SfxPosition } from '../../types';
import { BUILTIN_SFX_LIST } from '../../constants/builtinSfx';
import { getSfxEngine } from '../../hooks/usePlayback';

/** Encode an SfxRef into a string value for dropdown selection */
function encodeSfxValue(ref: SfxRef | undefined): string {
  if (!ref) return 'none';
  if (ref.type === 'builtin' && ref.builtinId) return `builtin:${ref.builtinId}`;
  if (ref.type === 'custom' && ref.audioUrl) return `custom:${ref.audioUrl}`;
  return 'none';
}

/** Decode a dropdown value back into an SfxRef (or null for 'none') */
function decodeSfxValue(value: string): SfxRef | null {
  if (value === 'none') return null;
  if (value.startsWith('builtin:')) {
    return { type: 'builtin', builtinId: value.slice(8), volume: 0.5 };
  }
  if (value.startsWith('custom:')) {
    return { type: 'custom', audioUrl: value.slice(7), volume: 0.5 };
  }
  return null;
}

/** Extract a display label from a custom audio URL */
function customLabel(url: string): string {
  const filename = url.split('/').pop()?.replace('.mp3', '') ?? 'Custom';
  return filename.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function SfxConfigPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const colorKey = useProjectStore((s) => s.project.colorKey);
  const sfxMappings = useProjectStore((s) => s.project.settings.sfxMappings);
  const addSfxMapping = useProjectStore((s) => s.addSfxMapping);
  const removeSfxMapping = useProjectStore((s) => s.removeSfxMapping);

  const getMappingForColor = (hex: string, position: SfxPosition): SfxMapping | undefined =>
    sfxMappings.find((m) => m.matchType === 'color' && m.colorHex === hex && (m.position === position || m.position === 'both'));

  const getGlobalMapping = (position: SfxPosition): SfxMapping | undefined =>
    sfxMappings.find((m) => m.matchType === 'global' && (m.position === position || m.position === 'both'));

  // Collect all custom SFX currently in use (for dropdown options)
  const customSfxOptions: { value: string; label: string }[] = [];
  const seenUrls = new Set<string>();
  for (const m of sfxMappings) {
    if (m.sfxRef.type === 'custom' && m.sfxRef.audioUrl && !seenUrls.has(m.sfxRef.audioUrl)) {
      seenUrls.add(m.sfxRef.audioUrl);
      customSfxOptions.push({
        value: `custom:${m.sfxRef.audioUrl}`,
        label: customLabel(m.sfxRef.audioUrl),
      });
    }
  }

  const handleAssign = (colorHex: string | undefined, position: SfxPosition, encodedValue: string) => {
    // Remove existing mapping for this color+position
    const existing = colorHex
      ? sfxMappings.find((m) => m.matchType === 'color' && m.colorHex === colorHex && (m.position === position || m.position === 'both'))
      : sfxMappings.find((m) => m.matchType === 'global' && (m.position === position || m.position === 'both'));
    if (existing) removeSfxMapping(existing.id);

    const sfxRef = decodeSfxValue(encodedValue);
    if (!sfxRef) return;

    addSfxMapping({
      id: uuid(),
      matchType: colorHex ? 'color' : 'global',
      colorHex,
      position,
      sfxRef,
    });
  };

  return (
    <div style={{ marginTop: '8px' }}>
      <button
        onClick={() => setIsExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '12px',
          fontWeight: 600,
          color: sfxMappings.length > 0 ? '#22C55E' : '#808090',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '4px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          width: '100%',
        }}
      >
        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Volume2 size={12} />
        SFX Config
        {sfxMappings.length > 0 && (
          <span style={{ fontSize: '10px', color: '#505060' }}>({sfxMappings.length})</span>
        )}
      </button>

      {isExpanded && (
        <div style={{ fontSize: '10px', overflow: 'auto' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: '2px', marginBottom: '4px' }}>
            <div style={headerStyle}>Color</div>
            <div style={headerStyle}>Start SFX</div>
            <div style={headerStyle}>End SFX</div>
          </div>

          {/* Global default */}
          <SfxRow
            label="Global Default"
            swatchColor={null}
            startValue={encodeSfxValue(getGlobalMapping('start')?.sfxRef)}
            endValue={encodeSfxValue(getGlobalMapping('end')?.sfxRef)}
            customOptions={customSfxOptions}
            onStartChange={(v) => handleAssign(undefined, 'start', v)}
            onEndChange={(v) => handleAssign(undefined, 'end', v)}
          />

          {/* Per-color rows */}
          {colorKey.colors.slice(0, 9).map((entry) => (
            <SfxRow
              key={entry.hex}
              label={entry.label}
              swatchColor={entry.hex}
              startValue={encodeSfxValue(getMappingForColor(entry.hex, 'start')?.sfxRef)}
              endValue={encodeSfxValue(getMappingForColor(entry.hex, 'end')?.sfxRef)}
              customOptions={customSfxOptions}
              onStartChange={(v) => handleAssign(entry.hex, 'start', v)}
              onEndChange={(v) => handleAssign(entry.hex, 'end', v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SfxRow({
  label,
  swatchColor,
  startValue,
  endValue,
  customOptions,
  onStartChange,
  onEndChange,
}: {
  label: string;
  swatchColor: string | null;
  startValue: string;
  endValue: string;
  customOptions: { value: string; label: string }[];
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: '2px', alignItems: 'center', marginBottom: '2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
        {swatchColor && (
          <div style={{
            width: '10px', height: '10px', borderRadius: '2px',
            backgroundColor: swatchColor, flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.1)',
          }} />
        )}
        <span style={{ color: '#a0a0b0', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      </div>
      <SfxDropdown value={startValue} customOptions={customOptions} onChange={onStartChange} />
      <SfxDropdown value={endValue} customOptions={customOptions} onChange={onEndChange} />
    </div>
  );
}

function SfxDropdown({
  value,
  customOptions,
  onChange,
}: {
  value: string;
  customOptions: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const handlePreview = () => {
    if (value === 'none') return;
    const engine = getSfxEngine();
    if (!engine) return;

    const ref = decodeSfxValue(value);
    if (ref) engine.previewSfx(ref);
  };

  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: '#1a1a2e',
          border: '1px solid #2a2a3e',
          borderRadius: '3px',
          color: value === 'none' ? '#505060' : '#a0a0b0',
          fontSize: '9px',
          padding: '2px 3px',
          cursor: 'pointer',
          outline: 'none',
          flex: 1,
          minWidth: 0,
        }}
      >
        <option value="none">None</option>
        {customOptions.length > 0 && (
          <optgroup label="Template Sounds">
            {customOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </optgroup>
        )}
        <optgroup label="Built-in">
          {BUILTIN_SFX_LIST.map((sfx) => (
            <option key={sfx.id} value={`builtin:${sfx.id}`}>{sfx.label}</option>
          ))}
        </optgroup>
      </select>
      {value !== 'none' && (
        <button
          onClick={handlePreview}
          title="Preview"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            color: '#606070',
            cursor: 'pointer',
            padding: '1px',
            flexShrink: 0,
          }}
        >
          <Play size={8} />
        </button>
      )}
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  fontSize: '9px',
  fontWeight: 600,
  color: '#505060',
  textTransform: 'uppercase',
  padding: '2px 0',
};
