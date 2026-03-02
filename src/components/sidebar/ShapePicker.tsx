import type { BuiltinShapeId } from '../../types/scheme';
import { BUILTIN_SHAPES } from '../../constants/shapes';

interface ShapePickerProps {
  selectedId?: BuiltinShapeId;
  onSelect: (id: BuiltinShapeId) => void;
  previewColor?: string;
}

export function ShapePicker({ selectedId, onSelect, previewColor = '#3B82F6' }: ShapePickerProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
      {BUILTIN_SHAPES.map((shape) => {
        const isSelected = selectedId === shape.id;
        const clipPath = shape.getClipPath(48, 24);
        return (
          <button
            key={shape.id}
            onClick={() => onSelect(shape.id)}
            title={shape.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '6px',
              backgroundColor: isSelected ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)',
              border: isSelected ? '1px solid rgba(59,130,246,0.4)' : '1px solid #1a1a2e',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '24px',
                backgroundColor: previewColor,
                clipPath: clipPath !== 'none' ? clipPath : undefined,
                borderRadius: shape.borderRadius ?? '3px',
              }}
            />
            <span style={{ fontSize: '9px', color: isSelected ? '#93c5fd' : '#606070' }}>
              {shape.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
