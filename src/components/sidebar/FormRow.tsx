import { Pencil } from 'lucide-react';
import type { Form } from '../../types/scheme';
import { SHAPE_MAP } from '../../constants/shapes';

interface FormRowProps {
  form: Form;
  isActive: boolean;
  onClick: () => void;
  onEdit?: () => void;
}

export function FormRow({ form, isActive, onClick, onEdit }: FormRowProps) {
  const colorHex = form.color?.hex ?? '#808080';
  const hasTexture = !!form.texture;
  const shapeId = form.shape?.builtinId;
  const hasSound = !!form.sound;
  const shapeDef = shapeId ? SHAPE_MAP.get(shapeId) : null;

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
        {/* Color swatch */}
        <div
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '4px',
            backgroundColor: colorHex,
            flexShrink: 0,
            border: (hasTexture || hasSound) ? '2px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
            position: 'relative',
          }}
        >
          {/* Texture indicator dot */}
          {hasTexture && (
            <div style={{
              position: 'absolute', top: '-2px', right: '-2px',
              width: '6px', height: '6px', borderRadius: '50%',
              backgroundColor: '#A855F7', border: '1px solid #0d0d18',
            }} />
          )}
        </div>

        {/* Shape icon (mini preview) */}
        {shapeDef && shapeId !== 'default' && (
          <div
            style={{
              width: '14px',
              height: '10px',
              backgroundColor: colorHex,
              opacity: 0.6,
              flexShrink: 0,
              clipPath: shapeDef.getClipPath(14, 10),
              borderRadius: shapeDef.borderRadius ?? undefined,
            }}
          />
        )}

        {/* Sound indicator */}
        {hasSound && (
          <span style={{ fontSize: '8px', color: '#60a5fa', flexShrink: 0 }}>
            ♪
          </span>
        )}

        {/* Label */}
        <span style={{ fontSize: '12px', color: '#c0c0d0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {form.label}
        </span>
      </button>

      {/* Edit button */}
      {onEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          title="Edit form"
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
