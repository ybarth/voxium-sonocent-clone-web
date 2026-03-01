import { useProjectStore } from '../../stores/projectStore';
import { DEFAULT_CHUNK_COLOR } from '../../types';

export function ColorKeySidebar() {
  const colorKey = useProjectStore((s) => s.project.colorKey);
  const selectedChunkIds = useProjectStore((s) => s.selection.selectedChunkIds);
  const colorChunks = useProjectStore((s) => s.colorChunks);

  const selectedIds = Array.from(selectedChunkIds);

  const handleColorClick = (hex: string | null) => {
    if (selectedIds.length > 0) {
      colorChunks(selectedIds, hex);
    }
  };

  return (
    <div
      style={{
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#808090',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Color Key — {colorKey.name}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {/* Default / reset color */}
        <ColorKeyRow
          hex={DEFAULT_CHUNK_COLOR}
          label="Default"
          shortcut="0"
          isActive={selectedIds.length > 0}
          onClick={() => handleColorClick(null)}
        />

        {colorKey.colors.map((entry) => (
          <ColorKeyRow
            key={entry.hex}
            hex={entry.hex}
            label={entry.label}
            shortcut={entry.shortcutKey.toString()}
            isActive={selectedIds.length > 0}
            onClick={() => handleColorClick(entry.hex)}
          />
        ))}
      </div>

      {selectedIds.length === 0 && (
        <div
          style={{
            fontSize: '11px',
            color: '#505060',
            fontStyle: 'italic',
            padding: '8px 0',
          }}
        >
          Select chunks to apply colors. Use number keys 1-9 for quick
          assignment.
        </div>
      )}

      {/* Section overview */}
      <SectionOverview />
    </div>
  );
}

function ColorKeyRow({
  hex,
  label,
  shortcut,
  isActive,
  onClick,
}: {
  hex: string;
  label: string;
  shortcut: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 8px',
        backgroundColor: 'transparent',
        border: 'none',
        borderRadius: '4px',
        cursor: isActive ? 'pointer' : 'default',
        opacity: isActive ? 1 : 0.6,
        width: '100%',
        textAlign: 'left',
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={(e) => {
        if (isActive)
          (e.currentTarget as HTMLElement).style.backgroundColor =
            'rgba(255,255,255,0.05)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
      }}
    >
      <div
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '4px',
          backgroundColor: hex,
          flexShrink: 0,
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      />
      <span style={{ fontSize: '12px', color: '#c0c0d0', flex: 1 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: '10px',
          color: '#505060',
          fontFamily: 'monospace',
          backgroundColor: 'rgba(255,255,255,0.05)',
          padding: '1px 5px',
          borderRadius: '3px',
        }}
      >
        {shortcut}
      </span>
    </button>
  );
}

function SectionOverview() {
  const sections = useProjectStore((s) => s.project.sections);
  const chunks = useProjectStore((s) => s.project.chunks);
  const navigateSection = useProjectStore((s) => s.navigateSection);
  const currentChunkId = useProjectStore((s) => s.playback.currentChunkId);
  const currentChunk = chunks.find((c) => c.id === currentChunkId);

  const ordered = [...sections].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div style={{ marginTop: '8px' }}>
      <div
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#808090',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '8px',
        }}
      >
        Sections
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {ordered.map((section) => {
          const count = chunks.filter(
            (c) => c.sectionId === section.id && !c.isDeleted
          ).length;
          const isCurrent = currentChunk?.sectionId === section.id;

          return (
            <button
              key={section.id}
              onClick={() => {
                // Navigate to this section
                const sectionChunks = chunks
                  .filter((c) => c.sectionId === section.id && !c.isDeleted)
                  .sort((a, b) => a.orderIndex - b.orderIndex);
                if (sectionChunks.length > 0) {
                  useProjectStore.getState().selectChunk(sectionChunks[0].id);
                  useProjectStore.getState().setCurrentChunk(sectionChunks[0].id);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 8px',
                backgroundColor: isCurrent
                  ? 'rgba(59, 130, 246, 0.15)'
                  : 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  color: isCurrent ? '#93c5fd' : '#a0a0b0',
                  flex: 1,
                }}
              >
                {section.name}
              </span>
              <span style={{ fontSize: '10px', color: '#505060' }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
