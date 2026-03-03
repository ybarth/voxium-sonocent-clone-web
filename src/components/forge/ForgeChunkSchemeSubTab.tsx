import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { ChevronDown, ChevronRight, Copy, Trash2, Check } from 'lucide-react';
import { generateSchemeFromText, hasApiKey } from '../../utils/aiGeneration';
import { useProjectStore } from '../../stores/projectStore';
import type { Form, Scheme, BuiltinShapeId } from '../../types/scheme';
import { ALL_BUILTIN_SCHEMES } from '../../constants/schemes';

interface ForgeChunkSchemeSubTabProps {
  onGenerated?: () => void;
}

export function ForgeChunkSchemeSubTab({ onGenerated }: ForgeChunkSchemeSubTabProps) {
  const scheme = useProjectStore((s) => s.project.scheme);
  const schemes = useProjectStore((s) => s.project.schemes);
  const addScheme = useProjectStore((s) => s.addScheme);
  const setActiveScheme = useProjectStore((s) => s.setActiveScheme);
  const duplicateScheme = useProjectStore((s) => s.duplicateScheme);
  const deleteScheme = useProjectStore((s) => s.deleteScheme);
  const createScheme = useProjectStore((s) => s.createScheme);
  const updateFormInScheme = useProjectStore((s) => s.updateFormInScheme);
  const addFormToScheme = useProjectStore((s) => s.addFormToScheme);
  const removeFormFromScheme = useProjectStore((s) => s.removeFormFromScheme);

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedScheme, setGeneratedScheme] = useState<{
    labels: string[];
    colors: string[];
    shapes: BuiltinShapeId[];
  } | null>(null);
  const [schemeName, setSchemeName] = useState('');
  const [expandedSchemeId, setExpandedSchemeId] = useState<string | null>(null);

  // All available schemes (user + builtins, deduped)
  const allSchemes = [
    ...schemes,
    ...ALL_BUILTIN_SCHEMES.filter((b) => !schemes.some((s) => s.id === b.id)),
  ];

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
      setGeneratedScheme(result as { labels: string[]; colors: string[]; shapes: BuiltinShapeId[] });
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

    const newScheme: Scheme = {
      id: schemeId,
      name: schemeName || `Forge: ${prompt.slice(0, 30)}`,
      builtIn: false,
      forms,
    };

    addScheme(newScheme);
    setActiveScheme(schemeId);
    onGenerated?.();
  };

  const handleCreateBlank = () => {
    const newScheme = createScheme('New Scheme');
    setActiveScheme(newScheme.id);
  };

  const expandedScheme = expandedSchemeId
    ? allSchemes.find((s) => s.id === expandedSchemeId)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Scheme list */}
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#606070', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Chunk Schemes ({allSchemes.length})
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '200px', overflow: 'auto' }}>
        {allSchemes.map((s) => (
          <div key={s.id}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 8px', borderRadius: '4px',
                backgroundColor: s.id === scheme.id ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.02)',
                border: s.id === scheme.id ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
              }}
            >
              {/* Expand toggle */}
              <button
                onClick={() => setExpandedSchemeId(expandedSchemeId === s.id ? null : s.id)}
                style={{ background: 'none', border: 'none', color: '#606070', cursor: 'pointer', padding: 0, display: 'flex' }}
              >
                {expandedSchemeId === s.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>

              {/* Color swatches */}
              <div style={{ display: 'flex', gap: '1px', flexShrink: 0 }}>
                {s.forms.slice(0, 6).map((f) => (
                  <div key={f.id} style={{
                    width: '8px', height: '8px', borderRadius: '2px',
                    backgroundColor: f.color?.hex ?? '#808080',
                  }} />
                ))}
                {s.forms.length > 6 && (
                  <span style={{ fontSize: '8px', color: '#505060', lineHeight: '8px' }}>+{s.forms.length - 6}</span>
                )}
              </div>

              {/* Name */}
              <span style={{ fontSize: '11px', color: '#c0c0d0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name}
              </span>
              <span style={{ fontSize: '9px', color: '#505060' }}>{s.forms.length}f</span>

              {/* Active indicator */}
              {s.id === scheme.id && (
                <Check size={10} style={{ color: '#8B5CF6', flexShrink: 0 }} />
              )}

              {/* Actions */}
              {s.id !== scheme.id && (
                <button
                  onClick={() => setActiveScheme(s.id)}
                  style={smallBtnStyle}
                  title="Activate"
                >
                  Use
                </button>
              )}
              <button
                onClick={() => duplicateScheme(s.id)}
                style={{ ...iconBtnStyle }}
                title="Fork (duplicate)"
              >
                <Copy size={10} />
              </button>
              {!s.builtIn && s.id !== scheme.id && (
                <button
                  onClick={() => deleteScheme(s.id)}
                  style={{ ...iconBtnStyle, color: '#EF4444' }}
                  title="Delete"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>

            {/* Expanded inline form editing */}
            {expandedSchemeId === s.id && (
              <div style={{
                marginLeft: '20px', marginTop: '4px', marginBottom: '4px',
                padding: '8px', borderRadius: '6px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                border: '1px solid #1a1a2e',
              }}>
                <div style={{ fontSize: '10px', color: '#606070', marginBottom: '6px', fontWeight: 600 }}>
                  Forms in "{s.name}"
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {s.forms.map((form) => (
                    <InlineFormEditor
                      key={form.id}
                      form={form}
                      schemeId={s.id}
                      readOnly={s.builtIn}
                      onUpdate={(updates) => updateFormInScheme(s.id, form.id, updates)}
                      onRemove={() => removeFormFromScheme(s.id, form.id)}
                    />
                  ))}
                  {!s.builtIn && (
                    <button
                      onClick={() => addFormToScheme(s.id, {
                        id: uuid(),
                        label: `Form ${s.forms.length + 1}`,
                        shortcutKey: s.forms.length < 9 ? s.forms.length + 1 : 0,
                        color: { hex: '#808080', alpha: 1 },
                      })}
                      style={{
                        fontSize: '10px', color: '#60a5fa', background: 'rgba(59,130,246,0.08)',
                        border: '1px dashed rgba(59,130,246,0.2)', borderRadius: '4px',
                        padding: '3px 8px', cursor: 'pointer',
                      }}
                    >
                      + Add Form
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleCreateBlank}
        style={{
          padding: '6px 12px', background: 'rgba(59,130,246,0.1)',
          border: '1px dashed rgba(59,130,246,0.3)', borderRadius: '6px',
          color: '#60a5fa', fontSize: '11px', cursor: 'pointer',
        }}
      >
        + Create Blank Scheme
      </button>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#606070', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          AI Generation
        </div>
        <div style={{ fontSize: '12px', color: '#a0a0b0', marginBottom: '8px' }}>
          Describe your use case and the AI will generate a complete chunk scheme with labels, colors, and shapes.
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. university lecture with key points, questions, and examples..."
          style={{
            background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '6px',
            color: '#e0e0e0', padding: '8px', fontSize: '12px', outline: 'none',
            minHeight: '60px', resize: 'vertical', fontFamily: 'inherit', width: '100%',
            boxSizing: 'border-box',
          }}
        />

        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          style={{
            marginTop: '8px', padding: '8px 14px',
            backgroundColor: loading ? '#1a1a2e' : '#8B5CF6',
            border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px',
            fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
            opacity: !prompt.trim() ? 0.5 : 1, width: '100%',
          }}
        >
          {loading ? 'Generating Scheme...' : 'Generate Chunk Scheme'}
        </button>

        {error && (
          <div style={{ fontSize: '11px', color: '#EF4444', padding: '4px 0' }}>
            {error}
          </div>
        )}

        {generatedScheme && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
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
    </div>
  );
}

// ─── Inline Form Editor ───────────────────────────────────────────────────────

function InlineFormEditor({
  form,
  schemeId,
  readOnly,
  onUpdate,
  onRemove,
}: {
  form: Form;
  schemeId: string;
  readOnly: boolean;
  onUpdate: (updates: Partial<Form>) => void;
  onRemove: () => void;
}) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [draftLabel, setDraftLabel] = useState(form.label);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '3px 6px', borderRadius: '3px',
      backgroundColor: 'rgba(255,255,255,0.02)',
    }}>
      {/* Color input */}
      <input
        type="color"
        value={form.color?.hex ?? '#808080'}
        onChange={(e) => !readOnly && onUpdate({ color: { hex: e.target.value, alpha: form.color?.alpha ?? 1 } })}
        disabled={readOnly}
        style={{ width: '18px', height: '18px', padding: 0, border: 'none', background: 'none', cursor: readOnly ? 'default' : 'pointer' }}
      />

      {/* Label */}
      {editingLabel && !readOnly ? (
        <input
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onBlur={() => { onUpdate({ label: draftLabel.trim() || form.label }); setEditingLabel(false); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { onUpdate({ label: draftLabel.trim() || form.label }); setEditingLabel(false); }
            if (e.key === 'Escape') { setDraftLabel(form.label); setEditingLabel(false); }
          }}
          autoFocus
          style={{
            flex: 1, background: '#1a1a2e', border: '1px solid #3B82F6', borderRadius: '3px',
            color: '#e0e0e0', padding: '1px 4px', fontSize: '10px', outline: 'none',
          }}
        />
      ) : (
        <span
          onClick={() => !readOnly && setEditingLabel(true)}
          style={{
            flex: 1, fontSize: '10px', color: '#c0c0d0',
            cursor: readOnly ? 'default' : 'pointer',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {form.label}
        </span>
      )}

      {/* Shape indicator */}
      {form.shape && form.shape.builtinId !== 'default' && (
        <span style={{ fontSize: '8px', color: '#505060' }}>{form.shape.builtinId}</span>
      )}

      {/* Shortcut key */}
      <span style={{
        fontSize: '8px', color: '#404050', fontFamily: 'monospace',
        backgroundColor: 'rgba(255,255,255,0.04)', padding: '0px 3px',
        borderRadius: '2px',
      }}>
        {form.shortcutKey || '-'}
      </span>

      {/* Remove */}
      {!readOnly && (
        <button onClick={onRemove} style={{ ...iconBtnStyle, color: '#EF4444' }} title="Remove form">
          <Trash2 size={9} />
        </button>
      )}
    </div>
  );
}

const smallBtnStyle: React.CSSProperties = {
  fontSize: '9px', color: '#8B5CF6', background: 'rgba(139,92,246,0.1)',
  border: '1px solid rgba(139,92,246,0.2)', borderRadius: '3px',
  padding: '1px 6px', cursor: 'pointer', flexShrink: 0,
};

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', background: 'none', border: 'none',
  color: '#606070', cursor: 'pointer', padding: '2px', borderRadius: '3px', flexShrink: 0,
};
