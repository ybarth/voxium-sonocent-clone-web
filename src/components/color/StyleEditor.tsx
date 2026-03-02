import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { ChunkStyle, TextureRef, GradientDef } from '../../types';
import { ColorPicker } from './ColorPicker';
import { TexturePicker } from './TexturePicker';
import { GradientEditor } from './GradientEditor';
import { getCompositeCssBackground } from '../../utils/textures';

export type StyleEditorTarget =
  | { type: 'chunks'; ids: string[] }
  | { type: 'section'; sectionId: string }
  | { type: 'colorKey'; index: number };

interface StyleEditorProps {
  initialStyle: ChunkStyle | null;
  initialColor: string; // fallback base color
  target: StyleEditorTarget;
  onApply: (style: ChunkStyle, target: StyleEditorTarget) => void;
  onClose: () => void;
}

export function StyleEditor({ initialStyle, initialColor, target, onApply, onClose }: StyleEditorProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'color' | 'texture' | 'gradient'>('color');

  const [color, setColor] = useState(initialStyle?.color ?? initialColor);
  const [alpha, setAlpha] = useState(initialStyle?.alpha ?? 1);
  const [texture, setTexture] = useState<TextureRef | null>(initialStyle?.texture ?? null);
  const [gradient, setGradient] = useState<GradientDef | null>(initialStyle?.gradient ?? null);
  const [gradientEnabled, setGradientEnabled] = useState(!!initialStyle?.gradient);

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

  const currentStyle: ChunkStyle = {
    color,
    alpha,
    texture,
    gradient: gradientEnabled ? gradient : null,
  };

  const handleApply = () => {
    onApply(currentStyle, target);
    onClose();
  };

  const tabs: { id: 'color' | 'texture' | 'gradient'; label: string }[] = [
    { id: 'color', label: 'Color' },
    { id: 'texture', label: 'Texture' },
    { id: 'gradient', label: 'Gradient' },
  ];

  const targetLabel =
    target.type === 'chunks'
      ? `${target.ids.length} Chunk${target.ids.length !== 1 ? 's' : ''}`
      : target.type === 'section'
      ? 'Section Background'
      : 'Color Key Entry';

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
          width: '380px',
          maxWidth: '95vw',
          maxHeight: '90vh',
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
            padding: '12px 16px',
            borderBottom: '1px solid #1a1a2e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#e0e0e0' }}>
            Style Editor — {targetLabel}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#808090',
              cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1a1a2e', padding: '0 16px' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #3B82F6' : '2px solid transparent',
                color: activeTab === tab.id ? '#e0e0e0' : '#606070',
                fontSize: '12px',
                fontWeight: 600,
                padding: '8px 14px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          {activeTab === 'color' && (
            <ColorPicker
              value={color}
              alpha={alpha}
              onChange={setColor}
              onAlphaChange={setAlpha}
            />
          )}
          {activeTab === 'texture' && (
            <TexturePicker
              value={texture}
              baseColor={color}
              onChange={setTexture}
            />
          )}
          {activeTab === 'gradient' && (
            <GradientEditor
              value={gradient}
              enabled={gradientEnabled}
              onChange={setGradient}
              onToggle={setGradientEnabled}
            />
          )}
        </div>

        {/* Live preview */}
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ fontSize: '10px', color: '#606070', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>
            Preview
          </div>
          <div
            style={{
              width: '100%',
              height: '28px',
              borderRadius: '6px',
              position: 'relative',
              overflow: 'hidden',
              border: '1px solid #2a2a3e',
              ...getCompositeCssBackground(currentStyle),
            }}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #1a1a2e',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button onClick={onClose} style={cancelBtnStyle}>
            Cancel
          </button>
          <button onClick={handleApply} style={applyBtnStyle}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: 'none',
  border: '1px solid #2a2a3e',
  borderRadius: '6px',
  color: '#808090',
  fontSize: '12px',
  cursor: 'pointer',
};

const applyBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: '#3B82F6',
  border: 'none',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};
