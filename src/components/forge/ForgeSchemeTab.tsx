import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { generateSchemeFromText, hasApiKey } from '../../utils/aiGeneration';
import { useProjectStore } from '../../stores/projectStore';
import type { Form, Scheme } from '../../types/scheme';
import type { BuiltinShapeId } from '../../types/scheme';

interface ForgeSchemeTabProps {
  onGenerated?: () => void;
}

export function ForgeSchemeTab({ onGenerated }: ForgeSchemeTabProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedScheme, setGeneratedScheme] = useState<{
    labels: string[];
    colors: string[];
    shapes: BuiltinShapeId[];
  } | null>(null);
  const [schemeName, setSchemeName] = useState('');

  const addScheme = useProjectStore((s) => s.addScheme);
  const setActiveScheme = useProjectStore((s) => s.setActiveScheme);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (!hasApiKey()) {
      setError('OpenAI API key not configured. Set it in Settings > AI Configuration.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await generateSchemeFromText(prompt);
      setGeneratedScheme(result);
      setSchemeName(`Forge: ${prompt.slice(0, 30)}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAsScheme = () => {
    if (!generatedScheme) return;
    const schemeId = uuid();
    const forms: Form[] = generatedScheme.labels.map((label, i) => ({
      id: uuid(),
      label,
      shortcutKey: i < 9 ? i + 1 : 0,
      color: {
        hex: generatedScheme.colors[i] ?? '#808080',
        alpha: 1,
      },
      shape: generatedScheme.shapes[i]
        ? { builtinId: generatedScheme.shapes[i] }
        : undefined,
    }));

    const scheme: Scheme = {
      id: schemeId,
      name: schemeName || `Forge: ${prompt.slice(0, 30)}`,
      builtIn: false,
      forms,
    };

    addScheme(scheme);
    setActiveScheme(schemeId);
    onGenerated?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '12px', color: '#a0a0b0' }}>
        Describe your use case and the AI will generate a complete scheme with
        labels, colors, and shapes.
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. university lecture with key points, questions, and examples..."
        style={{
          background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '6px',
          color: '#e0e0e0', padding: '8px', fontSize: '12px', outline: 'none',
          minHeight: '80px', resize: 'vertical', fontFamily: 'inherit',
        }}
      />

      <button
        onClick={handleGenerate}
        disabled={loading || !prompt.trim()}
        style={{
          padding: '8px 14px', backgroundColor: loading ? '#1a1a2e' : '#8B5CF6',
          border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px',
          fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
          opacity: !prompt.trim() ? 0.5 : 1,
        }}
      >
        {loading ? 'Generating Scheme...' : 'Generate Full Scheme'}
      </button>

      {error && (
        <div style={{ fontSize: '11px', color: '#EF4444', padding: '4px 0' }}>
          {error}
        </div>
      )}

      {generatedScheme && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', color: '#808090', fontWeight: 600 }}>
            Generated Scheme ({generatedScheme.labels.length} forms)
          </div>
          <input
            value={schemeName}
            onChange={(e) => setSchemeName(e.target.value)}
            placeholder="Scheme name..."
            style={{
              background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '6px',
              color: '#e0e0e0', padding: '5px 8px', fontSize: '12px', outline: 'none',
              fontWeight: 600,
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {generatedScheme.labels.map((label, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '4px 8px', borderRadius: '4px',
                backgroundColor: 'rgba(255,255,255,0.02)',
              }}>
                <div style={{
                  width: '16px', height: '16px', borderRadius: '3px',
                  backgroundColor: generatedScheme.colors[i] ?? '#808080',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: '11px', color: '#c0c0d0', flex: 1 }}>
                  {label}
                </span>
                {generatedScheme.shapes[i] && generatedScheme.shapes[i] !== 'default' && (
                  <span style={{ fontSize: '9px', color: '#505060' }}>
                    {generatedScheme.shapes[i]}
                  </span>
                )}
                <span style={{
                  fontSize: '9px', color: '#505060', fontFamily: 'monospace',
                  backgroundColor: 'rgba(255,255,255,0.05)', padding: '1px 4px',
                  borderRadius: '3px',
                }}>
                  {i < 9 ? i + 1 : '-'}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={handleApplyAsScheme}
            style={{
              padding: '8px 14px', backgroundColor: 'rgba(139,92,246,0.2)',
              border: '1px solid rgba(139,92,246,0.4)', borderRadius: '6px',
              color: '#A78BFA', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Apply as Active Scheme
          </button>
        </div>
      )}
    </div>
  );
}
