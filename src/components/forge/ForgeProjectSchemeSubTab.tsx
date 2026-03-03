import { useState } from 'react';
import { Copy, Trash2, Check, Link2, Unlink } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import type { ProjectScheme } from '../../types/scheme';
import { ALL_BUILTIN_SCHEMES } from '../../constants/schemes';
import { ALL_BUILTIN_SECTION_SCHEMES } from '../../constants/sectionSchemes';
import { ALL_BUILTIN_PROJECT_SCHEMES } from '../../constants/projectSchemes';

export function ForgeProjectSchemeSubTab() {
  const projectScheme = useProjectStore((s) => s.project.projectScheme);
  const projectSchemes = useProjectStore((s) => s.project.projectSchemes);
  const schemes = useProjectStore((s) => s.project.schemes);
  const sectionSchemes = useProjectStore((s) => s.project.sectionSchemes);
  const scheme = useProjectStore((s) => s.project.scheme);
  const sectionScheme = useProjectStore((s) => s.project.sectionScheme);

  const createProjectScheme = useProjectStore((s) => s.createProjectScheme);
  const setActiveProjectScheme = useProjectStore((s) => s.setActiveProjectScheme);
  const duplicateProjectScheme = useProjectStore((s) => s.duplicateProjectScheme);
  const deleteProjectScheme = useProjectStore((s) => s.deleteProjectScheme);

  const [newName, setNewName] = useState('');
  const [selectedChunkSchemeId, setSelectedChunkSchemeId] = useState('');
  const [selectedSectionSchemeId, setSelectedSectionSchemeId] = useState('');

  // All project schemes (user + builtins, deduped)
  const allProjectSchemes = [
    ...projectSchemes,
    ...ALL_BUILTIN_PROJECT_SCHEMES.filter((b) => !projectSchemes.some((s) => s.id === b.id)),
  ];

  // All chunk schemes for dropdown
  const allChunkSchemes = [
    ...schemes,
    ...ALL_BUILTIN_SCHEMES.filter((b) => !schemes.some((s) => s.id === b.id)),
  ];

  // All section schemes for dropdown
  const allSectionSchemes = [
    ...sectionSchemes,
    ...ALL_BUILTIN_SECTION_SCHEMES.filter((b) => !sectionSchemes.some((s) => s.id === b.id)),
  ];

  const resolveChunkSchemeName = (id: string) => {
    return allChunkSchemes.find((s) => s.id === id)?.name ?? '(unknown)';
  };

  const resolveSectionSchemeName = (id: string) => {
    return allSectionSchemes.find((s) => s.id === id)?.name ?? '(unknown)';
  };

  const handleCreate = () => {
    if (!newName.trim() || !selectedChunkSchemeId || !selectedSectionSchemeId) return;
    const ps = createProjectScheme(newName.trim(), selectedChunkSchemeId, selectedSectionSchemeId);
    setActiveProjectScheme(ps.id);
    setNewName('');
    setSelectedChunkSchemeId('');
    setSelectedSectionSchemeId('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Independent mode indicator */}
      <div style={{
        padding: '8px 12px', borderRadius: '6px',
        backgroundColor: projectScheme ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.03)',
        border: projectScheme ? '1px solid rgba(139,92,246,0.25)' : '1px solid #1a1a2e',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        {projectScheme ? (
          <>
            <Link2 size={12} style={{ color: '#8B5CF6', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: '#A78BFA', fontWeight: 600 }}>
                {projectScheme.name}
              </div>
              <div style={{ fontSize: '9px', color: '#606070' }}>
                {resolveChunkSchemeName(projectScheme.chunkSchemeId)} + {resolveSectionSchemeName(projectScheme.sectionSchemeId)}
              </div>
            </div>
            <button
              onClick={() => setActiveProjectScheme(null)}
              style={{
                fontSize: '9px', color: '#808090', background: 'rgba(255,255,255,0.05)',
                border: '1px solid #2a2a3e', borderRadius: '4px',
                padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px',
              }}
            >
              <Unlink size={9} /> Independent
            </button>
          </>
        ) : (
          <>
            <Unlink size={12} style={{ color: '#505060', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: '#808090', fontWeight: 600 }}>
                Independent Mode
              </div>
              <div style={{ fontSize: '9px', color: '#505060' }}>
                Chunk & section schemes are managed separately
              </div>
            </div>
          </>
        )}
      </div>

      {/* Scheme list */}
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#606070', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Project Schemes ({allProjectSchemes.length})
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '200px', overflow: 'auto' }}>
        {allProjectSchemes.map((ps) => (
          <div
            key={ps.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 8px', borderRadius: '4px',
              backgroundColor: ps.id === projectScheme?.id ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.02)',
              border: ps.id === projectScheme?.id ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
            }}
          >
            <Link2 size={10} style={{ color: '#505060', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', color: '#c0c0d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ps.name}
              </div>
              <div style={{ fontSize: '9px', color: '#505060' }}>
                {resolveChunkSchemeName(ps.chunkSchemeId)} + {resolveSectionSchemeName(ps.sectionSchemeId)}
              </div>
            </div>

            {/* Active indicator */}
            {ps.id === projectScheme?.id && (
              <Check size={10} style={{ color: '#8B5CF6', flexShrink: 0 }} />
            )}

            {/* Actions */}
            {ps.id !== projectScheme?.id && (
              <button
                onClick={() => setActiveProjectScheme(ps.id)}
                style={smallBtnStyle}
                title="Activate"
              >
                Use
              </button>
            )}
            <button
              onClick={() => duplicateProjectScheme(ps.id)}
              style={iconBtnStyle}
              title="Fork (duplicate)"
            >
              <Copy size={10} />
            </button>
            {!ps.builtIn && ps.id !== projectScheme?.id && (
              <button
                onClick={() => deleteProjectScheme(ps.id)}
                style={{ ...iconBtnStyle, color: '#EF4444' }}
                title="Delete"
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>
        ))}

        {allProjectSchemes.length === 0 && (
          <div style={{ fontSize: '11px', color: '#505060', fontStyle: 'italic', padding: '8px' }}>
            No project schemes yet. Create one below.
          </div>
        )}
      </div>

      {/* Create new project scheme */}
      <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#606070', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Create Project Scheme
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project scheme name..."
            style={{
              background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '6px',
              color: '#e0e0e0', padding: '6px 8px', fontSize: '12px', outline: 'none',
            }}
          />

          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '9px', color: '#505060', marginBottom: '2px' }}>Chunk Scheme</div>
              <select
                value={selectedChunkSchemeId}
                onChange={(e) => setSelectedChunkSchemeId(e.target.value)}
                style={{
                  width: '100%', background: '#1a1a2e', border: '1px solid #2a2a3e',
                  borderRadius: '6px', color: '#e0e0e0', padding: '5px 8px',
                  fontSize: '11px', cursor: 'pointer', outline: 'none',
                }}
              >
                <option value="">Select...</option>
                {allChunkSchemes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.forms.length}f)
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '9px', color: '#505060', marginBottom: '2px' }}>Section Scheme</div>
              <select
                value={selectedSectionSchemeId}
                onChange={(e) => setSelectedSectionSchemeId(e.target.value)}
                style={{
                  width: '100%', background: '#1a1a2e', border: '1px solid #2a2a3e',
                  borderRadius: '6px', color: '#e0e0e0', padding: '5px 8px',
                  fontSize: '11px', cursor: 'pointer', outline: 'none',
                }}
              >
                <option value="">Select...</option>
                {allSectionSchemes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.forms.length}f)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={!newName.trim() || !selectedChunkSchemeId || !selectedSectionSchemeId}
            style={{
              padding: '8px 14px', backgroundColor: 'rgba(139,92,246,0.2)',
              border: '1px solid rgba(139,92,246,0.4)', borderRadius: '6px',
              color: '#A78BFA', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              opacity: (!newName.trim() || !selectedChunkSchemeId || !selectedSectionSchemeId) ? 0.5 : 1,
            }}
          >
            Create & Activate
          </button>
        </div>
      </div>
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
