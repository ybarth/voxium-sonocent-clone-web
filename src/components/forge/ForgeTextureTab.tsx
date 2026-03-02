import { useState } from 'react';
import { generateTextureFromText, hasApiKey } from '../../utils/aiGeneration';

interface ForgeTextureTabProps {
  onGenerated?: () => void;
}

export function ForgeTextureTab({ onGenerated }: ForgeTextureTabProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedTexture, setGeneratedTexture] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (!hasApiKey()) {
      setError('OpenAI API key not configured. Set it in Settings > AI Configuration.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const dataUrl = await generateTextureFromText(prompt);
      setGeneratedTexture(dataUrl);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '12px', color: '#a0a0b0' }}>
        Describe a texture pattern. DALL-E will generate a tileable texture.
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. subtle crosshatch pencil marks, soft watercolor blotches..."
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
        {loading ? 'Generating...' : 'Generate Texture'}
      </button>

      {error && (
        <div style={{ fontSize: '11px', color: '#EF4444', padding: '4px 0' }}>
          {error}
        </div>
      )}

      {generatedTexture && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', color: '#808090', fontWeight: 600 }}>
            Generated Texture
          </div>
          <div style={{
            width: '100%', height: '120px', borderRadius: '8px',
            backgroundImage: `url(${generatedTexture})`,
            backgroundSize: '128px 128px', backgroundRepeat: 'repeat',
            border: '1px solid #2a2a3e',
          }} />
          <div style={{ fontSize: '10px', color: '#505060' }}>
            Generated textures can be applied to forms via the texture tab in the Form Editor.
            Copy the texture data URL and set it as a custom texture reference.
          </div>
        </div>
      )}
    </div>
  );
}
