import { useState, useEffect, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { useKeybindingStore } from '../../stores/keybindingStore';
import {
  eventToDescriptor,
  normalizeDescriptor,
  RESERVED_KEYS,
  PRESETS,
} from '../../commands/keybindingPresets';

interface KeybindingRowProps {
  commandId: string;
  label: string;
  description: string;
  currentBinding: string;
  hasConflict: boolean;
}

export function KeybindingRow({
  commandId,
  label,
  description,
  currentBinding,
  hasConflict,
}: KeybindingRowProps) {
  const [listening, setListening] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  const setBinding = useKeybindingStore(s => s.setBinding);
  const clearBinding = useKeybindingStore(s => s.clearBinding);
  const activePresetId = useKeybindingStore(s => s.activePresetId);

  const presetDefault =
    activePresetId !== 'custom'
      ? PRESETS[activePresetId]?.[commandId] ?? ''
      : PRESETS['ableton']?.[commandId] ?? '';

  const isCustomized = currentBinding !== presetDefault;

  const handleStartListening = useCallback(() => {
    setListening(true);
    setRejected(null);
  }, []);

  useEffect(() => {
    if (!listening) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setListening(false);
        return;
      }

      const descriptor = eventToDescriptor(e);
      if (!descriptor) return; // Pure modifier

      const normalized = normalizeDescriptor(descriptor);
      if (RESERVED_KEYS.has(normalized)) {
        setRejected(descriptor);
        setTimeout(() => setRejected(null), 2000);
        return;
      }

      setBinding(commandId, descriptor);
      setListening(false);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [listening, commandId, setBinding]);

  const handleReset = useCallback(() => {
    clearBinding(commandId);
  }, [commandId, clearBinding]);

  // Format a binding descriptor for display
  const formatBinding = (binding: string) => {
    if (!binding) return 'Unbound';
    return binding
      .split('+')
      .map(part => {
        const isMac = navigator.platform.includes('Mac');
        switch (part) {
          case 'Ctrl': return isMac ? 'Cmd' : 'Ctrl';
          case 'Alt': return isMac ? 'Opt' : 'Alt';
          case 'Shift': return 'Shift';
          case 'ArrowLeft': return '\u2190';
          case 'ArrowRight': return '\u2192';
          case 'ArrowUp': return '\u2191';
          case 'ArrowDown': return '\u2193';
          case 'Space': return 'Space';
          case 'Escape': return 'Esc';
          case 'Delete': return 'Del';
          case 'Backspace': return 'Bksp';
          case 'Tab': return 'Tab';
          case 'Enter': return 'Enter';
          default: return part.length === 1 ? part.toUpperCase() : part;
        }
      })
      .join(' + ');
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '5px 8px',
        borderRadius: '4px',
        gap: '8px',
        backgroundColor: listening ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
        border: listening
          ? '1px solid rgba(59, 130, 246, 0.3)'
          : hasConflict
            ? '1px solid rgba(234, 179, 8, 0.3)'
            : '1px solid transparent',
        transition: 'all 0.15s',
      }}
    >
      {/* Command label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500 }}>
          {label}
        </div>
        <div style={{ fontSize: '11px', color: '#505060', marginTop: '1px' }}>
          {description}
        </div>
      </div>

      {/* Conflict badge */}
      {hasConflict && !listening && (
        <span
          style={{
            fontSize: '10px',
            color: '#EAB308',
            backgroundColor: 'rgba(234, 179, 8, 0.15)',
            padding: '2px 6px',
            borderRadius: '3px',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          Conflict
        </span>
      )}

      {/* Binding chip or listening state */}
      {listening ? (
        <div
          style={{
            fontSize: '12px',
            color: '#3B82F6',
            padding: '4px 10px',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderRadius: '4px',
            animation: 'pulse 1.5s ease-in-out infinite',
            flexShrink: 0,
          }}
        >
          {rejected ? (
            <span style={{ color: '#f87171' }}>Reserved key</span>
          ) : (
            'Press a key...'
          )}
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }`}</style>
        </div>
      ) : (
        <button
          onClick={handleStartListening}
          title="Click to rebind"
          style={{
            background: isCustomized ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255,255,255,0.05)',
            border: isCustomized ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid #2a2a3e',
            borderRadius: '4px',
            color: isCustomized ? '#60a5fa' : '#a0a0b0',
            padding: '3px 10px',
            fontSize: '12px',
            fontFamily: 'monospace',
            cursor: 'pointer',
            flexShrink: 0,
            minWidth: '80px',
            textAlign: 'center',
          }}
        >
          {formatBinding(currentBinding)}
        </button>
      )}

      {/* Reset button */}
      {isCustomized && !listening && (
        <button
          onClick={handleReset}
          title="Reset to preset default"
          style={{
            background: 'none',
            border: 'none',
            color: '#505060',
            cursor: 'pointer',
            padding: '3px',
            borderRadius: '3px',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <RotateCcw size={12} />
        </button>
      )}
    </div>
  );
}
