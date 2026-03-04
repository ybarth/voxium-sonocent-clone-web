import { useState, useEffect, useRef } from 'react';
import { Plus, Link2, Unlink } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useProjectStore } from '../../stores/projectStore';
import { DEFAULT_CHUNK_COLOR } from '../../types';
import type { Form } from '../../types/scheme';
import type { SectionForm } from '../../types/scheme';
import { ALL_BUILTIN_SCHEMES } from '../../constants/schemes';
import { ALL_BUILTIN_SECTION_SCHEMES } from '../../constants/sectionSchemes';
import { FormRow } from './FormRow';
import { FormEditor } from './FormEditor';
import { SectionFormRow } from './SectionFormRow';
import { SectionFormEditor } from './SectionFormEditor';
import { FilterPanel } from './FilterPanel';
import { TagManager } from './TagManager';
import { ClipboardPanel } from './ClipboardPanel';
import { SchemeManager } from './SchemeManager';
import { getFlatSectionOrder } from '../../utils/sectionTree';

export function SchemeSidebar() {
  const scheme = useProjectStore((s) => s.project.scheme);
  const schemes = useProjectStore((s) => s.project.schemes);
  const selectedChunkIds = useProjectStore((s) => s.selection.selectedChunkIds);
  const applyForm = useProjectStore((s) => s.applyForm);
  const clearForm = useProjectStore((s) => s.clearForm);
  const setActiveScheme = useProjectStore((s) => s.setActiveScheme);
  const updateFormInScheme = useProjectStore((s) => s.updateFormInScheme);
  const addFormToScheme = useProjectStore((s) => s.addFormToScheme);
  const updateScheme = useProjectStore((s) => s.updateScheme);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [showAllForms, setShowAllForms] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(scheme.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Sync draft name when active scheme changes
  useEffect(() => {
    setDraftName(scheme.name);
    setEditingName(false);
  }, [scheme.id, scheme.name]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.select();
  }, [editingName]);

  const saveName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== scheme.name) {
      updateScheme(scheme.id, { name: trimmed });
    } else {
      setDraftName(scheme.name);
    }
    setEditingName(false);
  };

  const selectedIds = Array.from(selectedChunkIds);

  const handleFormClick = (formId: string) => {
    if (selectedIds.length > 0) {
      applyForm(selectedIds, formId);
    }
  };

  const handleClearForm = () => {
    if (selectedIds.length > 0) {
      clearForm(selectedIds);
    }
  };

  const handleAddForm = () => {
    const newForm: Form = {
      id: uuid(),
      label: `Form ${scheme.forms.length + 1}`,
      shortcutKey: scheme.forms.length < 9 ? scheme.forms.length + 1 : 0,
      color: { hex: '#808080', alpha: 1 },
    };
    addFormToScheme(scheme.id, newForm);
  };

  const editingForm = editingFormId
    ? scheme.forms.find((f) => f.id === editingFormId)
    : null;

  // Show first 9 (shortcutted) by default
  const visibleForms = showAllForms ? scheme.forms : scheme.forms.slice(0, 9);

  // All available schemes (user + builtins)
  const allSchemes = [
    ...schemes,
    ...ALL_BUILTIN_SCHEMES.filter((b) => !schemes.some((s) => s.id === b.id)),
  ];

  const projectScheme = useProjectStore((s) => s.project.projectScheme);
  const setActiveProjectScheme = useProjectStore((s) => s.setActiveProjectScheme);

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Project scheme indicator */}
      {projectScheme && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 8px', borderRadius: '6px',
          backgroundColor: 'rgba(139,92,246,0.1)',
          border: '1px solid rgba(139,92,246,0.2)',
        }}>
          <Link2 size={11} style={{ color: '#8B5CF6', flexShrink: 0 }} />
          <span style={{ fontSize: '10px', color: '#A78BFA', fontWeight: 600, flex: 1 }}>
            Project Scheme: {projectScheme.name}
          </span>
          <button
            onClick={() => setActiveProjectScheme(null)}
            title="Switch to independent mode"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '2px',
              background: 'none', border: 'none', color: '#606070',
              cursor: 'pointer', padding: '2px', fontSize: '9px',
            }}
          >
            <Unlink size={9} /> Unlink
          </button>
        </div>
      )}

      {/* Scheme selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          fontSize: '12px', fontWeight: 600, color: '#808090',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          Scheme
        </span>
        <select
          value={scheme.id}
          onChange={(e) => setActiveScheme(e.target.value)}
          style={{
            flex: 1, background: '#1a1a2e', border: '1px solid #2a2a3e',
            borderRadius: '6px', color: '#e0e0e0', padding: '4px 8px',
            fontSize: '11px', cursor: 'pointer', outline: 'none',
          }}
        >
          {allSchemes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.forms.length})
            </option>
          ))}
        </select>
      </div>

      {/* Form list header with editable name */}
      <div style={{
        fontSize: '11px', fontWeight: 600, color: '#606070',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        display: 'flex', alignItems: 'center', gap: '4px',
      }}>
        Forms —{' '}
        {editingName ? (
          <input
            ref={nameInputRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName();
              if (e.key === 'Escape') { setDraftName(scheme.name); setEditingName(false); }
            }}
            style={{
              background: '#1a1a2e', border: '1px solid #3B82F6', borderRadius: '4px',
              color: '#e0e0e0', padding: '1px 4px', fontSize: '11px', fontWeight: 600,
              outline: 'none', width: '120px', textTransform: 'none',
            }}
          />
        ) : (
          <span
            onClick={() => { if (!scheme.builtIn) setEditingName(true); }}
            style={{
              cursor: scheme.builtIn ? 'default' : 'pointer',
              borderBottom: scheme.builtIn ? 'none' : '1px dashed #505060',
              color: '#808090', textTransform: 'none',
            }}
            title={scheme.builtIn ? 'Built-in scheme (read-only)' : 'Click to rename'}
          >
            {scheme.name}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {/* Default / clear */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 8px', borderRadius: '4px',
          }}
          onMouseEnter={(e) => { (e.currentTarget).style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { (e.currentTarget).style.backgroundColor = 'transparent'; }}
        >
          <button
            onClick={handleClearForm}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', flex: 1,
              backgroundColor: 'transparent', border: 'none',
              cursor: selectedIds.length > 0 ? 'pointer' : 'default',
              opacity: selectedIds.length > 0 ? 1 : 0.6,
              textAlign: 'left', padding: 0,
            }}
          >
            <div style={{
              width: '18px', height: '18px', borderRadius: '4px',
              backgroundColor: DEFAULT_CHUNK_COLOR, flexShrink: 0,
              border: '1px solid rgba(255,255,255,0.1)',
            }} />
            <span style={{ fontSize: '12px', color: '#c0c0d0' }}>Default</span>
          </button>
          <span style={{
            fontSize: '10px', color: '#505060', fontFamily: 'monospace',
            backgroundColor: 'rgba(255,255,255,0.05)', padding: '1px 5px',
            borderRadius: '3px', flexShrink: 0,
          }}>
            0
          </span>
        </div>

        {visibleForms.map((form) => (
          <FormRow
            key={form.id}
            form={form}
            isActive={selectedIds.length > 0}
            onClick={() => handleFormClick(form.id)}
            onEdit={() => setEditingFormId(form.id)}
          />
        ))}

        {/* Show more/less */}
        {scheme.forms.length > 9 && (
          <button
            onClick={() => setShowAllForms((v) => !v)}
            style={{
              background: 'none', border: 'none', color: '#505060',
              fontSize: '10px', cursor: 'pointer', padding: '4px 8px', textAlign: 'left',
            }}
          >
            {showAllForms ? 'Show less' : `+ ${scheme.forms.length - 9} more forms`}
          </button>
        )}

        {/* Add form button */}
        {!scheme.builtIn && (
          <button
            onClick={handleAddForm}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 8px', fontSize: '10px', color: '#60a5fa',
              background: 'rgba(59,130,246,0.08)', border: '1px dashed rgba(59,130,246,0.2)',
              borderRadius: '4px', cursor: 'pointer',
            }}
          >
            <Plus size={10} /> Add Form
          </button>
        )}
      </div>

      {selectedIds.length === 0 && (
        <div style={{ fontSize: '11px', color: '#505060', fontStyle: 'italic', padding: '8px 0' }}>
          Select chunks to apply forms. Use number keys 1-9 for quick assignment.
        </div>
      )}

      {/* Filter Panel */}
      <FilterPanel />

      {/* Tag Manager */}
      <TagManager />

      {/* Clipboard History */}
      <ClipboardPanel />

      {/* Scheme Manager */}
      <SchemeManager />

      {/* Section Scheme Panel */}
      <SectionSchemePanel />

      {/* Section overview */}
      <SectionOverview />

      {/* Removed sections */}
      <RemovedSectionsPanel />

      {/* Trash */}
      <TrashBinPanel />

      {/* Form editor modal */}
      {editingForm && (
        <FormEditor
          form={editingForm}
          onSave={(updates) => updateFormInScheme(scheme.id, editingForm.id, updates)}
          onClose={() => setEditingFormId(null)}
        />
      )}
    </div>
  );
}

