import { useState, useRef } from 'react';
import { Upload, Trash2, Pencil, Play, Check } from 'lucide-react';
import { generateSoundEffect, hasElevenLabsApiKey } from '../../utils/elevenLabsApi';
import { useAssetLibraryStore } from '../../stores/assetLibraryStore';
import { AUDIO_ACCEPT } from '../../utils/assetValidation';
import type { SoundAsset } from '../../types/assetLibrary';

interface ForgeSoundTabProps {
  onGenerated?: () => void;
}

export function ForgeSoundTab({ onGenerated }: ForgeSoundTabProps) {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { sounds, addSoundAsset, addSoundFromDataUrl, renameAsset, deleteAsset } =
    useAssetLibraryStore();

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

  const handlePreview = (dataUrl: string) => {
    const audio = new Audio(dataUrl);
    audio.volume = 0.5;
    audio.play();
  };

  const handleSaveToLibrary = async () => {
    if (!generatedAudio) return;
    setSaving(true);
    try {
      await addSoundFromDataUrl(
        generatedAudio,
        prompt.slice(0, 40) || 'AI Sound',
        'ai-generated',
        prompt
      );
      setGeneratedAudio(null);
      setPrompt('');
      onGenerated?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    try {
      await addSoundAsset(file);
    } catch (err: any) {
      setUploadError(err.message);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStartRename = (asset: SoundAsset) => {
    setRenamingId(asset.id);
    setRenameValue(asset.name);
  };

  const handleConfirmRename = () => {
    if (renamingId && renameValue.trim()) {
      renameAsset('sound', renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this sound from the library?')) {
      deleteAsset('sound', id);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Section A: AI Generation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={sectionHeader}>AI Generation</div>
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
                onClick={() => handlePreview(generatedAudio)}
                style={{
                  padding: '6px 12px', background: 'none',
                  border: '1px solid #2a2a3e', borderRadius: '6px',
                  color: '#a0a0b0', fontSize: '11px', cursor: 'pointer',
                }}
              >
                Preview
              </button>
              <button
                onClick={handleSaveToLibrary}
                disabled={saving}
                style={{
                  padding: '6px 12px', backgroundColor: '#22C55E',
                  border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px',
                  fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Save to Library'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: '#1a1a2e' }} />

      {/* Section B: Sound Library */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={sectionHeader}>Sound Library</div>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px',
              background: 'none', border: '1px solid #2a2a3e', borderRadius: '4px',
              color: '#808090', fontSize: '11px', cursor: 'pointer',
            }}
          >
            <Upload size={11} /> Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={AUDIO_ACCEPT}
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
        </div>

        {uploadError && (
          <div style={{ fontSize: '11px', color: '#EF4444' }}>{uploadError}</div>
        )}

        {sounds.length === 0 ? (
          <div style={{ fontSize: '11px', color: '#505060', fontStyle: 'italic', padding: '8px 0' }}>
            No sounds yet. Upload or generate one above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {sounds.map((asset) => (
              <div
                key={asset.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 8px', borderRadius: '6px',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid #1a1a2e',
                }}
              >
                <button
                  onClick={() => handlePreview(asset.dataUrl)}
                  style={{
                    background: 'none', border: 'none', color: '#808090',
                    cursor: 'pointer', padding: '2px', display: 'flex',
                  }}
                  title="Play preview"
                >
                  <Play size={14} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {renamingId === asset.id ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmRename(); if (e.key === 'Escape') setRenamingId(null); }}
                        autoFocus
                        style={{
                          flex: 1, background: '#1a1a2e', border: '1px solid #3B82F6',
                          borderRadius: '3px', color: '#e0e0e0', fontSize: '11px', padding: '2px 6px',
                          outline: 'none', minWidth: 0,
                        }}
                      />
                      <button onClick={handleConfirmRename} style={iconBtnStyle}><Check size={11} /></button>
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: '#a0a0b0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {asset.name}
                    </div>
                  )}
                </div>
                {asset.durationSeconds != null && asset.durationSeconds > 0 && (
                  <span style={{
                    fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
                    backgroundColor: 'rgba(255,255,255,0.04)', color: '#606070',
                    fontFamily: 'monospace',
                  }}>
                    {asset.durationSeconds.toFixed(1)}s
                  </span>
                )}
                <span style={{
                  fontSize: '8px', padding: '1px 4px', borderRadius: '2px',
                  backgroundColor: asset.source === 'ai-generated' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)',
                  color: asset.source === 'ai-generated' ? '#A78BFA' : '#93c5fd',
                }}>
                  {asset.source === 'ai-generated' ? 'AI' : 'Upload'}
                </span>
                <button onClick={() => handleStartRename(asset)} style={iconBtnStyle} title="Rename">
                  <Pencil size={11} />
                </button>
                <button onClick={() => handleDelete(asset.id)} style={{ ...iconBtnStyle, color: '#EF4444' }} title="Delete">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const sectionHeader: React.CSSProperties = {
  fontSize: '11px', color: '#808090', fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#606070', cursor: 'pointer',
  padding: '2px', display: 'flex', alignItems: 'center',
};
