import { useState } from 'react';
import { ChevronRight, ChevronDown, Filter } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import type { FilterCriteria } from '../../types';

type FilterTab = 'color' | 'form';

export function FilterPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [extractName, setExtractName] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('form');

  const colorKey = useProjectStore((s) => s.project.colorKey);
  const scheme = useProjectStore((s) => s.project.scheme);
  const filter = useProjectStore((s) => s.project.settings.filter);
  const chunks = useProjectStore((s) => s.project.chunks);
  const toggleFilterCriterion = useProjectStore((s) => s.toggleFilterCriterion);
  const clearFilter = useProjectStore((s) => s.clearFilter);
  const extractFilteredChunks = useProjectStore((s) => s.extractFilteredChunks);
  const copyFilteredChunks = useProjectStore((s) => s.copyFilteredChunks);
  const getFilteredChunkIds = useProjectStore((s) => s.getFilteredChunkIds);

  const matchingIds = getFilteredChunkIds();
  const totalChunks = chunks.filter((c) => !c.isDeleted).length;

  const isCriterionActive = (crit: FilterCriteria) =>
    filter.criteria.some(
      (c) => c.type === crit.type && c.colorHex === crit.colorHex && c.textureId === crit.textureId && c.formId === crit.formId
    );

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
          color: filter.active ? '#3B82F6' : '#808090',
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
        <Filter size={12} />
        Filter
        {filter.active && (
          <span style={{
            fontSize: '10px',
            backgroundColor: '#3B82F6',
            color: '#fff',
            borderRadius: '8px',
            padding: '0 5px',
            marginLeft: '4px',
          }}>
            {matchingIds.size}
          </span>
        )}
      </button>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '4px' }}>
          {/* Tab toggle: Form / Color */}
          <div style={{ display: 'flex', gap: '2px', marginBottom: '4px' }}>
            {(['form', 'color'] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                style={{
                  flex: 1, padding: '3px 0', fontSize: '10px', textTransform: 'capitalize',
                  backgroundColor: filterTab === tab ? 'rgba(59,130,246,0.15)' : 'transparent',
                  border: filterTab === tab ? '1px solid rgba(59,130,246,0.3)' : '1px solid #1a1a2e',
                  borderRadius: '4px', color: filterTab === tab ? '#93c5fd' : '#606070',
                  cursor: 'pointer',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Form checkboxes */}
          {filterTab === 'form' && scheme.forms.map((form) => {
            const criterion: FilterCriteria = { type: 'form', formId: form.id };
            const active = isCriterionActive(criterion);
            return (
              <label
                key={form.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  color: '#a0a0b0',
                  cursor: 'pointer',
                  padding: '2px 0',
                }}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleFilterCriterion(criterion)}
                  style={{ accentColor: '#3B82F6' }}
                />
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '3px',
                    backgroundColor: form.color?.hex ?? '#808080',
                    flexShrink: 0,
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                />
                {form.label}
              </label>
            );
          })}

          {/* Color checkboxes */}
          {filterTab === 'color' && colorKey.colors.map((entry) => {
            const criterion: FilterCriteria = { type: 'color', colorHex: entry.hex };
            const active = isCriterionActive(criterion);
            return (
              <label
                key={entry.hex}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  color: '#a0a0b0',
                  cursor: 'pointer',
                  padding: '2px 0',
                }}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleFilterCriterion(criterion)}
                  style={{ accentColor: '#3B82F6' }}
                />
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '3px',
                    backgroundColor: entry.hex,
                    flexShrink: 0,
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                />
                {entry.label}
              </label>
            );
          })}

          {/* Match count */}
          {filter.active && (
            <div style={{ fontSize: '10px', color: '#606070', padding: '4px 0' }}>
              {matchingIds.size} of {totalChunks} chunks match
            </div>
          )}

          {/* Actions */}
          {filter.active && matchingIds.size > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
              <input
                value={extractName}
                onChange={(e) => setExtractName(e.target.value)}
                placeholder="Section name..."
                style={{
                  background: '#1a1a2e',
                  border: '1px solid #2a2a3e',
                  borderRadius: '4px',
                  color: '#e0e0e0',
                  fontSize: '11px',
                  padding: '4px 8px',
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => {
                    extractFilteredChunks(extractName || 'Extracted');
                    setExtractName('');
                  }}
                  style={actionBtnStyle}
                >
                  Extract to Section
                </button>
                <button
                  onClick={() => {
                    copyFilteredChunks(extractName || 'Copied');
                    setExtractName('');
                  }}
                  style={actionBtnStyle}
                >
                  Copy to Section
                </button>
              </div>
            </div>
          )}

          {/* Clear */}
          {filter.active && (
            <button
              onClick={clearFilter}
              style={{ ...actionBtnStyle, color: '#808090' }}
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '4px 6px',
  background: 'none',
  border: '1px solid #2a2a3e',
  borderRadius: '4px',
  color: '#a0a0b0',
  fontSize: '10px',
  cursor: 'pointer',
  textAlign: 'center',
};
