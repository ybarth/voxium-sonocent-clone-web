import { useState } from 'react';
import { ChevronRight, ChevronDown, Copy, Trash2, Download, Upload, Save, FolderOpen } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { ALL_BUILTIN_SCHEMES } from '../../constants/schemes';

export function SchemeManager() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showLoadTemplates, setShowLoadTemplates] = useState(false);
  const [savingSchemeId, setSavingSchemeId] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<'new' | 'overwrite'>('new');
  const [saveNewName, setSaveNewName] = useState('');
  const [overwriteTargetId, setOverwriteTargetId] = useState('');

  const schemes = useProjectStore((s) => s.project.schemes);
  const activeSchemeId = useProjectStore((s) => s.project.scheme.id);
  const setActiveScheme = useProjectStore((s) => s.setActiveScheme);
  const createScheme = useProjectStore((s) => s.createScheme);
  const duplicateScheme = useProjectStore((s) => s.duplicateScheme);
  const deleteScheme = useProjectStore((s) => s.deleteScheme);
  const saveSchemeAsTemplate = useProjectStore((s) => s.saveSchemeAsTemplate);
  const loadSchemeTemplate = useProjectStore((s) => s.loadSchemeTemplate);
  const getSavedTemplateNames = useProjectStore((s) => s.getSavedTemplateNames);
  const deleteSchemeTemplate = useProjectStore((s) => s.deleteSchemeTemplate);

  const allSchemes = [
    ...schemes,
    ...ALL_BUILTIN_SCHEMES.filter((b) => !schemes.some((s) => s.id === b.id)),
  ];

  const savedTemplates = getSavedTemplateNames();

  const handleExport = (id: string) => {
    const scheme = allSchemes.find((s) => s.id === id);
    if (!scheme) return;
    const json = JSON.stringify(scheme, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scheme-${scheme.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importJson);
      if (parsed.name && parsed.forms) {
        const store = useProjectStore.getState();
        store.addScheme({ ...parsed, builtIn: false });
        setImportJson('');
        setShowImport(false);
      }
    } catch {
      // ignore
    }
  };

  const openSaveDialog = (schemeId: string) => {
    const scheme = allSchemes.find((s) => s.id === schemeId);
    setSavingSchemeId(schemeId);
    setSaveMode('new');
    setSaveNewName(scheme?.name ?? '');
    setOverwriteTargetId(savedTemplates[0]?.id ?? '');
  };

  const handleSaveTemplate = () => {
    if (!savingSchemeId) return;
    if (saveMode === 'new') {
      saveSchemeAsTemplate(savingSchemeId, saveNewName.trim() || undefined);
    } else {
      if (overwriteTargetId) {
        saveSchemeAsTemplate(savingSchemeId, undefined, overwriteTargetId);
      }
    }
    setSavingSchemeId(null);
  };

  return (
    <div style={{ marginTop: '8px' }}>
      <button
        onClick={() => setIsExpanded((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '12px', fontWeight: 600, color: '#808090',
          textTransform: 'uppercase', letterSpacing: '0.05em',
          marginBottom: '4px', background: 'none', border: 'none',
          cursor: 'pointer', padding: 0, width: '100%',
        }}
      >
        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Scheme Manager
      </button>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '4px' }}>
          {allSchemes.map((scheme) => {
            const isActive = scheme.id === activeSchemeId;
            return (
              <div
                key={scheme.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '4px 8px', borderRadius: '4px',
                  backgroundColor: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
                  border: isActive ? '1px solid rgba(59,130,246,0.2)' : '1px solid transparent',
                }}
              >
                <button
                  onClick={() => setActiveScheme(scheme.id)}
                  style={{
                    flex: 1, background: 'none', border: 'none', textAlign: 'left',
                    fontSize: '11px', color: isActive ? '#93c5fd' : '#a0a0b0',
                    cursor: 'pointer', padding: 0, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {scheme.name}
                  {scheme.builtIn && (
                    <span style={{ fontSize: '9px', color: '#505060', marginLeft: '4px' }}>(built-in)</span>
                  )}
                </button>
                <span style={{ fontSize: '9px', color: '#505060' }}>{scheme.forms.length}</span>
                <button
                  onClick={() => openSaveDialog(scheme.id)}
                  title="Save as template"
                  style={{ ...iconBtnStyle, color: '#22C55E' }}
                >
                  <Save size={10} />
                </button>
                <button
                  onClick={() => duplicateScheme(scheme.id)}
                  title="Duplicate"
                  style={iconBtnStyle}
                >
                  <Copy size={10} />
                </button>
                <button
                  onClick={() => handleExport(scheme.id)}
                  title="Export"
                  style={iconBtnStyle}
                >
                  <Download size={10} />
                </button>
                {!scheme.builtIn && !isActive && (
                  <button
                    onClick={() => deleteScheme(scheme.id)}
                    title="Delete"
                    style={{ ...iconBtnStyle, color: '#EF4444' }}
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            );
          })}

          {/* Save dialog */}
          {savingSchemeId && (
            <div style={{
              padding: '8px', backgroundColor: 'rgba(34,197,94,0.06)',
              border: '1px solid rgba(34,197,94,0.15)', borderRadius: '6px',
              display: 'flex', flexDirection: 'column', gap: '6px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#22C55E' }}>
                Save as Template
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setSaveMode('new')}
                  style={{
                    flex: 1, padding: '4px', fontSize: '10px', borderRadius: '4px',
                    border: saveMode === 'new' ? '1px solid rgba(34,197,94,0.4)' : '1px solid #1a1a2e',
                    backgroundColor: saveMode === 'new' ? 'rgba(34,197,94,0.1)' : 'transparent',
                    color: saveMode === 'new' ? '#22C55E' : '#606070', cursor: 'pointer',
                  }}
                >
                  Save as New
                </button>
                <button
                  onClick={() => setSaveMode('overwrite')}
                  disabled={savedTemplates.length === 0}
                  style={{
                    flex: 1, padding: '4px', fontSize: '10px', borderRadius: '4px',
                    border: saveMode === 'overwrite' ? '1px solid rgba(245,158,11,0.4)' : '1px solid #1a1a2e',
                    backgroundColor: saveMode === 'overwrite' ? 'rgba(245,158,11,0.1)' : 'transparent',
                    color: saveMode === 'overwrite' ? '#F59E0B' : '#606070', cursor: 'pointer',
                    opacity: savedTemplates.length === 0 ? 0.4 : 1,
                  }}
                >
                  Overwrite
                </button>
              </div>
              {saveMode === 'new' ? (
                <input
                  value={saveNewName}
                  onChange={(e) => setSaveNewName(e.target.value)}
                  placeholder="Template name..."
                  style={{
                    background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '4px',
                    color: '#e0e0e0', padding: '4px 8px', fontSize: '11px', outline: 'none',
                  }}
                />
              ) : (
                <select
                  value={overwriteTargetId}
                  onChange={(e) => setOverwriteTargetId(e.target.value)}
                  style={{
                    background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '4px',
                    color: '#e0e0e0', padding: '4px 8px', fontSize: '11px', outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {savedTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setSavingSchemeId(null)}
                  style={{
                    flex: 1, padding: '4px', fontSize: '10px', color: '#606070',
                    background: 'none', border: '1px solid #1a1a2e',
                    borderRadius: '4px', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTemplate}
                  style={{
                    flex: 1, padding: '4px', fontSize: '10px', color: '#22C55E',
                    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
                    borderRadius: '4px', cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Create new */}
          <button
            onClick={() => createScheme('New Scheme')}
            style={{
              padding: '4px 8px', fontSize: '10px', color: '#60a5fa',
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: '4px', cursor: 'pointer', textAlign: 'center',
            }}
          >
            + New Scheme
          </button>

          {/* Load Template */}
          <button
            onClick={() => setShowLoadTemplates((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
              padding: '4px 8px', fontSize: '10px', color: '#A78BFA',
              background: savedTemplates.length > 0 ? 'rgba(139,92,246,0.08)' : 'transparent',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: '4px', cursor: 'pointer',
              opacity: savedTemplates.length === 0 ? 0.4 : 1,
            }}
            disabled={savedTemplates.length === 0}
          >
            <FolderOpen size={10} /> Load Template ({savedTemplates.length})
          </button>

          {showLoadTemplates && savedTemplates.length > 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '3px',
              padding: '6px', backgroundColor: 'rgba(139,92,246,0.04)',
              border: '1px solid rgba(139,92,246,0.1)', borderRadius: '6px',
            }}>
              {savedTemplates.map((tpl) => (
                <div key={tpl.id} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '3px 6px', borderRadius: '4px',
                }}>
                  <button
                    onClick={() => { loadSchemeTemplate(tpl.id); setShowLoadTemplates(false); }}
                    style={{
                      flex: 1, background: 'none', border: 'none', textAlign: 'left',
                      fontSize: '11px', color: '#a0a0b0', cursor: 'pointer', padding: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {tpl.name}
                  </button>
                  <button
                    onClick={() => deleteSchemeTemplate(tpl.id)}
                    title="Delete template"
                    style={{ ...iconBtnStyle, color: '#EF4444' }}
                  >
                    <Trash2 size={9} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Import */}
          <button
            onClick={() => setShowImport((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
              padding: '4px 8px', fontSize: '10px', color: '#808090',
              background: 'none', border: '1px solid #1a1a2e',
              borderRadius: '4px', cursor: 'pointer',
            }}
          >
            <Upload size={10} /> Import
          </button>

          {showImport && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                placeholder="Paste scheme JSON..."
                style={{
                  background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '4px',
                  color: '#e0e0e0', fontSize: '10px', padding: '6px', outline: 'none',
                  minHeight: '60px', resize: 'vertical', fontFamily: 'monospace',
                }}
              />
              <button
                onClick={handleImport}
                style={{
                  padding: '4px', fontSize: '10px', color: '#22C55E',
                  background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
                  borderRadius: '4px', cursor: 'pointer',
                }}
              >
                Import
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  background: 'none', border: 'none', color: '#505060',
  cursor: 'pointer', padding: '2px', borderRadius: '3px', flexShrink: 0,
};
