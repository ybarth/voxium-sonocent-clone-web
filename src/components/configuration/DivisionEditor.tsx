// Division Editor — Form for configuring division criteria and presets

import { useState, useCallback } from 'react';
import { X, Eye, Check, Save } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import type { DivisionPreset, DivisionCriterion, DivisionCriterionType } from '../../types/configuration';
import { v4 as uuid } from 'uuid';

interface DivisionEditorProps {
  sectionId: string;
  presets: DivisionPreset[];
  onClose: () => void;
}

const ALL_CRITERION_TYPES: { type: DivisionCriterionType; label: string; requiresTranscription: boolean }[] = [
  { type: 'silence', label: 'Silence', requiresTranscription: false },
  { type: 'volume-fluctuation', label: 'Volume Fluctuation', requiresTranscription: false },
  { type: 'loudness', label: 'Loudness', requiresTranscription: false },
  { type: 'max-duration', label: 'Max Duration', requiresTranscription: false },
  { type: 'target-duration', label: 'Target Duration', requiresTranscription: false },
  { type: 'cadence', label: 'Cadence', requiresTranscription: false },
  { type: 'grammar', label: 'Grammar', requiresTranscription: true },
  { type: 'topic', label: 'Topic', requiresTranscription: true },
  { type: 'word-level', label: 'Word Level', requiresTranscription: true },
];

function defaultParamsForType(type: DivisionCriterionType): Record<string, number | string | boolean> {
  switch (type) {
    case 'silence': return { thresholdDb: -40, minSilenceDurationMs: 300, minChunkDurationMs: 500 };
    case 'volume-fluctuation': return { fluctuationThresholdDb: -6, smoothingWindowMs: 50, minGapMs: 300 };
    case 'loudness': return { loudnessThresholdLufs: -30, windowMs: 400, minGapMs: 500 };
    case 'max-duration': return { maxMs: 5000 };
    case 'target-duration': return { targetMs: 10000 };
    case 'cadence': return { silenceThresholdDb: -35, minPauseDurationMs: 150, phraseGrouping: 2 };
    case 'grammar': return { granularity: 'sentence', minPauseBetweenMs: 100 };
    case 'topic': return { windowSize: 50, overlap: 10, sensitivity: 'medium' };
    case 'word-level': return {};
    case 'manual': return {};
    default: return {};
  }
}