// ─── Section Scheme Panel ────────────────────────────────────────────────────

function SectionSchemePanel() {
  const sectionScheme = useProjectStore((s) => s.project.sectionScheme);
  const sectionSchemes = useProjectStore((s) => s.project.sectionSchemes);
  const selectedSectionIds = useProjectStore((s) => s.selection.selectedSectionIds);
  const applySectionForm = useProjectStore((s) => s.applySectionForm);
  const clearSectionForm = useProjectStore((s) => s.clearSectionForm);
  const setActiveSectionScheme = useProjectStore((s) => s.setActiveSectionScheme);
  const updateSectionFormInScheme = useProjectStore((s) => s.updateSectionFormInScheme);
  const addSectionFormToScheme = useProjectStore((s) => s.addSectionFormToScheme);
  const updateSectionScheme = useProjectStore((s) => s.updateSectionScheme);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(sectionScheme.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftName(sectionScheme.name);
    setEditingName(false);
  }, [sectionScheme.id, sectionScheme.name]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.select();
  }, [editingName]);

  const saveName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== sectionScheme.name) {
      updateSectionScheme(sectionScheme.id, { name: trimmed });
    } else {
      setDraftName(sectionScheme.name);
    }
    setEditingName(false);
  };

  const selectedIds = Array.from(selectedSectionIds);

  const handleFormClick = (formId: string) => {
    if (selectedIds.length > 0) {
      applySectionForm(selectedIds, formId);
    }
  };

  const handleClearForm = () => {
    if (selectedIds.length > 0) {
      clearSectionForm(selectedIds);
    }
  };

  const handleAddForm = () => {
    const newForm: SectionForm = {
      id: uuid(),
      label: `Section Form ${sectionScheme.forms.length + 1}`,
      shortcutKey: sectionScheme.forms.length < 9 ? sectionScheme.forms.length + 1 : 0,
      color: { hex: '#808080', alpha: 1 },
    };
    addSectionFormToScheme(sectionScheme.id, newForm);
  };

  const editingForm = editingFormId
    ? sectionScheme.forms.find((f) => f.id === editingFormId)
    : null;

  // All available section schemes (user + builtins)
  const allSchemes = [
    ...sectionSchemes,
    ...ALL_BUILTIN_SECTION_SCHEMES.filter((b) => !sectionSchemes.some((s) => s.id === b.id)),
  ];

  return (
    <div style={{ marginTop: '12px', borderTop: '1px solid #1a1a2e', paddingTop: '12px' }}>
      {/* Section scheme selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{
          fontSize: '12px', fontWeight: 600, color: '#808090',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          Section Scheme
        </span>
        <select
          value={sectionScheme.id}
          onChange={(e) => setActiveSectionScheme(e.target.value)}
          style={{
            flex: 1, background: '#1a1a2e', border: '1px solid #2a2a3e',
            borderRadius: '6px', color: '#e0e0e0', padding: '4px 8px',
            fontSize: '11px', cursor: 'pointer', outline: 'none',
          }}
        >
          {allSchemes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.forms.length})
            </option>
          ))}
        </select>
      </div>

      {/* Form list header with editable name */}
      <div style={{
        fontSize: '11px', fontWeight: 600, color: '#606070',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px',
      }}>
        Section Forms —{' '}
        {editingName ? (
          <input
            ref={nameInputRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName();
              if (e.key === 'Escape') { setDraftName(sectionScheme.name); setEditingName(false); }
            }}
            style={{
              background: '#1a1a2e', border: '1px solid #3B82F6', borderRadius: '4px',
              color: '#e0e0e0', padding: '1px 4px', fontSize: '11px', fontWeight: 600,
              outline: 'none', width: '120px', textTransform: 'none',
            }}
          />
        ) : (
          <span
            onClick={() => { if (!sectionScheme.builtIn) setEditingName(true); }}
            style={{
              cursor: sectionScheme.builtIn ? 'default' : 'pointer',
              borderBottom: sectionScheme.builtIn ? 'none' : '1px dashed #505060',
              color: '#808090', textTransform: 'none',
            }}
            title={sectionScheme.builtIn ? 'Built-in scheme (read-only)' : 'Click to rename'}
          >
            {sectionScheme.name}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {/* Default / clear */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 8px', borderRadius: '4px',
          }}
          onMouseEnter={(e) => { (e.currentTarget).style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { (e.currentTarget).style.backgroundColor = 'transparent'; }}
        >
          <button
            onClick={handleClearForm}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', flex: 1,
              backgroundColor: 'transparent', border: 'none',
              cursor: selectedIds.length > 0 ? 'pointer' : 'default',
              opacity: selectedIds.length > 0 ? 1 : 0.6,
              textAlign: 'left', padding: 0,
            }}
          >
            <div style={{
              width: '18px', height: '18px', borderRadius: '4px',
              backgroundColor: '#1a1a2e', flexShrink: 0,
              border: '1px solid rgba(255,255,255,0.1)',
            }} />
            <span style={{ fontSize: '12px', color: '#c0c0d0' }}>Default</span>
          </button>
          <span style={{
            fontSize: '10px', color: '#505060', fontFamily: 'monospace',
            backgroundColor: 'rgba(255,255,255,0.05)', padding: '1px 5px',
            borderRadius: '3px', flexShrink: 0,
          }}>
            0
          </span>
        </div>

        {sectionScheme.forms.map((form) => (
          <SectionFormRow
            key={form.id}
            form={form}
            isActive={selectedIds.length > 0}
            onClick={() => handleFormClick(form.id)}
            onEdit={() => setEditingFormId(form.id)}
          />
        ))}

        {/* Add form button */}
        {!sectionScheme.builtIn && (
          <button
            onClick={handleAddForm}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 8px', fontSize: '10px', color: '#60a5fa',
              background: 'rgba(59,130,246,0.08)', border: '1px dashed rgba(59,130,246,0.2)',
              borderRadius: '4px', cursor: 'pointer',
            }}
          >
            <Plus size={10} /> Add Section Form
          </button>
        )}
      </div>

      {selectedIds.length === 0 && (
        <div style={{ fontSize: '11px', color: '#505060', fontStyle: 'italic', padding: '8px 0' }}>
          Select sections to apply section forms.
        </div>
      )}

      {/* Section form editor modal */}
      {editingForm && (
        <SectionFormEditor
          form={editingForm}
          onSave={(updates) => updateSectionFormInScheme(sectionScheme.id, editingForm.id, updates)}
          onClose={() => setEditingFormId(null)}
        />
      )}
    </div>
  );
}

