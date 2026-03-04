// Configuration Panel — Sidebar panel for managing section versions and configurations

import { useState, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Settings2, Sparkles,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { DivisionEditor } from './DivisionEditor';
import { AISuggestionsPanel } from './AISuggestionsPanel';

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  background: 'none',
  border: 'none',
  color: '#505060',
  cursor: 'pointer',
  padding: '2px',
  borderRadius: '3px',
  flexShrink: 0,
};

export function ConfigurationPanel() {
  const [showEditor, setShowEditor] = useState(false);
  const [showAI, setShowAI] = useState(false);

  // Get the focused section (first selected section, or section of current chunk)
  const currentChunkId = useProjectStore((s) => s.playback.currentChunkId);
  const chunks = useProjectStore((s) => s.project.chunks);
  const selectedSectionIds = useProjectStore((s) => s.selection.selectedSectionIds);
  const sectionConfigs = useProjectStore((s) => s.project.sectionConfigs);
  const divisionPresets = useProjectStore((s) => s.project.divisionPresets);

  const initSectionConfig = useProjectStore((s) => s.initSectionConfig);
  const switchConfiguration = useProjectStore((s) => s.switchConfiguration);
  const cycleConfiguration = useProjectStore((s) => s.cycleConfiguration);
  const switchVersion = useProjectStore((s) => s.switchVersion);
  const deleteConfiguration = useProjectStore((s) => s.deleteConfiguration);
  const renameConfiguration = useProjectStore((s) => s.renameConfiguration);

  // Determine the active section
  let activeSectionId: string | null = null;
  if (selectedSectionIds.size > 0) {
    activeSectionId = [...selectedSectionIds][0];
  } else if (currentChunkId) {
    const chunk = chunks.find((c) => c.id === currentChunkId);
    if (chunk) activeSectionId = chunk.sectionId;
  }

  const configState = activeSectionId ? sectionConfigs[activeSectionId] : null;
  const activeVersion = configState
    ? configState.versions[configState.activeVersionIndex]
    : null;
  const activeConfig = activeVersion && activeVersion.activeConfigIndex >= 0
    ? activeVersion.configurations[activeVersion.activeConfigIndex]
    : null;

  const handleInitConfig = useCallback(() => {
    if (activeSectionId) initSectionConfig(activeSectionId);
  }, [activeSectionId, initSectionConfig]);

  if (!activeSectionId) {
    return (
      <div style={{ padding: '12px', color: '#808090', fontSize: '12px' }}>
        Select a section to manage its configurations.
      </div>
    );
  }

  if (!configState) {
    return (
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '12px', color: '#808090' }}>
          No configuration state for this section.
        </div>
        <button
          onClick={handleInitConfig}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            background: '#3B82F6',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Initialize Configuration
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Version Selector */}
      {configState.versions.length > 1 && (
        <div>
          <div style={{ fontSize: '10px', color: '#808090', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            Version
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => switchVersion(activeSectionId!, configState.activeVersionIndex - 1)}
              disabled={configState.activeVersionIndex <= 0}
              style={iconBtnStyle}
              title="Previous version"
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: '11px', color: '#c0c0d0' }}>
              Version {configState.activeVersionIndex + 1} / {configState.versions.length}
              <span style={{ color: '#808090', marginLeft: '4px' }}>
                ({activeVersion?.source})
              </span>
            </span>
            <button
              onClick={() => switchVersion(activeSectionId!, configState.activeVersionIndex + 1)}
              disabled={configState.activeVersionIndex >= configState.versions.length - 1}
              style={iconBtnStyle}
              title="Next version"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Configuration List */}
      <div>
        <div style={{
          fontSize: '10px', color: '#808090', textTransform: 'uppercase',
          letterSpacing: '0.05em', marginBottom: '4px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Configurations</span>
          <div style={{ display: 'flex', gap: '2px' }}>
            <button
              onClick={() => cycleConfiguration(activeSectionId!, -1)}
              style={iconBtnStyle}
              title="Previous configuration ([)"
            >
              <ChevronLeft size={12} />
            </button>
            <button
              onClick={() => cycleConfiguration(activeSectionId!, 1)}
              style={iconBtnStyle}
              title="Next configuration (])"
            >
              <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {activeVersion && activeVersion.configurations.length === 0 && (
          <div style={{ fontSize: '11px', color: '#606070', padding: '4px 0' }}>
            No configurations yet.
          </div>
        )}

        {activeVersion?.configurations.map((config, idx) => {
          const isActive = idx === activeVersion.activeConfigIndex;
          return (
            <div
              key={config.id}
              onClick={() => switchConfiguration(activeSectionId!, idx)}
              style={{
                padding: '6px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                border: isActive ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '2px',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: isActive ? '#93b5f8' : '#c0c0d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {config.name}
                </div>
                <div style={{ fontSize: '10px', color: '#808090' }}>
                  {config.boundaries.length} boundaries &middot;
                  <span style={{
                    marginLeft: '4px',
                    padding: '0 4px',
                    borderRadius: '2px',
                    backgroundColor: config.source === 'ai' ? 'rgba(168, 85, 247, 0.2)' :
                      config.source === 'user' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                    color: config.source === 'ai' ? '#a855f7' :
                      config.source === 'user' ? '#3b82f6' : '#808090',
                    fontSize: '9px',
                    textTransform: 'uppercase',
                  }}>
                    {config.source}
                  </span>
                </div>
              </div>
              {!isActive && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConfiguration(activeSectionId!, activeVersion.id, config.id);
                  }}
                  style={{ ...iconBtnStyle, color: '#606070' }}
                  title="Delete configuration"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowEditor(!showEditor)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            fontSize: '11px',
            background: showEditor ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
            color: showEditor ? '#93b5f8' : '#a0a0b0',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          <Settings2 size={12} />
          New Config
        </button>
        <button
          onClick={() => setShowAI(!showAI)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            fontSize: '11px',
            background: showAI ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.05)',
            color: showAI ? '#c084fc' : '#a0a0b0',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          <Sparkles size={12} />
          AI Suggest
        </button>
      </div>

      {/* Division Editor */}
      {showEditor && (
        <DivisionEditor
          sectionId={activeSectionId}
          presets={divisionPresets}
          onClose={() => setShowEditor(false)}
        />
      )}

      {/* AI Suggestions */}
      {showAI && (
        <AISuggestionsPanel
          sectionId={activeSectionId}
          onClose={() => setShowAI(false)}
        />
      )}

      {/* Preview Banner */}
      {configState.previewConfig && (
        <div style={{
          padding: '8px',
          borderRadius: '4px',
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '11px', color: '#f59e0b', flex: 1 }}>
            Preview: {configState.previewConfig.name}
          </span>
          <button
            onClick={() => {
              const store = useProjectStore.getState();
              store.commitPreview(activeSectionId!);
            }}
            style={{
              padding: '2px 8px', fontSize: '10px', background: '#22c55e',
              color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer',
            }}
          >
            Apply
          </button>
          <button
            onClick={() => {
              const store = useProjectStore.getState();
              store.setPreviewConfig(activeSectionId!, null);
            }}
            style={{
              padding: '2px 8px', fontSize: '10px', background: 'rgba(255,255,255,0.1)',
              color: '#a0a0b0', border: 'none', borderRadius: '3px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
