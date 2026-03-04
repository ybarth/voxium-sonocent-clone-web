import { useState } from 'react';
import { generateColorFromText, hasApiKey } from '../../utils/aiGeneration';
import { useProjectStore } from '../../stores/projectStore';
import { IterationPanel } from './IterationPanel';

interface ForgeColorTabProps {
  onGenerated?: () => void;
}

export function ForgeColorTab({ onGenerated }: ForgeColorTabProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedColors, setGeneratedColors] = useState<string[]>([]);
  const [showIteration, setShowIteration] = useState(false);

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

          <div style={{ display: 'flex', gap: '6px' }}>
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
        </div>
      )}

      {/* Iterate button */}
      <button
        onClick={() => setShowIteration(!showIteration)}
        style={{
          padding: '5px 10px', background: showIteration ? '#8B5CF615' : 'none',
          border: `1px solid ${showIteration ? '#8B5CF650' : '#2a2a3e'}`,
          borderRadius: '4px', color: showIteration ? '#8B5CF6' : '#606070',
          fontSize: '10px', cursor: 'pointer', alignSelf: 'flex-start',
        }}
      >
        {showIteration ? 'Hide Iteration Mode' : 'Iteration Mode'}
      </button>

      {showIteration && prompt.trim() && (
        <IterationPanel
          taskCategory="color-generation"
          systemMessage="You are a color palette generator. Given a description, return 5 hex color codes that match the mood/theme. Return ONLY a JSON array of hex strings like [&quot;#FF0000&quot;,&quot;#00FF00&quot;]. No other text."
          initialPrompt={prompt}
          onAccept={(content) => {
            try {
              const colors = JSON.parse(content);
              if (Array.isArray(colors)) {
                setGeneratedColors(colors.filter((c: unknown) => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c as string)));
              }
            } catch {
              const matches = content.match(/#[0-9A-Fa-f]{6}/g);
              if (matches) setGeneratedColors(matches.slice(0, 5));
            }
          }}
          renderPreview={(content) => {
            let colors: string[] = [];
            try {
              const parsed = JSON.parse(content);
              if (Array.isArray(parsed)) colors = parsed.filter((c: unknown) => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c as string));
            } catch {
              const matches = content.match(/#[0-9A-Fa-f]{6}/g);
              if (matches) colors = matches.slice(0, 5);
            }
            if (colors.length === 0) return <div style={{ fontSize: '10px', color: '#808090' }}>{content.slice(0, 200)}</div>;
            return (
              <div style={{ display: 'flex', gap: '4px' }}>
                {colors.map((hex, i) => (
                  <div key={i} style={{
                    width: '24px', height: '24px', borderRadius: '4px',
                    backgroundColor: hex, border: '1px solid rgba(255,255,255,0.1)',
                  }} title={hex} />
                ))}
              </div>
            );
          }}
        />
      )}
    </div>
  );
}
