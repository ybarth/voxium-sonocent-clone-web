import { useState, useRef, useCallback, useEffect } from 'react';
import { Star, Pipette, Sparkles } from 'lucide-react';
import { hexToHsv, hsvToHex, hexToHsl, hslToHex, hexToRgb, rgbToHex } from '../../utils/colorUtils';
import { useProjectStore } from '../../stores/projectStore';
import { generateColorFromText, hasApiKey } from '../../utils/aiGeneration';

interface ColorPickerProps {
  value: string;
  alpha?: number;
  onChange: (hex: string) => void;
  onAlphaChange?: (alpha: number) => void;
}

export function ColorPicker({ value, alpha = 1, onChange, onAlphaChange }: ColorPickerProps) {
  const [mode, setMode] = useState<'hsv' | 'hsl' | 'rgb'>('hsv');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiColors, setAiColors] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const recentColors = useProjectStore((s) => s.project.settings.recentColors);
  const favoriteColors = useProjectStore((s) => s.project.settings.favoriteColors);
  const addRecentColor = useProjectStore((s) => s.addRecentColor);
  const toggleFavoriteColor = useProjectStore((s) => s.toggleFavoriteColor);

  const isFavorite = favoriteColors.some((f) => f.hex === value);

  const handleColorChange = useCallback((hex: string) => {
    onChange(hex);
    addRecentColor(hex);
  }, [onChange, addRecentColor]);

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError('');
    try {
      const colors = await generateColorFromText(aiPrompt);
      setAiColors(colors);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Generation failed');
    }
    setAiLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '280px' }}>
      {/* Color wheel / SV square */}
      <HsvSquare value={value} onChange={handleColorChange} />

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: '2px' }}>
        {(['hsv', 'hsl', 'rgb'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              flex: 1,
              padding: '4px',
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              background: mode === m ? '#2a2a3e' : 'transparent',
              border: 'none',
              borderRadius: '4px',
              color: mode === m ? '#e0e0e0' : '#606070',
              cursor: 'pointer',
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Sliders based on mode */}
      {mode === 'hsv' && <HsvSliders value={value} onChange={handleColorChange} />}
      {mode === 'hsl' && <HslSliders value={value} onChange={handleColorChange} />}
      {mode === 'rgb' && <RgbSliders value={value} onChange={handleColorChange} />}

      {/* Hex input */}
      <HexInput value={value} onChange={handleColorChange} />

      {/* Alpha slider */}
      {onAlphaChange && (
        <SliderRow
          label="Alpha"
          value={Math.round(alpha * 100)}
          min={0}
          max={100}
          onChange={(v) => onAlphaChange(v / 100)}
          suffix="%"
        />
      )}

      {/* Eyedropper */}
      {'EyeDropper' in window && (
        <button
          onClick={async () => {
            try {
              // @ts-expect-error EyeDropper API
              const dropper = new window.EyeDropper();
              const result = await dropper.open();
              handleColorChange(result.sRGBHex);
            } catch { /* user cancelled */ }
          }}
          style={actionBtnStyle}
        >
          <Pipette size={12} /> Pick from screen
        </button>
      )}

      {/* Favorites row */}
      {favoriteColors.length > 0 && (
        <div>
          <div style={sectionLabel}>Favorites</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {favoriteColors.map((f) => (
              <SwatchButton key={f.hex} hex={f.hex} selected={f.hex === value} onClick={() => handleColorChange(f.hex)} />
            ))}
          </div>
        </div>
      )}

      {/* Recent colors */}
      {recentColors.length > 0 && (
        <div>
          <div style={sectionLabel}>Recent</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {recentColors.slice(0, 12).map((r) => (
              <SwatchButton key={r.hex} hex={r.hex} selected={r.hex === value} onClick={() => handleColorChange(r.hex)} />
            ))}
          </div>
        </div>
      )}

      {/* Favorite toggle */}
      <button
        onClick={() => toggleFavoriteColor(value)}
        style={{ ...actionBtnStyle, color: isFavorite ? '#EAB308' : '#606070' }}
      >
        <Star size={12} fill={isFavorite ? '#EAB308' : 'none'} />
        {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      </button>

      {/* AI color generation */}
      <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: '8px' }}>
        <div style={sectionLabel}>
          <Sparkles size={10} /> AI Color Generate
        </div>
        {!hasApiKey() ? (
          <div style={{ fontSize: '11px', color: '#505060', fontStyle: 'italic' }}>
            Configure API key in Settings to use AI features
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
                placeholder="e.g. ocean sunset..."
                style={textInputStyle}
              />
              <button
                onClick={handleAiGenerate}
                disabled={aiLoading}
                style={{ ...actionBtnStyle, padding: '4px 8px', opacity: aiLoading ? 0.5 : 1 }}
              >
                {aiLoading ? '...' : 'Go'}
              </button>
            </div>
            {aiError && <div style={{ fontSize: '10px', color: '#EF4444', marginTop: '4px' }}>{aiError}</div>}
            {aiColors.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                {aiColors.map((c, i) => (
                  <SwatchButton key={i} hex={c} selected={c === value} onClick={() => handleColorChange(c)} size={28} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── HSV Square (hue ring + saturation/value square) ─────────────────────────

function HsvSquare({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);
  const hsv = hexToHsv(value);

  const size = 200;
  const sqSize = 140;
  const sqOffset = (size - sqSize) / 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    // Draw hue ring
    const cx = size / 2, cy = size / 2;
    const outerR = size / 2 - 2, innerR = outerR - 14;
    for (let deg = 0; deg < 360; deg++) {
      const rad = (deg * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(cx + innerR * Math.cos(rad), cy + innerR * Math.sin(rad));
      ctx.lineTo(cx + outerR * Math.cos(rad), cy + outerR * Math.sin(rad));
      ctx.strokeStyle = `hsl(${deg}, 100%, 50%)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw SV square
    const baseColor = hsvToHex(hsv.h, 100, 100);
    const imgData = ctx.createImageData(sqSize, sqSize);
    for (let y = 0; y < sqSize; y++) {
      for (let x = 0; x < sqSize; x++) {
        const s = x / sqSize;
        const v = 1 - y / sqSize;
        const c = v * s;
        const xC = c * (1 - Math.abs(((hsv.h / 60) % 2) - 1));
        const m = v - c;
        let r = 0, g = 0, b = 0;
        const sector = Math.floor(hsv.h / 60) % 6;
        if (sector === 0) { r = c; g = xC; }
        else if (sector === 1) { r = xC; g = c; }
        else if (sector === 2) { g = c; b = xC; }
        else if (sector === 3) { g = xC; b = c; }
        else if (sector === 4) { r = xC; b = c; }
        else { r = c; b = xC; }
        const idx = (y * sqSize + x) * 4;
        imgData.data[idx] = Math.round((r + m) * 255);
        imgData.data[idx + 1] = Math.round((g + m) * 255);
        imgData.data[idx + 2] = Math.round((b + m) * 255);
        imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, sqOffset, sqOffset);

    // Draw SV cursor
    const curX = sqOffset + (hsv.s / 100) * sqSize;
    const curY = sqOffset + (1 - hsv.v / 100) * sqSize;
    ctx.beginPath();
    ctx.arc(curX, curY, 5, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(curX, curY, 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [value, hsv.h, hsv.s, hsv.v]);

  const handleMouse = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if in SV square
    if (x >= sqOffset && x <= sqOffset + sqSize && y >= sqOffset && y <= sqOffset + sqSize) {
      const s = Math.max(0, Math.min(100, ((x - sqOffset) / sqSize) * 100));
      const v = Math.max(0, Math.min(100, (1 - (y - sqOffset) / sqSize) * 100));
      onChange(hsvToHex(hsv.h, Math.round(s), Math.round(v)));
      return;
    }

    // Check if in hue ring
    const cx = size / 2, cy = size / 2;
    const dx = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const outerR = size / 2 - 2, innerR = outerR - 14;
    if (dist >= innerR && dist <= outerR) {
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      if (angle < 0) angle += 360;
      onChange(hsvToHex(Math.round(angle), hsv.s, hsv.v));
    }
  }, [hsv, onChange]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: `${size}px`, height: `${size}px`, cursor: 'crosshair', borderRadius: '8px' }}
      onMouseDown={(e) => { dragging.current = true; handleMouse(e); }}
      onMouseMove={(e) => { if (dragging.current) handleMouse(e); }}
      onMouseUp={() => { dragging.current = false; }}
      onMouseLeave={() => { dragging.current = false; }}
    />
  );
}

// ─── Slider components ───────────────────────────────────────────────────────

function HsvSliders({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const { h, s, v } = hexToHsv(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <SliderRow label="H" value={h} min={0} max={360} onChange={(val) => onChange(hsvToHex(val, s, v))} suffix="°" />
      <SliderRow label="S" value={s} min={0} max={100} onChange={(val) => onChange(hsvToHex(h, val, v))} suffix="%" />
      <SliderRow label="V" value={v} min={0} max={100} onChange={(val) => onChange(hsvToHex(h, s, val))} suffix="%" />
    </div>
  );
}

function HslSliders({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const { h, s, l } = hexToHsl(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <SliderRow label="H" value={h} min={0} max={360} onChange={(val) => onChange(hslToHex(val, s, l))} suffix="°" />
      <SliderRow label="S" value={s} min={0} max={100} onChange={(val) => onChange(hslToHex(h, val, l))} suffix="%" />
      <SliderRow label="L" value={l} min={0} max={100} onChange={(val) => onChange(hslToHex(h, s, val))} suffix="%" />
    </div>
  );
}

function RgbSliders({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const { r, g, b } = hexToRgb(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <SliderRow label="R" value={r} min={0} max={255} onChange={(val) => onChange(rgbToHex(val, g, b))} />
      <SliderRow label="G" value={g} min={0} max={255} onChange={(val) => onChange(rgbToHex(r, val, b))} />
      <SliderRow label="B" value={b} min={0} max={255} onChange={(val) => onChange(rgbToHex(r, g, val))} />
    </div>
  );
}

function SliderRow({ label, value, min, max, onChange, suffix = '' }: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '10px', color: '#808090', fontWeight: 600, width: '14px' }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{ flex: 1, height: '4px', accentColor: '#3B82F6' }}
      />
      <span style={{ fontSize: '10px', color: '#a0a0b0', width: '36px', textAlign: 'right', fontFamily: 'monospace' }}>
        {value}{suffix}
      </span>
    </div>
  );
}

function HexInput({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  useEffect(() => { if (!editing) setText(value); }, [value, editing]);

  const handleSubmit = () => {
    setEditing(false);
    const hex = text.startsWith('#') ? text : `#${text}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      onChange(hex.toUpperCase());
    } else {
      setText(value);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: '24px', height: '24px', borderRadius: '4px',
        backgroundColor: value, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0,
      }} />
      <input
        value={editing ? text : value}
        onChange={(e) => { setEditing(true); setText(e.target.value); }}
        onBlur={handleSubmit}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        onFocus={() => setEditing(true)}
        style={{ ...textInputStyle, fontFamily: 'monospace', flex: 1 }}
      />
    </div>
  );
}

function SwatchButton({ hex, selected, onClick, size = 22 }: {
  hex: string; selected: boolean; onClick: () => void; size?: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: `${size}px`, height: `${size}px`, borderRadius: '4px',
        backgroundColor: hex, border: selected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
        cursor: 'pointer', padding: 0, flexShrink: 0,
      }}
    />
  );
}

// ─── Shared styles ───────────────────────────────────────────────────────────

const sectionLabel: React.CSSProperties = {
  fontSize: '10px', color: '#606070', fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px',
};

const actionBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px',
  background: 'none', border: '1px solid #2a2a3e', borderRadius: '4px',
  color: '#808090', fontSize: '11px', cursor: 'pointer', width: '100%', justifyContent: 'center',
};

const textInputStyle: React.CSSProperties = {
  background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '4px',
  color: '#e0e0e0', fontSize: '11px', padding: '4px 8px', outline: 'none', flex: 1,
};