export function DivisionEditor({ sectionId, presets, onClose }: DivisionEditorProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<DivisionCriterion[]>([
    { type: 'silence', enabled: true, weight: 1.0, params: defaultParamsForType('silence') },
  ]);

  const hasTranscription = useProjectStore((s) => s.project.transcription.words.length > 0);
  const applyCustomDivision = useProjectStore((s) => s.applyCustomDivision);
  const applyDivisionPreset = useProjectStore((s) => s.applyDivisionPreset);
  const setPreviewConfig = useProjectStore((s) => s.setPreviewConfig);
  const addDivisionPreset = useProjectStore((s) => s.addDivisionPreset);

  const handlePresetSelect = useCallback((presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setSelectedPresetId(presetId);
      setCriteria(preset.criteria.map(c => ({ ...c })));
    }
  }, [presets]);

  const handleToggleCriterion = useCallback((index: number) => {
    setCriteria(prev => prev.map((c, i) => i === index ? { ...c, enabled: !c.enabled } : c));
  }, []);

  const handleWeightChange = useCallback((index: number, weight: number) => {
    setCriteria(prev => prev.map((c, i) => i === index ? { ...c, weight } : c));
  }, []);

  const handleParamChange = useCallback((index: number, key: string, value: number | string | boolean) => {
    setCriteria(prev => prev.map((c, i) =>
      i === index ? { ...c, params: { ...c.params, [key]: value } } : c,
    ));
  }, []);

  const handleAddCriterion = useCallback((type: DivisionCriterionType) => {
    setCriteria(prev => [...prev, {
      type,
      enabled: true,
      weight: 0.5,
      params: defaultParamsForType(type),
    }]);
  }, []);

  const handleRemoveCriterion = useCallback((index: number) => {
    setCriteria(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleApply = useCallback(() => {
    if (selectedPresetId) {
      applyDivisionPreset(sectionId, selectedPresetId);
    } else {
      applyCustomDivision(sectionId, criteria);
    }
    onClose();
  }, [sectionId, selectedPresetId, criteria, applyDivisionPreset, applyCustomDivision, onClose]);

  const handleSaveAsPreset = useCallback(() => {
    const name = prompt('Preset name:');
    if (!name) return;
    addDivisionPreset({
      id: uuid(),
      name,
      builtIn: false,
      criteria: criteria.map(c => ({ ...c })),
    });
  }, [criteria, addDivisionPreset]);

  // Available types not already in criteria
  const availableTypes = ALL_CRITERION_TYPES.filter(
    t => !criteria.some(c => c.type === t.type),
  );

  return (
    <div style={{
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '6px',
      padding: '8px',
      backgroundColor: 'rgba(0,0,0,0.2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#c0c0d0' }}>Division Editor</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#606070', cursor: 'pointer', padding: '2px' }}>
          <X size={14} />
        </button>
      </div>

      {/* Preset Selector */}
      <div style={{ marginBottom: '8px' }}>
        <select
          value={selectedPresetId ?? ''}
          onChange={(e) => e.target.value ? handlePresetSelect(e.target.value) : setSelectedPresetId(null)}
          style={{
            width: '100%',
            padding: '4px 6px',
            fontSize: '11px',
            backgroundColor: '#1a1a2e',
            color: '#c0c0d0',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '3px',
          }}
        >
          <option value="">Custom</option>
          {presets.map(p => (
            <option key={p.id} value={p.id}>{p.name}{p.builtIn ? ' (built-in)' : ''}</option>
          ))}
        </select>
      </div>

      {/* Criteria Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
        {criteria.map((criterion, idx) => (
          <CriterionRow
            key={`${criterion.type}-${idx}`}
            criterion={criterion}
            hasTranscription={hasTranscription}
            onToggle={() => handleToggleCriterion(idx)}
            onWeightChange={(w) => handleWeightChange(idx, w)}
            onParamChange={(k, v) => handleParamChange(idx, k, v)}
            onRemove={() => handleRemoveCriterion(idx)}
          />
        ))}
      </div>

      {/* Add Criterion */}
      {availableTypes.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <select
            onChange={(e) => {
              if (e.target.value) {
                handleAddCriterion(e.target.value as DivisionCriterionType);
                e.target.value = '';
              }
            }}
            defaultValue=""
            style={{
              width: '100%',
              padding: '4px 6px',
              fontSize: '10px',
              backgroundColor: '#1a1a2e',
              color: '#808090',
              border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: '3px',
            }}
          >
            <option value="">+ Add criterion...</option>
            {availableTypes.map(t => (
              <option key={t.type} value={t.type} disabled={t.requiresTranscription && !hasTranscription}>
                {t.label}{t.requiresTranscription && !hasTranscription ? ' (needs transcription)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          onClick={handleApply}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
            padding: '4px 8px', fontSize: '11px', background: '#3B82F6',
            color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer',
          }}
        >
          <Check size={12} /> Apply
        </button>
        <button
          onClick={handleSaveAsPreset}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 8px', fontSize: '11px', background: 'rgba(255,255,255,0.05)',
            color: '#a0a0b0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', cursor: 'pointer',
          }}
          title="Save as preset"
        >
          <Save size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Criterion Row ─────────────────────────────────────────────────────────

interface CriterionRowProps {
  criterion: DivisionCriterion;
  hasTranscription: boolean;
  onToggle: () => void;
  onWeightChange: (w: number) => void;
  onParamChange: (key: string, value: number | string | boolean) => void;
  onRemove: () => void;
}

function CriterionRow({ criterion, hasTranscription, onToggle, onWeightChange, onParamChange, onRemove }: CriterionRowProps) {
  const label = ALL_CRITERION_TYPES.find(t => t.type === criterion.type)?.label ?? criterion.type;
  const needsTranscription = ALL_CRITERION_TYPES.find(t => t.type === criterion.type)?.requiresTranscription;
  const disabled = needsTranscription && !hasTranscription;

  return (
    <div style={{
      padding: '4px 6px',
      borderRadius: '3px',
      border: '1px solid rgba(255,255,255,0.05)',
      opacity: disabled ? 0.4 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input
          type="checkbox"
          checked={criterion.enabled && !disabled}
          onChange={onToggle}
          disabled={disabled}
          style={{ accentColor: '#3B82F6' }}
        />
        <span style={{ fontSize: '11px', color: '#c0c0d0', flex: 1 }}>{label}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={criterion.weight}
          onChange={(e) => onWeightChange(parseFloat(e.target.value))}
          style={{ width: '60px', accentColor: '#3B82F6' }}
          title={`Weight: ${criterion.weight.toFixed(2)}`}
        />
        <span style={{ fontSize: '9px', color: '#808090', width: '24px', textAlign: 'right' }}>
          {(criterion.weight * 100).toFixed(0)}%
        </span>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', color: '#606070', cursor: 'pointer', padding: '1px' }}>
          <X size={10} />
        </button>
      </div>

      {/* Type-specific params */}
      {criterion.type !== 'word-level' && criterion.type !== 'manual' && (
        <div style={{ marginTop: '4px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {Object.entries(criterion.params).map(([key, val]) => (
            <ParamInput key={key} paramKey={key} value={val} onChange={(v) => onParamChange(key, v)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Param Input ───────────────────────────────────────────────────────────

function ParamInput({ paramKey, value, onChange }: { paramKey: string; value: number | string | boolean; onChange: (v: number | string | boolean) => void }) {
  const label = paramKey.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

  if (typeof value === 'boolean') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#808090' }}>
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: '#3B82F6' }} />
        {label}
      </label>
    );
  }

  if (paramKey === 'granularity') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#808090' }}>
        {label}:
        <select
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          style={{
            padding: '1px 4px', fontSize: '10px', backgroundColor: '#1a1a2e',
            color: '#c0c0d0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px',
          }}
        >
          <option value="sentence">Sentence</option>
          <option value="clause">Clause</option>
          <option value="phrase">Phrase</option>
        </select>
      </label>
    );
  }

  if (paramKey === 'sensitivity') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#808090' }}>
        {label}:
        <select
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          style={{
            padding: '1px 4px', fontSize: '10px', backgroundColor: '#1a1a2e',
            color: '#c0c0d0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px',
          }}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
    );
  }

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#808090' }}>
      {label}:
      <input
        type="number"
        value={value as number}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{
          width: '60px', padding: '1px 4px', fontSize: '10px', backgroundColor: '#1a1a2e',
          color: '#c0c0d0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px',
        }}
      />
    </label>
  );
}
