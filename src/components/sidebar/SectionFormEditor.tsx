import { useState, useEffect, useRef } from 'react';
import { X, Upload, Sparkles } from 'lucide-react';
import type { SectionForm, ColorAttribute, TextureAttribute, SectionSoundAttribute, VoiceAttribute } from '../../types/scheme';
import type { TextureRef, BuiltinTextureId } from '../../types';
import { BUILTIN_TEXTURES, getTextureCss } from '../../utils/textures';
import { hexToHsl, isHighSaturation, enforceMinSaturation } from '../../utils/colorUtils';
import { generateTextureFromText, hasApiKey } from '../../utils/aiGeneration';
import { SectionSoundPicker } from './SectionSoundPicker';
import { VoicePicker } from './VoicePicker';

interface SectionFormEditorProps {
  form: SectionForm;
  onSave: (updates: Partial<SectionForm>) => void;
  onClose: () => void;
}

type Tab = 'color' | 'texture' | 'sound' | 'voice';

export function SectionFormEditor({ form, onSave, onClose }: SectionFormEditorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('color');
  const [label, setLabel] = useState(form.label);
  const [colorHex, setColorHex] = useState(form.color?.hex ?? '#808080');
  const [colorAlpha, setColorAlpha] = useState(form.color?.alpha ?? 1);
  // Texture enabled by default
  const [textureEnabled, setTextureEnabled] = useState(true);
  const [textureType, setTextureType] = useState<'builtin' | 'custom' | 'ai'>(
    form.texture?.textureRef.type ?? 'builtin'
  );
  const [textureId, setTextureId] = useState<BuiltinTextureId>(
    form.texture?.textureRef.builtinId ?? 'stripes-diag-right'
  );
  const [textureOpacity, setTextureOpacity] = useState(form.texture?.textureRef.opacity ?? 0.5);
  const [textureScale, setTextureScale] = useState(form.texture?.textureRef.scale ?? 1);
  const [customImageUrl, setCustomImageUrl] = useState(form.texture?.textureRef.imageUrl ?? '');
  const [sound, setSound] = useState<SectionSoundAttribute | undefined>(form.sound);
  const [voice, setVoice] = useState<VoiceAttribute | undefined>(form.voice);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI texture state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiPreview, setAiPreview] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const hsl = hexToHsl(colorHex);
  const highSat = isHighSaturation(colorHex);

  const handleAutoFix = () => {
    setColorHex(enforceMinSaturation(colorHex));
  };

  // Build the current TextureRef for previews
  const currentTextureRef: TextureRef | null = textureEnabled
    ? textureType === 'builtin'
      ? { type: 'builtin', builtinId: textureId, opacity: textureOpacity, scale: textureScale }
      : (textureType === 'custom' || textureType === 'ai') && customImageUrl
        ? { type: textureType, imageUrl: customImageUrl, opacity: textureOpacity, scale: textureScale }
        : null
    : null;

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCustomImageUrl(dataUrl);
      setTextureType('custom');
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
      setCustomImageUrl(aiPreview);
      setTextureType('ai');
      setAiPreview(null);
    }
  };

  const handleSave = () => {
    const color: ColorAttribute = { hex: colorHex, alpha: colorAlpha };
    let texture: TextureAttribute | undefined;
    if (textureEnabled && currentTextureRef) {
      texture = { textureRef: currentTextureRef };
    }
    onSave({ label, color, texture, sound, voice });
    onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      }}
    >
      <div style={{
        width: '420px', maxWidth: '90vw', maxHeight: '85vh',
        backgroundColor: '#0d0d18', border: '1px solid #1a1a2e',
        borderRadius: '12px', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid #1a1a2e',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Live header swatch with texture */}
            <div style={{
              width: '14px', height: '14px', borderRadius: '3px',
              backgroundColor: colorHex, position: 'relative', overflow: 'hidden',
            }}>
              {currentTextureRef && (
                <div style={{ position: 'absolute', inset: 0, ...getTextureCss(currentTextureRef, colorHex) }} />
              )}
            </div>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              style={{
                background: 'transparent', border: 'none', color: '#e0e0e0',
                fontSize: '14px', fontWeight: 600, outline: 'none', width: '200px',
              }}
            />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#808090', cursor: 'pointer', padding: '4px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs — Color + Texture only */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1a1a2e', padding: '0 16px' }}>
          {(['color', 'texture', 'sound', 'voice'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none', border: 'none',
                borderBottom: activeTab === tab ? '2px solid #3B82F6' : '2px solid transparent',
                color: activeTab === tab ? '#e0e0e0' : '#606070',
                fontSize: '12px', fontWeight: 600, padding: '8px 14px',
                cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          {activeTab === 'color' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="color"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  style={{ width: '40px', height: '32px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
                />
                <input
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  style={{
                    background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '6px',
                    color: '#e0e0e0', padding: '4px 8px', fontSize: '12px', width: '80px', outline: 'none',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              {/* Alpha slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#606070' }}>Alpha</span>
                <input
                  type="range" min={0} max={1} step={0.05} value={colorAlpha}
                  onChange={(e) => setColorAlpha(parseFloat(e.target.value))}
                  style={{ flex: 1, accentColor: '#3B82F6' }}
                />
                <span style={{ fontSize: '11px', color: '#606070', minWidth: '30px', textAlign: 'right' }}>
                  {Math.round(colorAlpha * 100)}%
                </span>
              </div>

              {/* Saturation indicator */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 10px', borderRadius: '6px',
                backgroundColor: highSat ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.08)',
                border: highSat ? '1px solid rgba(34,197,94,0.15)' : '1px solid rgba(245,158,11,0.2)',
              }}>
                <span style={{ fontSize: '11px', color: '#808090' }}>
                  HSL: {hsl.h}° {hsl.s}% {hsl.l}%
                </span>
                <span style={{
                  fontSize: '10px', fontWeight: 600,
                  padding: '2px 6px', borderRadius: '4px',
                  backgroundColor: highSat ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                  color: highSat ? '#22C55E' : '#F59E0B',
                }}>
                  S: {hsl.s}%
                </span>
                {!highSat && (
                  <>
                    <span style={{ fontSize: '10px', color: '#F59E0B', fontStyle: 'italic' }}>
                      Low saturation
                    </span>
                    <button
                      onClick={handleAutoFix}
                      style={{
                        fontSize: '10px', fontWeight: 600, color: '#F59E0B',
                        backgroundColor: 'rgba(245,158,11,0.15)',
                        border: '1px solid rgba(245,158,11,0.3)',
                        borderRadius: '4px', padding: '2px 8px', cursor: 'pointer',
                        marginLeft: 'auto',
                      }}
                    >
                      Auto-fix
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'texture' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Enable toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#a0a0b0' }}>Enable Texture</span>
                <button
                  onClick={() => setTextureEnabled(!textureEnabled)}
                  style={{
                    width: '36px', height: '20px', borderRadius: '10px', border: 'none',
                    backgroundColor: textureEnabled ? '#3B82F6' : '#2a2a3e', cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#e0e0e0',
                    position: 'absolute', top: '3px', left: textureEnabled ? '19px' : '3px',
                    transition: 'left 0.2s',
                  }} />
                </button>
              </div>

              {textureEnabled && (
                <>
                  {/* Built-in texture grid with visual previews */}
                  <div style={{ fontSize: '10px', color: '#606070', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Built-in Textures
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                    {BUILTIN_TEXTURES.map((tex) => {
                      const isActive = textureType === 'builtin' && textureId === tex.id;
                      const previewRef: TextureRef = { type: 'builtin', builtinId: tex.id, opacity: 1, scale: 1 };
                      const cssProps = getTextureCss(previewRef, colorHex);
                      return (
                        <button
                          key={tex.id}
                          onClick={() => { setTextureId(tex.id); setTextureType('builtin'); }}
                          title={tex.label}
                          style={{
                            width: '100%', aspectRatio: '1', borderRadius: '4px',
                            border: isActive ? '2px solid #3B82F6' : '1px solid #2a2a3e',
                            backgroundColor: colorHex, cursor: 'pointer',
                            position: 'relative', overflow: 'hidden', padding: 0,
                          }}
                        >
                          <div style={{ position: 'absolute', inset: 0, ...cssProps }} />
                        </button>
                      );
                    })}
                  </div>

                  {/* Upload custom texture */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px',
                      background: 'none', border: '1px solid #2a2a3e', borderRadius: '4px',
                      color: '#808090', fontSize: '11px', cursor: 'pointer', justifyContent: 'center',
                    }}
                  >
                    <Upload size={12} /> Upload Custom Texture (PNG)
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleCustomUpload}
                    style={{ display: 'none' }}
                  />

                  {/* Opacity slider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: '#606070', fontWeight: 600, width: '50px' }}>Opacity</span>
                    <input
                      type="range" min={10} max={100}
                      value={Math.round(textureOpacity * 100)}
                      onChange={(e) => setTextureOpacity(parseInt(e.target.value) / 100)}
                      style={{ flex: 1, accentColor: '#3B82F6' }}
                    />
                    <span style={{ fontSize: '10px', color: '#606070', width: '30px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {Math.round(textureOpacity * 100)}%
                    </span>
                  </div>

                  {/* Scale slider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: '#606070', fontWeight: 600, width: '50px' }}>Scale</span>
                    <input
                      type="range" min={50} max={300}
                      value={Math.round(textureScale * 100)}
                      onChange={(e) => setTextureScale(parseInt(e.target.value) / 100)}
                      style={{ flex: 1, accentColor: '#3B82F6' }}
                    />
                    <span style={{ fontSize: '10px', color: '#606070', width: '30px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {textureScale.toFixed(1)}x
                    </span>
                  </div>

                  {/* Live preview */}
                  {currentTextureRef && (
                    <div>
                      <div style={{ fontSize: '10px', color: '#606070', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                        Preview
                      </div>
                      <div style={{
                        width: '100%', height: '32px', borderRadius: '6px',
                        backgroundColor: colorHex, position: 'relative', overflow: 'hidden',
                      }}>
                        <div style={{ position: 'absolute', inset: 0, ...getTextureCss(currentTextureRef, colorHex) }} />
                      </div>
                    </div>
                  )}

                  {/* AI texture generation */}
                  <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: '8px' }}>
                    <div style={{
                      fontSize: '10px', color: '#606070', fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.05em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px',
                    }}>
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
                            placeholder="e.g. woven fabric, marble..."
                            style={{
                              background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '4px',
                              color: '#e0e0e0', fontSize: '11px', padding: '4px 8px', outline: 'none', flex: 1,
                            }}
                          />
                          <button
                            onClick={handleAiGenerate}
                            disabled={aiLoading}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px',
                              background: 'none', border: '1px solid #2a2a3e', borderRadius: '4px',
                              color: '#808090', fontSize: '11px', cursor: aiLoading ? 'wait' : 'pointer',
                              opacity: aiLoading ? 0.5 : 1,
                            }}
                          >
                            {aiLoading ? '...' : 'Go'}
                          </button>
                        </div>
                        {aiError && <div style={{ fontSize: '10px', color: '#EF4444', marginTop: '4px' }}>{aiError}</div>}
                        {aiPreview && (
                          <div style={{ marginTop: '6px' }}>
                            <div style={{
                              width: '100%', height: '48px', borderRadius: '6px',
                              backgroundImage: `url(${aiPreview})`, backgroundSize: '64px',
                              backgroundRepeat: 'repeat', border: '1px solid #2a2a3e',
                            }} />
                            <button
                              onClick={handleAiAccept}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px',
                                background: 'none', border: '1px solid #2a2a3e', borderRadius: '4px',
                                color: '#22C55E', fontSize: '11px', cursor: 'pointer',
                                justifyContent: 'center', width: '100%', marginTop: '4px',
                              }}
                            >
                              Accept
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'sound' && (
            <SectionSoundPicker value={sound} onChange={setSound} />
          )}

          {activeTab === 'voice' && (
            <VoicePicker value={voice} onChange={setVoice} />
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid #1a1a2e',
          display: 'flex', justifyContent: 'flex-end', gap: '8px',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px', background: 'none', border: '1px solid #2a2a3e',
              borderRadius: '6px', color: '#808090', fontSize: '12px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '6px 14px', backgroundColor: '#3B82F6', border: 'none',
              borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
