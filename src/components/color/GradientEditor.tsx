import { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { GradientDef, GradientStop, GradientDirection } from '../../types';
import { getGradientCss } from '../../utils/textures';
import { ColorPicker } from './ColorPicker';

interface GradientEditorProps {
  value: GradientDef | null;
  enabled: boolean;
  onChange: (gradient: GradientDef | null) => void;
  onToggle: (enabled: boolean) => void;
}

const DEFAULT_GRADIENT: GradientDef = {
  stops: [
    { color: '#3B82F6', position: 0 },
    { color: '#8B5CF6', position: 1 },
  ],
  direction: 'to-right',
};

export function GradientEditor({ value, enabled, onChange, onToggle }: GradientEditorProps) {
  const [selectedStop, setSelectedStop] = useState(0);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const draggingStop = useRef<number | null>(null);

  const gradient = value ?? DEFAULT_GRADIENT;
  const sortedStops = [...gradient.stops].sort((a, b) => a.position - b.position);

  const handleToggle = () => {
    if (!enabled) {
      onToggle(true);
      if (!value) onChange(DEFAULT_GRADIENT);
    } else {
      onToggle(false);
    }
  };

  const handleDirectionChange = (dir: GradientDirection) => {
    onChange({ ...gradient, direction: dir });
  };

  const handleStopMove = useCallback((e: MouseEvent) => {
    if (draggingStop.current === null || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newStops = [...gradient.stops];
    newStops[draggingStop.current] = { ...newStops[draggingStop.current], position: pos };
    onChange({ ...gradient, stops: newStops });
  }, [gradient, onChange]);

  const handleMouseUp = useCallback(() => {
    draggingStop.current = null;
    window.removeEventListener('mousemove', handleStopMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleStopMove]);

  const handleStopMouseDown = (idx: number) => {
    draggingStop.current = idx;
    setSelectedStop(idx);
    window.addEventListener('mousemove', handleStopMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleBarClick = (e: React.MouseEvent) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    // Don't add if clicking near an existing stop
    const nearStop = gradient.stops.some((s) => Math.abs(s.position - pos) < 0.05);
    if (nearStop) return;

    // Add a new stop with interpolated color
    const newStop: GradientStop = { color: '#808080', position: pos };
    const newStops = [...gradient.stops, newStop];
    onChange({ ...gradient, stops: newStops });
    setSelectedStop(newStops.length - 1);
  };

  const handleRemoveStop = (idx: number) => {
    if (gradient.stops.length <= 2) return;
    const newStops = gradient.stops.filter((_, i) => i !== idx);
    onChange({ ...gradient, stops: newStops });
    setSelectedStop(Math.min(selectedStop, newStops.length - 1));
  };

  const handleStopColorChange = (hex: string) => {
    const newStops = [...gradient.stops];
    if (selectedStop >= 0 && selectedStop < newStops.length) {
      newStops[selectedStop] = { ...newStops[selectedStop], color: hex };
      onChange({ ...gradient, stops: newStops });
    }
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleStopMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleStopMove, handleMouseUp]);

  const directions: { value: GradientDirection; label: string; arrow: string }[] = [
    { value: 'to-right', label: 'Right', arrow: '→' },
    { value: 'to-left', label: 'Left', arrow: '←' },
    { value: 'to-bottom', label: 'Down', arrow: '↓' },
    { value: 'to-top', label: 'Up', arrow: '↑' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '280px' }}>
      {/* Enable toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: '#a0a0b0', fontWeight: 500 }}>Enable Gradient</span>
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
            position: 'absolute', top: '3px', left: enabled ? '19px' : '3px', transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {enabled && (
        <>
          {/* Gradient bar with stop handles */}
          <div style={{ position: 'relative', paddingBottom: '16px' }}>
            <div
              ref={barRef}
              onClick={handleBarClick}
              style={{
                width: '100%',
                height: '24px',
                borderRadius: '6px',
                background: getGradientCss(gradient),
                cursor: 'crosshair',
                border: '1px solid #2a2a3e',
              }}
            />
            {/* Stop handles */}
            {gradient.stops.map((stop, idx) => (
              <div
                key={idx}
                onMouseDown={() => handleStopMouseDown(idx)}
                onDoubleClick={() => { setSelectedStop(idx); setShowColorPicker(true); }}
                onContextMenu={(e) => { e.preventDefault(); handleRemoveStop(idx); }}
                style={{
                  position: 'absolute',
                  left: `${stop.position * 100}%`,
                  top: '20px',
                  transform: 'translateX(-6px)',
                  width: '12px',
                  height: '12px',
                  borderRadius: '2px',
                  backgroundColor: stop.color,
                  border: idx === selectedStop ? '2px solid #fff' : '2px solid #808090',
                  cursor: 'ew-resize',
                  zIndex: 2,
                }}
              />
            ))}
            <div style={{ fontSize: '9px', color: '#505060', marginTop: '14px', textAlign: 'center' }}>
              Click to add stop · Right-click to remove · Drag to move
            </div>
          </div>

          {/* Direction selector */}
          <div>
            <div style={sectionLabel}>Direction</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {directions.map((d) => (
                <button
                  key={d.value}
                  onClick={() => handleDirectionChange(d.value)}
                  style={{
                    flex: 1,
                    padding: '6px',
                    fontSize: '16px',
                    background: gradient.direction === d.value ? '#2a2a3e' : 'transparent',
                    border: gradient.direction === d.value ? '1px solid #3B82F6' : '1px solid #2a2a3e',
                    borderRadius: '4px',
                    color: gradient.direction === d.value ? '#e0e0e0' : '#606070',
                    cursor: 'pointer',
                  }}
                  title={d.label}
                >
                  {d.arrow}
                </button>
              ))}
            </div>
          </div>

          {/* Selected stop color */}
          {selectedStop >= 0 && selectedStop < gradient.stops.length && (
            <div>
              <div style={{ ...sectionLabel, marginBottom: '8px' }}>
                Stop {selectedStop + 1} Color
                {gradient.stops.length > 2 && (
                  <button
                    onClick={() => handleRemoveStop(selectedStop)}
                    style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0 4px' }}
                    title="Remove stop"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
              {showColorPicker ? (
                <>
                  <ColorPicker
                    value={gradient.stops[selectedStop].color}
                    onChange={handleStopColorChange}
                  />
                  <button
                    onClick={() => setShowColorPicker(false)}
                    style={{ ...actionBtnStyle, marginTop: '8px' }}
                  >
                    Done
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '28px', height: '28px', borderRadius: '4px',
                      backgroundColor: gradient.stops[selectedStop].color,
                      border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                    }}
                    onClick={() => setShowColorPicker(true)}
                  />
                  <span style={{ fontSize: '11px', color: '#a0a0b0', fontFamily: 'monospace' }}>
                    {gradient.stops[selectedStop].color}
                  </span>
                  <span style={{ fontSize: '10px', color: '#505060' }}>
                    at {Math.round(gradient.stops[selectedStop].position * 100)}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          <div>
            <div style={sectionLabel}>Preview</div>
            <div
              style={{
                width: '100%', height: '32px', borderRadius: '6px',
                background: getGradientCss(gradient), border: '1px solid #2a2a3e',
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: '10px', color: '#606070', fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px',
};

const actionBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px',
  background: 'none', border: '1px solid #2a2a3e', borderRadius: '4px',
  color: '#808090', fontSize: '11px', cursor: 'pointer', width: '100%', justifyContent: 'center',
};
