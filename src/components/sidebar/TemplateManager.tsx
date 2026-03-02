import { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Layout, Copy, Trash2, Download, Upload, Check } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { BUILTIN_TEMPLATES } from '../../constants/templates';
import type { ColorKeyTemplate } from '../../types';

export function TemplateManager() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [saveName, setSaveName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const templates = useProjectStore((s) => s.project.templates);
  const applyTemplate = useProjectStore((s) => s.applyTemplate);
  const createTemplate = useProjectStore((s) => s.createTemplate);
  const deleteTemplate = useProjectStore((s) => s.deleteTemplate);
  const duplicateTemplate = useProjectStore((s) => s.duplicateTemplate);
  const exportTemplate = useProjectStore((s) => s.exportTemplate);
  const importTemplate = useProjectStore((s) => s.importTemplate);
  const colorKey = useProjectStore((s) => s.project.colorKey);
  const sfxMappings = useProjectStore((s) => s.project.settings.sfxMappings);

  const allTemplates = [...BUILTIN_TEMPLATES, ...templates.filter((t) => !t.builtIn)];

  const handleSaveCurrent = () => {
    const name = saveName.trim() || 'My Template';
    createTemplate({
      id: `tpl-${Date.now()}`,
      name,
      builtIn: false,
      colorKey: colorKey.colors,
      styles: {},
      sfxMappings: [...sfxMappings],
    });
    setSaveName('');
  };

  const handleExport = (id: string) => {
    const json = exportTemplate(id);
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const tpl = allTemplates.find((t) => t.id === id);
    a.download = `${tpl?.name ?? 'template'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importTemplate(reader.result as string);
      } catch {
        // silently ignore invalid imports
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div style={{ marginTop: '8px' }}>
      <button
        onClick={() => setIsExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#808090',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '4px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          width: '100%',
        }}
      >
        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Layout size={12} />
        Templates
        <span style={{ fontSize: '10px', color: '#505060' }}>({allTemplates.length})</span>
      </button>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '4px' }}>
          {/* Template list */}
          {allTemplates.map((tpl) => (
            <TemplateRow
              key={tpl.id}
              template={tpl}
              onApply={(mode) => applyTemplate(tpl.id, mode)}
              onDuplicate={() => duplicateTemplate(tpl.id)}
              onDelete={tpl.builtIn ? undefined : () => deleteTemplate(tpl.id)}
              onExport={() => handleExport(tpl.id)}
            />
          ))}

          {/* Save current */}
          <div style={{ marginTop: '6px', display: 'flex', gap: '4px' }}>
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Template name..."
              style={{
                flex: 1,
                background: '#1a1a2e',
                border: '1px solid #2a2a3e',
                borderRadius: '4px',
                color: '#e0e0e0',
                fontSize: '10px',
                padding: '3px 6px',
                outline: 'none',
              }}
            />
            <button onClick={handleSaveCurrent} style={actionBtnStyle}>
              Save Current
            </button>
          </div>

          {/* Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ ...actionBtnStyle, width: '100%' }}
          >
            <Upload size={10} /> Import Template
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            style={{ display: 'none' }}
          />
        </div>
      )}
    </div>
  );
}

function TemplateRow({
  template,
  onApply,
  onDuplicate,
  onDelete,
  onExport,
}: {
  template: ColorKeyTemplate;
  onApply: (mode: 'both' | 'colors' | 'sounds') => void;
  onDuplicate: () => void;
  onDelete?: () => void;
  onExport: () => void;
}) {
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const hasSfx = template.sfxMappings.length > 0;

  // Close popover on click outside
  useEffect(() => {
    if (!showPopover) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPopover]);

  const handleApplyClick = () => {
    if (hasSfx) {
      setShowPopover((v) => !v);
    } else {
      onApply('colors');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 4px',
        borderRadius: '4px',
        backgroundColor: 'rgba(255,255,255,0.02)',
        position: 'relative',
      }}
    >
      {/* Color swatches preview */}
      <div style={{ display: 'flex', gap: '1px', flexShrink: 0 }}>
        {template.colorKey.slice(0, 5).map((c, i) => (
          <div
            key={i}
            style={{
              width: '6px',
              height: '10px',
              borderRadius: '1px',
              backgroundColor: c.hex,
            }}
          />
        ))}
      </div>

      <span
        style={{
          fontSize: '10px',
          color: '#a0a0b0',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {template.name}
        {template.builtIn && (
          <span style={{ fontSize: '8px', color: '#505060', marginLeft: '4px' }}>built-in</span>
        )}
      </span>

      <button onClick={handleApplyClick} title="Apply template" style={iconBtnStyle}>
        <Check size={10} />
      </button>
      <button onClick={onDuplicate} title="Duplicate" style={iconBtnStyle}>
        <Copy size={10} />
      </button>
      <button onClick={onExport} title="Export" style={iconBtnStyle}>
        <Download size={10} />
      </button>
      {onDelete && (
        <button onClick={onDelete} title="Delete" style={{ ...iconBtnStyle, color: '#EF4444' }}>
          <Trash2 size={10} />
        </button>
      )}

      {/* Apply mode popover */}
      {showPopover && (
        <div
          ref={popoverRef}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '2px',
            background: '#1a1a2e',
            border: '1px solid #2a2a3e',
            borderRadius: '6px',
            padding: '4px 0',
            zIndex: 100,
            minWidth: '130px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          <PopoverOption
            label="Colors & Sounds"
            onClick={() => { onApply('both'); setShowPopover(false); }}
          />
          <PopoverOption
            label="Colors Only"
            onClick={() => { onApply('colors'); setShowPopover(false); }}
          />
          <PopoverOption
            label="Sounds Only"
            onClick={() => { onApply('sounds'); setShowPopover(false); }}
          />
        </div>
      )}
    </div>
  );
}

function PopoverOption({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: '5px 12px',
        background: 'none',
        border: 'none',
        color: '#a0a0b0',
        fontSize: '10px',
        textAlign: 'left',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
      onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      {label}
    </button>
  );
}

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  background: 'none',
  border: 'none',
  color: '#606070',
  cursor: 'pointer',
  padding: '2px',
  borderRadius: '3px',
  flexShrink: 0,
};

const actionBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  padding: '3px 6px',
  background: 'none',
  border: '1px solid #2a2a3e',
  borderRadius: '4px',
  color: '#a0a0b0',
  fontSize: '10px',
  cursor: 'pointer',
};
