import { useState, useRef } from 'react';
import { Upload, Sparkles } from 'lucide-react';
import type { TextureRef, BuiltinTextureId } from '../../types';
import { BUILTIN_TEXTURES, getTextureCss } from '../../utils/textures';
import { generateTextureFromText, hasApiKey } from '../../utils/aiGeneration';

interface TexturePickerProps {
  value: TextureRef | null;
  baseColor: string;
  onChange: (texture: TextureRef | null) => void;
}

export function TexturePicker({ value, baseColor, onChange }: TexturePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiPreview, setAiPreview] = useState<string | null>(null);

  const opacity = value?.opacity ?? 1;
  const scale = value?.scale ?? 1;

  const handleBuiltinSelect = (id: BuiltinTextureId) => {
    onChange({ type: 'builtin', builtinId: id, opacity, scale });
  };

  const handleCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onChange({ type: 'custom', imageUrl: dataUrl, opacity, scale });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError('');
    try {
      const dataUrl = await generateTextureFromText(aiPrompt);
      setAiPreview(dataUrl);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Generation failed');
    }
    setAiLoading(false);
  };

  const handleAiAccept = () => {
    if (aiPreview) {
      onChange({ type: 'ai', imageUrl: aiPreview, opacity, scale });
      setAiPreview(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '280px' }}>
      {/* None / Solid option */}
      <button
        onClick={() => onChange(null)}
        style={{
          padding: '6px 10px',
          background: value === null ? '#2a2a3e' : 'transparent',
          border: '1px solid #2a2a3e',
          borderRadius: '4px',
          color: value === null ? '#e0e0e0' : '#808090',
          fontSize: '12px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        None (Solid Color)
      </button>

      {/* Built-in texture grid */}
      <div>
        <div style={sectionLabel}>Built-in Textures</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
          {BUILTIN_TEXTURES.map((tex) => {
            const isActive = value?.builtinId === tex.id;
            const previewRef: TextureRef = { type: 'builtin', builtinId: tex.id, opacity: 1, scale: 1 };
            const cssProps = getTextureCss(previewRef, baseColor);
            return (
              <button
                key={tex.id}
                onClick={() => handleBuiltinSelect(tex.id)}
                title={tex.label}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  borderRadius: '4px',
                  border: isActive ? '2px solid #3B82F6' : '1px solid #2a2a3e',
                  backgroundColor: baseColor,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  padding: 0,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    ...cssProps,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom upload */}
      <div>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={actionBtnStyle}
        >
          <Upload size={12} /> Upload Custom Texture (PNG)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png"
          onChange={handleCustomUpload}
          style={{ display: 'none' }}
        />
      </div>

      {/* Opacity slider */}
      {value && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: '#808090', fontWeight: 600, width: '50px' }}>Opacity</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(opacity * 100)}
            onChange={(e) => onChange({ ...value, opacity: parseInt(e.target.value) / 100 })}
            style={{ flex: 1, height: '4px', accentColor: '#3B82F6' }}
          />
          <span style={{ fontSize: '10px', color: '#a0a0b0', width: '30px', textAlign: 'right', fontFamily: 'monospace' }}>
            {Math.round(opacity * 100)}%
          </span>
        </div>
      )}

      {/* Scale slider */}
      {value && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: '#808090', fontWeight: 600, width: '50px' }}>Scale</span>
          <input
            type="range"
            min={50}
            max={300}
            value={Math.round(scale * 100)}
            onChange={(e) => onChange({ ...value, scale: parseInt(e.target.value) / 100 })}
            style={{ flex: 1, height: '4px', accentColor: '#3B82F6' }}
          />
          <span style={{ fontSize: '10px', color: '#a0a0b0', width: '30px', textAlign: 'right', fontFamily: 'monospace' }}>
            {scale.toFixed(1)}x
          </span>
        </div>
      )}

      {/* Live preview */}
      {value && (
        <div>
          <div style={sectionLabel}>Preview</div>
          <div
            style={{
              width: '100%',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: baseColor,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, ...getTextureCss(value, baseColor) }} />
          </div>
        </div>
      )}

      {/* AI texture generation */}
      <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: '8px' }}>
        <div style={sectionLabel}>
          <Sparkles size={10} /> AI Texture Generate
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
                placeholder="e.g. woven fabric..."
                style={textInputStyle}
              />
              <button
                onClick={handleAiGenerate}
                disabled={aiLoading}
                style={{ ...actionBtnStyle, padding: '4px 8px', width: 'auto', opacity: aiLoading ? 0.5 : 1 }}
              >
                {aiLoading ? '...' : 'Go'}
              </button>
            </div>
            {aiError && <div style={{ fontSize: '10px', color: '#EF4444', marginTop: '4px' }}>{aiError}</div>}
            {aiPreview && (
              <div style={{ marginTop: '6px' }}>
                <div
                  style={{
                    width: '100%', height: '48px', borderRadius: '6px',
                    backgroundImage: `url(${aiPreview})`, backgroundSize: '64px',
                    backgroundRepeat: 'repeat', border: '1px solid #2a2a3e',
                  }}
                />
                <button onClick={handleAiAccept} style={{ ...actionBtnStyle, marginTop: '4px', color: '#22C55E' }}>
                  Accept
                </button>
              </div>
            )}
          </>
        )}
      </div>
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

const textInputStyle: React.CSSProperties = {
  background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '4px',
  color: '#e0e0e0', fontSize: '11px', padding: '4px 8px', outline: 'none', flex: 1,
};
