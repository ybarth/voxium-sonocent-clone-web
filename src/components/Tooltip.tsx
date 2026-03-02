import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useKeybindingStore } from '../stores/keybindingStore';

interface TooltipProps {
  /** Text label for the tooltip */
  label: string;
  /** Optional command ID — if provided, the active keybinding is appended */
  commandId?: string;
  /** Override shortcut text (for non-command shortcuts) */
  shortcut?: string;
  /** Tooltip placement relative to the target */
  placement?: 'top' | 'bottom';
  /** Delay in ms before showing (default 400) */
  delay?: number;
  children: React.ReactNode;
}

const ARROW_SIZE = 5;

/**
 * Format a keybinding descriptor for display.
 * Automatically adapts Ctrl→Cmd and Alt→Opt on Mac.
 */
function formatBinding(binding: string): string {
  if (!binding) return '';
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
  return binding
    .split('+')
    .map(part => {
      switch (part) {
        case 'Ctrl': return isMac ? '\u2318' : 'Ctrl';
        case 'Alt': return isMac ? '\u2325' : 'Alt';
        case 'Shift': return '\u21E7';
        case 'ArrowLeft': return '\u2190';
        case 'ArrowRight': return '\u2192';
        case 'ArrowUp': return '\u2191';
        case 'ArrowDown': return '\u2193';
        case 'Space': return 'Space';
        case 'Escape': return 'Esc';
        case 'Delete': return 'Del';
        case 'Backspace': return 'Bksp';
        case 'Tab': return 'Tab';
        case 'Enter': return '\u23CE';
        default: return part.length === 1 ? part.toUpperCase() : part;
      }
    })
    .join(isMac ? '' : '+');
}

export function Tooltip({
  label,
  commandId,
  shortcut,
  placement = 'bottom',
  delay = 400,
  children,
}: TooltipProps) {
  const showTooltips = useKeybindingStore(s => s.showTooltips);
  const getResolvedBindings = useKeybindingStore(s => s.getResolvedBindings);

  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve the shortcut text from the active preset
  const resolvedShortcut = shortcut ?? (commandId ? formatBinding(getResolvedBindings()[commandId] ?? '') : '');

  const show = useCallback(() => {
    if (!showTooltips) return;
    timerRef.current = setTimeout(() => {
      if (!targetRef.current) return;
      const rect = targetRef.current.getBoundingClientRect();
      const tooltipEstimatedWidth = 200; // max guess for positioning
      let left = rect.left + rect.width / 2;
      // Clamp to viewport
      left = Math.max(tooltipEstimatedWidth / 2 + 8, Math.min(window.innerWidth - tooltipEstimatedWidth / 2 - 8, left));

      if (placement === 'top') {
        setPosition({ top: rect.top - 8, left });
      } else {
        setPosition({ top: rect.bottom + 8, left });
      }
      setVisible(true);
    }, delay);
  }, [showTooltips, delay, placement]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      ref={targetRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onMouseDown={hide}
      style={{ display: 'inline-flex' }}
    >
      {children}
      {visible && position && createPortal(
        <TooltipBubble
          label={label}
          shortcut={resolvedShortcut}
          placement={placement}
          top={position.top}
          left={position.left}
        />,
        document.body,
      )}
    </div>
  );
}

function TooltipBubble({
  label,
  shortcut,
  placement,
  top,
  left,
}: {
  label: string;
  shortcut: string;
  placement: 'top' | 'bottom';
  top: number;
  left: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [adjustedLeft, setAdjustedLeft] = useState(left);

  // Adjust position after measuring actual width
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const halfW = rect.width / 2;
    let newLeft = left;
    if (left - halfW < 8) newLeft = halfW + 8;
    if (left + halfW > window.innerWidth - 8) newLeft = window.innerWidth - halfW - 8;
    setAdjustedLeft(newLeft);
  }, [left]);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top,
        left: adjustedLeft,
        transform: placement === 'top'
          ? 'translate(-50%, -100%)'
          : 'translate(-50%, 0)',
        backgroundColor: '#1e1e2e',
        border: '1px solid #2a2a3e',
        borderRadius: '6px',
        padding: '5px 10px',
        zIndex: 10001,
        pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        whiteSpace: 'nowrap',
        animation: 'tooltipFadeIn 0.12s ease-out',
      }}
    >
      <span style={{ fontSize: '12px', color: '#e0e0e0', fontWeight: 500 }}>
        {label}
      </span>
      {shortcut && (
        <kbd
          style={{
            fontSize: '11px',
            color: '#a0a0b0',
            backgroundColor: '#0d0d18',
            border: '1px solid #2a2a3e',
            borderRadius: '3px',
            padding: '1px 5px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            lineHeight: 1.4,
          }}
        >
          {shortcut}
        </kbd>
      )}
      {/* Arrow */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          marginLeft: -ARROW_SIZE,
          ...(placement === 'top' ? {
            bottom: -ARROW_SIZE,
            borderLeft: `${ARROW_SIZE}px solid transparent`,
            borderRight: `${ARROW_SIZE}px solid transparent`,
            borderTop: `${ARROW_SIZE}px solid #2a2a3e`,
          } : {
            top: -ARROW_SIZE,
            borderLeft: `${ARROW_SIZE}px solid transparent`,
            borderRight: `${ARROW_SIZE}px solid transparent`,
            borderBottom: `${ARROW_SIZE}px solid #2a2a3e`,
          }),
          width: 0,
          height: 0,
        }}
      />
      <style>{`@keyframes tooltipFadeIn { from { opacity: 0; transform: translate(-50%, ${placement === 'top' ? 'calc(-100% + 4px)' : '-4px'}); } to { opacity: 1; transform: translate(-50%, ${placement === 'top' ? '-100%' : '0'}); } }`}</style>
    </div>
  );
}
