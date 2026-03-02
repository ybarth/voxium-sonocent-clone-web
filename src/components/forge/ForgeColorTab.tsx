import { useState } from 'react';
import { generateColorFromText, hasApiKey } from '../../utils/aiGeneration';
import { useProjectStore } from '../../stores/projectStore';

interface ForgeColorTabProps {
  onGenerated?: () => void;
}

export function ForgeColorTab({ onGenerated }: ForgeColorTabProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedColors, setGeneratedColors] = useState<string[]>([]);

  const scheme = useProjectStore((s) => s.project.scheme);
  const updateFormInScheme = useProjectStore((s) => s.updateFormInScheme);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (!hasApiKey()) {
      setError('OpenAI API key not configured. Set it in Settings > AI Configuration.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const colors = await generateColorFromText(prompt);
      setGeneratedColors(colors);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyToScheme = () => {
    // Apply generated colors to the first N forms in the active scheme
    generatedColors.forEach((hex, i) => {
      if (i < scheme.forms.length) {
        updateFormInScheme(scheme.id, scheme.forms[i].id, {
          color: { hex, alpha: 1 },
        });
      }
    });
    onGenerated?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '12px', color: '#a0a0b0' }}>
        Describe a mood, theme, or context to generate a color palette.
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. warm sunset, professional corporate, deep ocean..."
        style={{
          background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '6px',
          color: '#e0e0e0', padding: '8px', fontSize: '12px', outline: 'none',
          minHeight: '60px', resize: 'vertical', fontFamily: 'inherit',
        }}
      />

      <button
        onClick={handleGenerate}
        disabled={loading || !prompt.trim()}
        style={{
          padding: '8px 14px', backgroundColor: loading ? '#1a1a2e' : '#3B82F6',
          border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px',
          fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
          opacity: !prompt.trim() ? 0.5 : 1,
        }}
      >
        {loading ? 'Generating...' : 'Generate Colors'}
      </button>

      {error && (
        <div style={{ fontSize: '11px', color: '#EF4444', padding: '4px 0' }}>
          {error}
        </div>
      )}

      {generatedColors.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', color: '#808090', fontWeight: 600 }}>
            Generated Palette
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {generatedColors.map((hex, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '6px',
                  backgroundColor: hex, border: '1px solid rgba(255,255,255,0.1)',
                }} />
                <span style={{ fontSize: '9px', color: '#606070', fontFamily: 'monospace' }}>
                  {hex}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={handleApplyToScheme}
            style={{
              padding: '6px 12px', backgroundColor: 'rgba(34,197,94,0.15)',
              border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px',
              color: '#22C55E', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Apply to Active Scheme
          </button>
        </div>
      )}
    </div>
  );
}
