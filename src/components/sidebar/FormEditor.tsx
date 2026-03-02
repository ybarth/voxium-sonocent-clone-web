import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import type { Form, ColorAttribute, TextureAttribute, ShapeAttribute, SoundAttribute, BuiltinShapeId } from '../../types/scheme';
import { ShapePicker } from './ShapePicker';
import { SoundPicker } from './SoundPicker';
import { BUILTIN_TEXTURES } from '../../utils/textures';
import { generateFormAttributesFromText, hasApiKey } from '../../utils/aiGeneration';

interface FormEditorProps {
  form: Form;
  onSave: (updates: Partial<Form>) => void;
  onClose: () => void;
}

type Tab = 'color' | 'texture' | 'shape' | 'sound';

export function FormEditor({ form, onSave, onClose }: FormEditorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('color');
  const [label, setLabel] = useState(form.label);
  const [colorHex, setColorHex] = useState(form.color?.hex ?? '#808080');
  const [colorAlpha, setColorAlpha] = useState(form.color?.alpha ?? 1);
  const [textureEnabled, setTextureEnabled] = useState(!!form.texture);
  const [textureId, setTextureId] = useState(form.texture?.textureRef.builtinId ?? 'stripes-horiz');
  const [textureOpacity, setTextureOpacity] = useState(form.texture?.textureRef.opacity ?? 0.3);
  const [shapeId, setShapeId] = useState<BuiltinShapeId>(form.shape?.builtinId ?? 'default');
  const [sound, setSound] = useState<SoundAttribute | undefined>(form.sound);
  const overlayRef = useRef<HTMLDivElement>(null);

  // AI Suggest state
  const [aiExpanded, setAiExpanded] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<{
    label?: string; color?: string; shape?: string; reasoning?: string;
  } | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError('');
    setAiSuggestion(null);
    try {
      const result = await generateFormAttributesFromText(aiPrompt, label);
      setAiSuggestion(result);
    } catch (e: any) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyAiSuggestion = () => {
    if (!aiSuggestion) return;
    if (aiSuggestion.label) setLabel(aiSuggestion.label);
    if (aiSuggestion.color && /^#[0-9A-Fa-f]{6}$/.test(aiSuggestion.color)) {
      setColorHex(aiSuggestion.color);
    }
    if (aiSuggestion.shape) {
      const validShapes: BuiltinShapeId[] = ['default', 'sharp', 'rounded', 'tapered', 'scalloped', 'notched', 'wave', 'chevron'];
      if (validShapes.includes(aiSuggestion.shape as BuiltinShapeId)) {
        setShapeId(aiSuggestion.shape as BuiltinShapeId);
      }
    }
  };

  const handleSave = () => {
    const color: ColorAttribute = { hex: colorHex, alpha: colorAlpha, gradient: form.color?.gradient };
    const texture: TextureAttribute | undefined = textureEnabled
      ? { textureRef: { type: 'builtin', builtinId: textureId as any, opacity: textureOpacity, scale: 1 } }
      : undefined;
    const shape: ShapeAttribute | undefined = shapeId !== 'default'
      ? { builtinId: shapeId }
      : undefined;

    onSave({
      label,
      color,
      texture,
      shape,
      sound,
    });
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
        width: '420px', maxWidth: '90vw', maxHeight: '80vh',
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
            <div style={{ width: '14px', height: '14px', borderRadius: '3px', backgroundColor: colorHex }} />
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

        {/* AI Suggest Panel */}
        {hasApiKey() && (
          <div style={{ borderBottom: '1px solid #1a1a2e' }}>
            <button
              onClick={() => setAiExpanded((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
                padding: '8px 16px', background: 'none', border: 'none',
                color: '#A78BFA', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Sparkles size={12} />
              AI Suggest
              {aiExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            </button>
            {aiExpanded && (
              <div style={{ padding: '0 16px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && aiPrompt.trim()) handleAiGenerate(); }}
                    placeholder="e.g. urgent warning, calm narration..."
                    style={{
                      flex: 1, background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '6px',
                      color: '#e0e0e0', padding: '5px 8px', fontSize: '11px', outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleAiGenerate}
                    disabled={aiLoading || !aiPrompt.trim()}
                    style={{
                      padding: '5px 10px', backgroundColor: aiLoading ? '#1a1a2e' : '#8B5CF6',
                      border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px',
                      fontWeight: 600, cursor: aiLoading ? 'wait' : 'pointer',
                      opacity: !aiPrompt.trim() ? 0.5 : 1,
                    }}
                  >
                    {aiLoading ? '...' : 'Go'}
                  </button>
                </div>

                {aiError && (
                  <div style={{ fontSize: '10px', color: '#EF4444' }}>{aiError}</div>
                )}

                {aiSuggestion && (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: '6px',
                    padding: '8px', backgroundColor: 'rgba(139,92,246,0.06)',
                    border: '1px solid rgba(139,92,246,0.15)', borderRadius: '6px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {aiSuggestion.color && (
                        <div style={{
                          width: '18px', height: '18px', borderRadius: '4px',
                          backgroundColor: aiSuggestion.color, flexShrink: 0,
                          border: '1px solid rgba(255,255,255,0.1)',
                        }} />
                      )}
                      {aiSuggestion.label && (
                        <span style={{ fontSize: '12px', color: '#c0c0d0', fontWeight: 600 }}>
                          {aiSuggestion.label}
                        </span>
                      )}
                      {aiSuggestion.shape && aiSuggestion.shape !== 'default' && (
                        <span style={{
                          fontSize: '9px', color: '#8B5CF6',
                          backgroundColor: 'rgba(139,92,246,0.1)',
                          padding: '1px 6px', borderRadius: '3px',
                        }}>
                          {aiSuggestion.shape}
                        </span>
                      )}
                    </div>
                    {aiSuggestion.reasoning && (
                      <div style={{ fontSize: '10px', color: '#606070', fontStyle: 'italic' }}>
                        {aiSuggestion.reasoning}
                      </div>
                    )}
                    <button
                      onClick={handleApplyAiSuggestion}
                      style={{
                        padding: '4px 10px', backgroundColor: 'rgba(139,92,246,0.2)',
                        border: '1px solid rgba(139,92,246,0.3)', borderRadius: '4px',
                        color: '#A78BFA', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                        alignSelf: 'flex-start',
                      }}
                    >
                      Apply Suggestions
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1a1a2e', padding: '0 16px' }}>
          {(['color', 'texture', 'shape', 'sound'] as Tab[]).map((tab) => (
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
            </div>
          )}

          {activeTab === 'texture' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                    {BUILTIN_TEXTURES.map((tex) => (
                      <button
                        key={tex.id}
                        onClick={() => setTextureId(tex.id)}
                        style={{
                          padding: '4px', fontSize: '9px',
                          backgroundColor: textureId === tex.id ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)',
                          border: textureId === tex.id ? '1px solid rgba(59,130,246,0.4)' : '1px solid #1a1a2e',
                          borderRadius: '4px', color: textureId === tex.id ? '#93c5fd' : '#606070',
                          cursor: 'pointer',
                        }}
                      >
                        {tex.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: '#606070' }}>Opacity</span>
                    <input
                      type="range" min={0.1} max={1} step={0.05} value={textureOpacity}
                      onChange={(e) => setTextureOpacity(parseFloat(e.target.value))}
                      style={{ flex: 1, accentColor: '#3B82F6' }}
                    />
                    <span style={{ fontSize: '10px', color: '#606070' }}>{Math.round(textureOpacity * 100)}%</span>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'shape' && (
            <ShapePicker
              selectedId={shapeId}
              onSelect={setShapeId}
              previewColor={colorHex}
            />
          )}

          {activeTab === 'sound' && (
            <SoundPicker value={sound} onChange={setSound} />
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
