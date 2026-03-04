import { useState } from 'react';
import { ChevronRight, ChevronDown, Tag, X, Plus } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import type { FilterCriteria } from '../../types';

export function TagManager() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newTag, setNewTag] = useState('');

  const tagLibrary = useProjectStore((s) => s.project.tagLibrary ?? []);
  const selectedChunkIds = useProjectStore((s) => s.selection.selectedChunkIds);
  const selectedSectionIds = useProjectStore((s) => s.selection.selectedSectionIds);
  const chunks = useProjectStore((s) => s.project.chunks);
  const filter = useProjectStore((s) => s.project.settings.filter);
  const tagChunks = useProjectStore((s) => s.tagChunks);
  const untagChunks = useProjectStore((s) => s.untagChunks);
  const tagSections = useProjectStore((s) => s.tagSections);
  const untagSections = useProjectStore((s) => s.untagSections);
  const addTagToLibrary = useProjectStore((s) => s.addTagToLibrary);
  const removeTagFromLibrary = useProjectStore((s) => s.removeTagFromLibrary);
  const toggleFilterCriterion = useProjectStore((s) => s.toggleFilterCriterion);

  const selectedIds = Array.from(selectedChunkIds);
  const selectedSecIds = Array.from(selectedSectionIds);

  // Tags currently on ALL selected chunks
  const selectedChunks = chunks.filter(c => selectedChunkIds.has(c.id) && !c.isDeleted);
  const commonTags = selectedChunks.length > 0
    ? (selectedChunks[0].tags ?? []).filter(t =>
        selectedChunks.every(c => (c.tags ?? []).includes(t))
      )
    : [];

  const handleAddTag = () => {
    const tag = newTag.trim();
    if (!tag) return;
    addTagToLibrary(tag);
    if (selectedIds.length > 0) tagChunks(selectedIds, [tag]);
    if (selectedSecIds.length > 0) tagSections(selectedSecIds, [tag]);
    setNewTag('');
  };

  const handleApplyTag = (tag: string) => {
    if (selectedIds.length > 0) tagChunks(selectedIds, [tag]);
    if (selectedSecIds.length > 0) tagSections(selectedSecIds, [tag]);
  };

  const handleRemoveTag = (tag: string) => {
    if (selectedIds.length > 0) untagChunks(selectedIds, [tag]);
    if (selectedSecIds.length > 0) untagSections(selectedSecIds, [tag]);
  };

  const isCriterionActive = (tag: string) =>
    filter.criteria.some(c => c.type === 'tag' && c.tag === tag);

  const handleToggleFilter = (tag: string) => {
    const criterion: FilterCriteria = { type: 'tag', tag };
    toggleFilterCriterion(criterion);
  };

  return (
    <div style={{ marginTop: '8px' }}>
      <button
        onClick={() => setIsExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '12px', fontWeight: 600,
          color: '#808090', textTransform: 'uppercase',
          letterSpacing: '0.05em', marginBottom: '4px',
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, width: '100%',
        }}
      >
        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Tag size={12} />
        Tags
        {tagLibrary.length > 0 && (
          <span style={{
            fontSize: '10px', backgroundColor: '#6B7280',
            color: '#fff', borderRadius: '8px', padding: '0 5px', marginLeft: '4px',
          }}>
            {tagLibrary.length}
          </span>
        )}
      </button>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '4px' }}>
          {/* New tag input */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); }}
              placeholder="New tag..."
              style={{
                flex: 1, background: '#1a1a2e', border: '1px solid #2a2a3e',
                borderRadius: '4px', color: '#e0e0e0', fontSize: '11px',
                padding: '4px 8px', outline: 'none',
              }}
            />
            <button onClick={handleAddTag} style={smallBtnStyle}>
              <Plus size={12} />
            </button>
          </div>

          {/* Tags on current selection */}
          {commonTags.length > 0 && (
            <div style={{ fontSize: '10px', color: '#606070', marginTop: '2px' }}>
              On selection:
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '2px' }}>
                {commonTags.map(tag => (
                  <span key={tag} style={tagChipStyle}>
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      style={{ background: 'none', border: 'none', color: '#808090', cursor: 'pointer', padding: 0, marginLeft: '2px', lineHeight: 1 }}
                    >
                      <X size={8} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tag library */}
          {tagLibrary.map(tag => (
            <div
              key={tag}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '11px', color: '#a0a0b0', padding: '2px 0',
              }}
            >
              {/* Filter checkbox */}
              <input
                type="checkbox"
                checked={isCriterionActive(tag)}
                onChange={() => handleToggleFilter(tag)}
                title="Filter by this tag"
                style={{ accentColor: '#3B82F6', width: '12px', height: '12px' }}
              />
              <span style={{ flex: 1, cursor: 'pointer' }} onClick={() => handleApplyTag(tag)}>
                {tag}
              </span>
              <button
                onClick={() => removeTagFromLibrary(tag)}
                style={{ background: 'none', border: 'none', color: '#606070', cursor: 'pointer', padding: 0 }}
                title="Delete tag"
              >
                <X size={10} />
              </button>
            </div>
          ))}

          {tagLibrary.length === 0 && (
            <div style={{ fontSize: '10px', color: '#606070', fontStyle: 'italic' }}>
              No tags yet. Create one above.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const smallBtnStyle: React.CSSProperties = {
  padding: '4px 6px', background: 'none', border: '1px solid #2a2a3e',
  borderRadius: '4px', color: '#a0a0b0', cursor: 'pointer', display: 'flex',
  alignItems: 'center',
};

const tagChipStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  backgroundColor: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
  borderRadius: '3px', padding: '1px 5px', fontSize: '10px', color: '#93c5fd',
};
