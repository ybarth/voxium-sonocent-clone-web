import { useEffect, useCallback } from 'react';
import { useLayoutStore } from '../../stores/layoutStore';
import { ClipboardPanel } from './ClipboardPanel';

export function ClipboardPopup() {
  const open = useLayoutStore((s) => s.clipboardPopupOpen);
  const setOpen = useLayoutStore((s) => s.setClipboardPopupOpen);

  const handleClose = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxHeight: 500,
          backgroundColor: '#1a1a2e',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <span style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#e0e0e8',
            letterSpacing: '0.02em',
          }}>
            Clipboard
          </span>
          <span style={{
            fontSize: '10px',
            color: '#606070',
          }}>
            B to close
          </span>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px',
        }}>
          <ClipboardPanel forceExpanded />
        </div>
      </div>
    </div>
  );
}
