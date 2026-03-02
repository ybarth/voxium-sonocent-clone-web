import { Pencil } from 'lucide-react';
import type { SectionForm } from '../../types/scheme';
import type { TextureRef } from '../../types';
import { getTextureCss } from '../../utils/textures';

interface SectionFormRowProps {
  form: SectionForm;
  isActive: boolean;
  onClick: () => void;
  onEdit?: () => void;
}

export function SectionFormRow({ form, isActive, onClick, onEdit }: SectionFormRowProps) {
  const colorHex = form.color?.hex ?? '#808080';
  const hasTexture = !!form.texture;
  const textureRef: TextureRef | null = form.texture?.textureRef ?? null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        borderRadius: '4px',
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.05)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
      }}
    >
      <button
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flex: 1,
          backgroundColor: 'transparent',
          border: 'none',
          cursor: isActive ? 'pointer' : 'default',
          opacity: isActive ? 1 : 0.6,
          textAlign: 'left',
          padding: 0,
        }}
      >
        {/* Color swatch with texture preview */}
        <div
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '4px',
            backgroundColor: colorHex,
            flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.1)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {hasTexture && textureRef && (
            <div style={{
              position: 'absolute', inset: 0,
              ...getTextureCss(textureRef, colorHex),
            }} />
          )}
        </div>

        {/* Label */}
        <span style={{ fontSize: '12px', color: '#c0c0d0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {form.label}
        </span>
      </button>

      {/* Edit button */}
      {onEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          title="Edit section form"
          style={{
            display: 'inline-flex', alignItems: 'center',
            background: 'none', border: 'none', color: '#505060',
            cursor: 'pointer', padding: '2px', borderRadius: '3px', flexShrink: 0,
          }}
        >
          <Pencil size={10} />
        </button>
      )}

      {/* Shortcut badge */}
      {form.shortcutKey > 0 && (
        <span
          style={{
            fontSize: '10px', color: '#505060', fontFamily: 'monospace',
            backgroundColor: 'rgba(255,255,255,0.05)', padding: '1px 5px',
            borderRadius: '3px', flexShrink: 0,
          }}
        >
          {form.shortcutKey}
        </span>
      )}
    </div>
  );
}
