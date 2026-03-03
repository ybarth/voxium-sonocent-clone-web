import { useState } from 'react';
import { ForgeChunkSchemeSubTab } from './ForgeChunkSchemeSubTab';
import { ForgeSectionSchemeSubTab } from './ForgeSectionSchemeSubTab';
import { ForgeProjectSchemeSubTab } from './ForgeProjectSchemeSubTab';

type SchemeSubTab = 'chunk' | 'section' | 'project';

// Propagation choice: session-scoped preference for edit behavior on linked schemes
export type PropagationChoice = 'propagate' | 'fork' | null; // null = not yet asked

interface ForgeSchemesTabProps {
  onGenerated?: () => void;
}

export function ForgeSchemesTab({ onGenerated }: ForgeSchemesTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SchemeSubTab>('chunk');
  const [propagationChoice, setPropagationChoice] = useState<PropagationChoice>(null);

  const subTabs: { id: SchemeSubTab; label: string }[] = [
    { id: 'chunk', label: 'Chunk' },
    { id: 'section', label: 'Section' },
    { id: 'project', label: 'Project' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Pill-style sub-navigation */}
      <div style={{
        display: 'flex', gap: '2px', padding: '3px',
        backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px',
      }}>
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            style={{
              flex: 1, padding: '5px 10px', borderRadius: '6px',
              border: 'none', fontSize: '11px', fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: activeSubTab === tab.id ? 'rgba(139,92,246,0.2)' : 'transparent',
              color: activeSubTab === tab.id ? '#A78BFA' : '#606070',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {activeSubTab === 'chunk' && (
        <ForgeChunkSchemeSubTab onGenerated={onGenerated} />
      )}
      {activeSubTab === 'section' && (
        <ForgeSectionSchemeSubTab onGenerated={onGenerated} />
      )}
      {activeSubTab === 'project' && (
        <ForgeProjectSchemeSubTab />
      )}
    </div>
  );
}
