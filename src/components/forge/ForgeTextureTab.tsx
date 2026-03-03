import { useState, useRef } from 'react';
import { Upload, Trash2, Pencil, Image, Check, X } from 'lucide-react';
import { generateTextureFromText, generateTextureFromReference, hasApiKey } from '../../utils/aiGeneration';
import { useAssetLibraryStore } from '../../stores/assetLibraryStore';
import { IMAGE_ACCEPT } from '../../utils/assetValidation';
import type { TextureAsset } from '../../types/assetLibrary';

interface ForgeTextureTabProps {
  onGenerated?: () => void;
}

export function ForgeTextureTab({ onGenerated }: ForgeTextureTabProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedTexture, setGeneratedTexture] = useState<string | null>(null);
  const [referenceAsset, setReferenceAsset] = useState<TextureAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { textures, addTextureAsset, addTextureFromDataUrl, renameAsset, deleteAsset } =
    useAssetLibraryStore();

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (!hasApiKey()) {
      setError('OpenAI API key not configured. Set it in Settings > AI Configuration.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let dataUrl: string;
      if (referenceAsset) {
        dataUrl = await generateTextureFromReference(prompt, referenceAsset.dataUrl);
      } else {
        dataUrl = await generateTextureFromText(prompt);
      }
      setGeneratedTexture(dataUrl);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!generatedTexture) return;
    setSaving(true);
    try {
      await addTextureFromDataUrl(
        generatedTexture,
        prompt.slice(0, 40) || 'AI Texture',
        'ai-generated',
        prompt
      );
      setGeneratedTexture(null);
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
      await addTextureAsset(file);
    } catch (err: any) {
      setUploadError(err.message);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStartRename = (asset: TextureAsset) => {
    setRenamingId(asset.id);
    setRenameValue(asset.name);
  };

  const handleConfirmRename = () => {
    if (renamingId && renameValue.trim()) {
      renameAsset('texture', renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this texture from the library?')) {
      deleteAsset('texture', id);
      if (referenceAsset?.id === id) setReferenceAsset(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Section A: AI Generation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={sectionHeader}>AI Generation</div>
        <div style={{ fontSize: '12px', color: '#a0a0b0' }}>
          Describe a texture pattern. DALL-E will generate a tileable texture.
        </div>

        {referenceAsset && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 8px', backgroundColor: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.2)', borderRadius: '6px',
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '4px', flexShrink: 0,
              backgroundImage: `url(${referenceAsset.dataUrl})`,
              backgroundSize: '32px', backgroundRepeat: 'repeat',
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', color: '#93c5fd', fontWeight: 600 }}>Reference Image</div>
              <div style={{ fontSize: '10px', color: '#606070', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {referenceAsset.name}
              </div>
            </div>
            <button
              onClick={() => setReferenceAsset(null)}
              style={{ background: 'none', border: 'none', color: '#606070', cursor: 'pointer', padding: '2px' }}
            >
              <X size={12} />
            </button>
          </div>
        )}

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
          {loading ? 'Generating...' : referenceAsset ? 'Generate from Reference' : 'Generate Texture'}
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
            <button
              onClick={handleSaveToLibrary}
              disabled={saving}
              style={{
                padding: '8px 14px', backgroundColor: '#22C55E',
                border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px',
                fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
              }}
            >
              {saving ? 'Saving...' : 'Save to Library'}
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: '#1a1a2e' }} />

      {/* Section B: Texture Library */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={sectionHeader}>Texture Library</div>
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
            accept={IMAGE_ACCEPT}
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
        </div>

        {uploadError && (
          <div style={{ fontSize: '11px', color: '#EF4444' }}>{uploadError}</div>
        )}

        {textures.length === 0 ? (
          <div style={{ fontSize: '11px', color: '#505060', fontStyle: 'italic', padding: '8px 0' }}>
            No textures yet. Upload or generate one above.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            {textures.map((asset) => (
              <div
                key={asset.id}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '4px',
                  padding: '4px', borderRadius: '6px',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid #1a1a2e',
                }}
              >
                <div style={{
                  width: '100%', aspectRatio: '1', borderRadius: '4px',
                  backgroundImage: `url(${asset.dataUrl})`,
                  backgroundSize: '48px', backgroundRepeat: 'repeat',
                  backgroundColor: '#0d0d18',
                }} />
                {renamingId === asset.id ? (
                  <div style={{ display: 'flex', gap: '2px' }}>
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmRename(); if (e.key === 'Escape') setRenamingId(null); }}
                      autoFocus
                      style={{
                        flex: 1, background: '#1a1a2e', border: '1px solid #3B82F6',
                        borderRadius: '2px', color: '#e0e0e0', fontSize: '9px', padding: '2px 4px',
                        outline: 'none', minWidth: 0,
                      }}
                    />
                    <button onClick={handleConfirmRename} style={iconBtnStyle}><Check size={10} /></button>
                  </div>
                ) : (
                  <div style={{
                    fontSize: '9px', color: '#a0a0b0', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {asset.name}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <span style={{
                    fontSize: '8px', padding: '1px 4px', borderRadius: '2px',
                    backgroundColor: asset.source === 'ai-generated' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)',
                    color: asset.source === 'ai-generated' ? '#A78BFA' : '#93c5fd',
                  }}>
                    {asset.source === 'ai-generated' ? 'AI' : 'Upload'}
                  </span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => handleStartRename(asset)} style={iconBtnStyle} title="Rename">
                    <Pencil size={10} />
                  </button>
                  <button
                    onClick={() => setReferenceAsset(asset)}
                    style={iconBtnStyle}
                    title="Use as AI Reference"
                  >
                    <Image size={10} />
                  </button>
                  <button onClick={() => handleDelete(asset.id)} style={{ ...iconBtnStyle, color: '#EF4444' }} title="Delete">
                    <Trash2 size={10} />
                  </button>
                </div>
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