// ─── Reused sidebar sub-panels (moved from ColorKeySidebar) ─────────────────

function SectionOverview() {
  const sections = useProjectStore((s) => s.project.sections);
  const chunks = useProjectStore((s) => s.project.chunks);
  const currentChunkId = useProjectStore((s) => s.playback.currentChunkId);
  const currentChunk = chunks.find((c) => c.id === currentChunkId);

  const activeSections = sections.filter(s => (s.status ?? 'active') === 'active');
  const ordered = getFlatSectionOrder(activeSections);

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{
        fontSize: '12px', fontWeight: 600, color: '#808090',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px',
      }}>
        Sections
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {ordered.map((section) => {
          const count = chunks.filter((c) => c.sectionId === section.id && !c.isDeleted).length;
          const isCurrent = currentChunk?.sectionId === section.id;
          return (
            <button
              key={section.id}
              onClick={() => {
                const sectionChunks = chunks
                  .filter((c) => c.sectionId === section.id && !c.isDeleted)
                  .sort((a, b) => a.orderIndex - b.orderIndex);
                if (sectionChunks.length > 0) {
                  useProjectStore.getState().selectChunk(sectionChunks[0].id, 'replace');
                  useProjectStore.getState().setCurrentChunk(sectionChunks[0].id);
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '5px 8px', paddingLeft: `${8 + (section.depth ?? 0) * 12}px`,
                backgroundColor: isCurrent ? 'rgba(59,130,246,0.15)' : 'transparent',
                border: 'none', borderRadius: '4px', cursor: 'pointer',
                width: '100%', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '12px', color: isCurrent ? '#93c5fd' : '#a0a0b0', flex: 1 }}>
                {section.name}
              </span>
              <span style={{ fontSize: '10px', color: '#505060' }}>{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RemovedSectionsPanel() {
  const sections = useProjectStore((s) => s.project.sections);
  const chunks = useProjectStore((s) => s.project.chunks);
  const restoreSection = useProjectStore((s) => s.restoreSection);
  const deleteSection = useProjectStore((s) => s.deleteSection);
  const [isExpanded, setIsExpanded] = useState(false);

  const removedSections = sections.filter(s => (s.status ?? 'active') === 'removed');
  if (removedSections.length === 0) return null;

  return (
    <div style={{ marginTop: '8px' }}>
      <button
        onClick={() => setIsExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '12px', fontWeight: 600, color: '#F59E0B',
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%',
        }}
      >
        {isExpanded ? '▼' : '▶'} Removed ({removedSections.length})
      </button>
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {removedSections.map((section) => {
            const count = chunks.filter(c => c.sectionId === section.id && !c.isDeleted).length;
            return (
              <div key={section.id} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px',
                borderRadius: '4px', backgroundColor: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.15)',
              }}>
                <span style={{ fontSize: '11px', color: '#D4A030', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {section.name}
                </span>
                <span style={{ fontSize: '10px', color: '#806020' }}>{count}</span>
                <button onClick={() => restoreSection(section.id)} title="Restore" style={iconBtnStyle}>↩</button>
                <button onClick={() => deleteSection(section.id)} title="Trash" style={{ ...iconBtnStyle, color: '#806020' }}>🗑</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TrashBinPanel() {
  const sections = useProjectStore((s) => s.project.sections);
  const chunks = useProjectStore((s) => s.project.chunks);
  const restoreSection = useProjectStore((s) => s.restoreSection);
  const emptyTrash = useProjectStore((s) => s.emptyTrash);
  const [isExpanded, setIsExpanded] = useState(false);

  const trashedSections = sections.filter(s => (s.status ?? 'active') === 'trashed');
  if (trashedSections.length === 0) return null;

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
        <button
          onClick={() => setIsExpanded(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: '12px', fontWeight: 600, color: '#EF4444',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0, flex: 1,
          }}
        >
          {isExpanded ? '▼' : '▶'} Trash ({trashedSections.length})
        </button>
        <button
          onClick={emptyTrash}
          title="Empty trash"
          style={{
            fontSize: '10px', color: '#EF4444', background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px',
            padding: '2px 6px', cursor: 'pointer',
          }}
        >
          Empty
        </button>
      </div>
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {trashedSections.map((section) => {
            const count = chunks.filter(c => c.sectionId === section.id && !c.isDeleted).length;
            return (
              <div key={section.id} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px',
                borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.1)', opacity: 0.7,
              }}>
                <span style={{ fontSize: '11px', color: '#f87171', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {section.name}
                </span>
                <span style={{ fontSize: '10px', color: '#7f1d1d' }}>{count}</span>
                <button onClick={() => restoreSection(section.id)} title="Restore" style={iconBtnStyle}>↩</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', background: 'none', border: 'none',
  color: '#F59E0B', cursor: 'pointer', padding: '2px', borderRadius: '3px', flexShrink: 0,
  fontSize: '11px',
};
