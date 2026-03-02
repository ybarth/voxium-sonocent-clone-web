import { useState } from 'react';
import { generateSoundEffect, hasElevenLabsApiKey } from '../../utils/elevenLabsApi';

interface ForgeSoundTabProps {
  onGenerated?: () => void;
}

export function ForgeSoundTab({ onGenerated }: ForgeSoundTabProps) {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (!hasElevenLabsApiKey()) {
      setError('ElevenLabs API key not configured. Set it in Settings > AI Configuration.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const dataUrl = await generateSoundEffect(prompt, duration);
      setGeneratedAudio(dataUrl);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    if (!generatedAudio) return;
    const audio = new Audio(generatedAudio);
    audio.volume = 0.5;
    audio.play();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '12px', color: '#a0a0b0' }}>
        Describe a sound effect. ElevenLabs will generate an audio clip.
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. soft click, gentle chime, whoosh transition..."
        style={{
          background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '6px',
          color: '#e0e0e0', padding: '8px', fontSize: '12px', outline: 'none',
          minHeight: '60px', resize: 'vertical', fontFamily: 'inherit',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: '#606070' }}>Duration</span>
        <input
          type="range" min={0.2} max={3} step={0.1} value={duration}
          onChange={(e) => setDuration(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: '#3B82F6' }}
        />
        <span style={{ fontSize: '11px', color: '#606070', minWidth: '30px', textAlign: 'right' }}>
          {duration.toFixed(1)}s
        </span>
      </div>

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
        {loading ? 'Generating...' : 'Generate Sound'}
      </button>

      {error && (
        <div style={{ fontSize: '11px', color: '#EF4444', padding: '4px 0' }}>
          {error}
        </div>
      )}

      {generatedAudio && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', color: '#808090', fontWeight: 600 }}>
            Generated Sound
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handlePreview}
              style={{
                padding: '6px 12px', background: 'none',
                border: '1px solid #2a2a3e', borderRadius: '6px',
                color: '#a0a0b0', fontSize: '11px', cursor: 'pointer',
              }}
            >
              Preview
            </button>
          </div>
          <div style={{ fontSize: '10px', color: '#505060' }}>
            Generated sounds can be assigned to forms via the sound tab in the Form Editor.
          </div>
        </div>
      )}
    </div>
  );
}
