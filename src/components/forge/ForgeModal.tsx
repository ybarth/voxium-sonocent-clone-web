import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ForgeColorTab } from './ForgeColorTab';
import { ForgeTextureTab } from './ForgeTextureTab';
import { ForgeSoundTab } from './ForgeSoundTab';
import { ForgeSchemesTab } from './ForgeSchemesTab';

interface ForgeModalProps {
  onClose: () => void;
}

type ForgeTab = 'schemes' | 'colors' | 'textures' | 'sounds';

export function ForgeModal({ onClose }: ForgeModalProps) {
  const [activeTab, setActiveTab] = useState<ForgeTab>('schemes');
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      }}
    >
      <div style={{
        width: '620px', maxWidth: '90vw', maxHeight: '85vh',
        backgroundColor: '#0d0d18', border: '1px solid #1a1a2e',
        borderRadius: '12px', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid #1a1a2e',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>&#9776;</span>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#e0e0e0' }}>
              The Forge
            </h2>
            <span style={{ fontSize: '11px', color: '#8B5CF6', fontWeight: 500 }}>
              AI Generation
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#808090',
            cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1a1a2e', padding: '0 20px' }}>
          {([
            { id: 'schemes', label: 'Schemes' },
            { id: 'colors', label: 'Colors' },
            { id: 'textures', label: 'Textures' },
            { id: 'sounds', label: 'Sounds' },
          ] as { id: ForgeTab; label: string }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none', border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #8B5CF6' : '2px solid transparent',
                color: activeTab === tab.id ? '#e0e0e0' : '#606070',
                fontSize: '12px', fontWeight: 600, padding: '10px 14px',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {activeTab === 'schemes' && <ForgeSchemesTab onGenerated={onClose} />}
          {activeTab === 'colors' && <ForgeColorTab onGenerated={onClose} />}
          {activeTab === 'textures' && <ForgeTextureTab />}
          {activeTab === 'sounds' && <ForgeSoundTab />}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 20px', borderTop: '1px solid #1a1a2e',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '10px', color: '#505060' }}>
            Requires OpenAI or ElevenLabs API keys configured in Settings
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px', background: 'none', border: '1px solid #2a2a3e',
              borderRadius: '6px', color: '#808090', fontSize: '12px', cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
