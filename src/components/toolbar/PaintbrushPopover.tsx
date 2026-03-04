import { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import type { PaintbrushAction, PaintbrushScope, ResettableAttribute } from '../../stores/projectStore';

type ActionTab = 'apply-form' | 'apply-tags' | 'remove-tags' | 'reset';

const SCOPE_LABELS: Record<PaintbrushScope, string> = {
  'single-chunk': 'Single Chunk',
  'single-section': 'Single Section',
  'form-of-chunk': 'All Chunks with Form...',
  'form-of-section': 'All Sections with Form...',
  'form-of-chunk-in-section': 'Chunks with Form in Section',
  'form-of-chunk-in-section-form': 'Chunks with Form in Section Form',
};

const RESET_LABELS: Record<ResettableAttribute, string> = {
  'form': 'Chunk Form (clears form, color, style)',
  'section-form': 'Section Form',
  'color': 'Color (keeps form)',
  'tags': 'Tags (empties tag list)',
  'shape': 'Shape (clears form)',
};

export function PaintbrushPopover({ onClose }: { onClose: () => void }) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const classicMode = useProjectStore((s) => s.project.settings.classicMode);
  const scheme = useProjectStore((s) => s.project.scheme);
  const sectionScheme = useProjectStore((s) => s.project.sectionScheme);
  const tagLibrary = useProjectStore((s) => s.project.tagLibrary);
  const setPaintbrushMode = useProjectStore((s) => s.setPaintbrushMode);

  const [actionTab, setActionTab] = useState<ActionTab>('apply-form');
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [resetAttribute, setResetAttribute] = useState<ResettableAttribute>('form');
  const [scope, setScope] = useState<PaintbrushScope>('single-chunk');
  const [scopeFilterFormId, setScopeFilterFormId] = useState<string>('');
  const [scopeFilterSectionFormId, setScopeFilterSectionFormId] = useState<string>('');

  // Close on click outside or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleKey);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const needsScopeFilterForm = scope === 'form-of-chunk' || scope === 'form-of-chunk-in-section' || scope === 'form-of-chunk-in-section-form';
  const needsScopeFilterSectionForm = scope === 'form-of-section' || scope === 'form-of-chunk-in-section-form';

  const isReady = (() => {
    switch (actionTab) {
      case 'apply-form': return !!selectedFormId;
      case 'apply-tags':
      case 'remove-tags': return selectedTags.size > 0;
      case 'reset': return true;
    }
  })();

  const scopeFiltersReady = (() => {
    if (needsScopeFilterForm && !scopeFilterFormId) return false;
    if (needsScopeFilterSectionForm && !scopeFilterSectionFormId) return false;
    return true;
  })();

  const canActivate = isReady && scopeFiltersReady;

  const handleActivate = () => {
    if (!canActivate) return;

    let action: PaintbrushAction;
    switch (actionTab) {
      case 'apply-form':
        action = { type: 'apply-form', formId: selectedFormId };
        break;
      case 'apply-tags':
        action = { type: 'apply-tags', tags: [...selectedTags] };
        break;
      case 'remove-tags':
        action = { type: 'remove-tags', tags: [...selectedTags] };
        break;
      case 'reset':
        action = { type: 'reset-attribute', attribute: resetAttribute };
        break;
    }

    setPaintbrushMode({
      action,
      scope,
      ...(needsScopeFilterForm && scopeFilterFormId ? { scopeFilterFormId } : {}),
      ...(needsScopeFilterSectionForm && scopeFilterSectionFormId ? { scopeFilterSectionFormId } : {}),
    });
    onClose();
  };

  const cm = classicMode;
  const bg = cm ? '#ffffff' : '#1e1e2e';
  const border = cm ? '1px solid #d0d3d8' : '1px solid #2a2a3e';
  const textColor = cm ? '#2a2a3a' : '#e0e0e0';
  const mutedColor = cm ? '#808898' : '#707080';
  const activeBg = cm ? '#dbeafe' : 'rgba(59,130,246,0.2)';
  const activeColor = cm ? '#1d4ed8' : '#60a5fa';

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: '4px',
        backgroundColor: bg,
        border,
        borderRadius: '8px',
        padding: '12px',
        minWidth: '320px',
        maxWidth: '380px',
        boxShadow: cm ? '0 8px 24px rgba(0,0,0,0.15)' : '0 8px 24px rgba(0,0,0,0.5)',
        zIndex: 1000,
        color: textColor,
        fontSize: '12px',
      }}
    >
      {/* Section 1: Action type tabs */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: mutedColor, textTransform: 'uppercase', marginBottom: '4px' }}>
          Action
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {([
            ['apply-form', 'Apply Form'],
            ['apply-tags', 'Add Tags'],
            ['remove-tags', 'Remove Tags'],
            ['reset', 'Reset'],
          ] as [ActionTab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActionTab(tab)}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: actionTab === tab ? `1px solid ${activeColor}` : '1px solid transparent',
                backgroundColor: actionTab === tab ? activeBg : 'transparent',
                color: actionTab === tab ? activeColor : mutedColor,
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Section 2: Payload */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: mutedColor, textTransform: 'uppercase', marginBottom: '4px' }}>
          {actionTab === 'apply-form' ? 'Form' : actionTab === 'reset' ? 'Attribute' : 'Tags'}
        </div>

        {actionTab === 'apply-form' && (
          <select
            value={selectedFormId}
            onChange={(e) => setSelectedFormId(e.target.value)}
            style={selectStyle(cm)}
          >
            <option value="">-- Select Form --</option>
            <optgroup label="Chunk Forms">
              {scheme.forms.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </optgroup>
            <optgroup label="Section Forms">
              {sectionScheme.forms.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </optgroup>
          </select>
        )}

        {(actionTab === 'apply-tags' || actionTab === 'remove-tags') && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '100px', overflowY: 'auto' }}>
            {tagLibrary.length === 0 && (
              <span style={{ color: mutedColor, fontStyle: 'italic' }}>No tags in library</span>
            )}
            {tagLibrary.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                style={{
                  padding: '2px 8px',
                  borderRadius: '10px',
                  border: selectedTags.has(tag) ? `1px solid ${activeColor}` : `1px solid ${cm ? '#d0d3d8' : '#3a3a4e'}`,
                  backgroundColor: selectedTags.has(tag) ? activeBg : 'transparent',
                  color: selectedTags.has(tag) ? activeColor : textColor,
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {actionTab === 'reset' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {(Object.keys(RESET_LABELS) as ResettableAttribute[]).map(attr => (
              <label
                key={attr}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              >
                <input
                  type="radio"
                  name="resetAttr"
                  checked={resetAttribute === attr}
                  onChange={() => setResetAttribute(attr)}
                />
                <span>{RESET_LABELS[attr]}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Scope */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: mutedColor, textTransform: 'uppercase', marginBottom: '4px' }}>
          Scope
        </div>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as PaintbrushScope)}
          style={selectStyle(cm)}
        >
          {(Object.keys(SCOPE_LABELS) as PaintbrushScope[]).map(s => (
            <option key={s} value={s}>{SCOPE_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Section 4: Scope filters */}
      {needsScopeFilterForm && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: mutedColor, textTransform: 'uppercase', marginBottom: '4px' }}>
            Filter: Chunk Form
          </div>
          <select
            value={scopeFilterFormId}
            onChange={(e) => setScopeFilterFormId(e.target.value)}
            style={selectStyle(cm)}
          >
            <option value="">-- Select Form --</option>
            {scheme.forms.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      )}

      {needsScopeFilterSectionForm && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: mutedColor, textTransform: 'uppercase', marginBottom: '4px' }}>
            Filter: Section Form
          </div>
          <select
            value={scopeFilterSectionFormId}
            onChange={(e) => setScopeFilterSectionFormId(e.target.value)}
            style={selectStyle(cm)}
          >
            <option value="">-- Select Form --</option>
            {sectionScheme.forms.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Section 5: Activate button */}
      <button
        onClick={handleActivate}
        disabled={!canActivate}
        style={{
          width: '100%',
          padding: '8px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: canActivate ? '#3B82F6' : (cm ? '#d0d3d8' : '#2a2a3e'),
          color: canActivate ? '#ffffff' : mutedColor,
          cursor: canActivate ? 'pointer' : 'not-allowed',
          fontWeight: 600,
          fontSize: '12px',
        }}
      >
        Activate Paintbrush
      </button>
    </div>
  );
}

function selectStyle(cm: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '5px 8px',
    borderRadius: '4px',
    border: cm ? '1px solid #b8bcc4' : '1px solid #3a3a4e',
    backgroundColor: cm ? '#f0f1f3' : '#141420',
    color: cm ? '#2a2a3a' : '#e0e0e0',
    fontSize: '11px',
    outline: 'none',
    cursor: 'pointer',
  };
}
