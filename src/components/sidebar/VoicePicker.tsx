import { useState, useEffect } from 'react';
import type { VoiceAttribute } from '../../types/scheme';
import { TtsEngine } from '../../utils/ttsEngine';

interface VoicePickerProps {
  value?: VoiceAttribute;
  onChange: (voice: VoiceAttribute | undefined) => void;
}

export function VoicePicker({ value, onChange }: VoicePickerProps) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const tts = new TtsEngine();
    const loadVoices = () => setVoices(tts.getAvailableVoices());
    loadVoices();
    const timer = setTimeout(loadVoices, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleVoiceChange = (voiceUri: string) => {
    if (!voiceUri && !value?.pitch) {
      onChange(undefined);
    } else {
      onChange({ ...value, voiceUri: voiceUri || undefined });
    }
  };

  const handlePitchChange = (pitch: number) => {
    onChange({ ...value, pitch });
  };

  const handlePreview = () => {
    const utterance = new SpeechSynthesisUtterance('Sample announcement, 1, 2, 3');
    utterance.pitch = value?.pitch ?? 1.0;
    utterance.rate = 1.0;
    if (value?.voiceUri) {
      const v = voices.find((voice) => voice.voiceURI === value.voiceUri);
      if (v) utterance.voice = v;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const pitch = value?.pitch ?? 1.0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Voice selector */}
      <div>
        <div style={{ fontSize: '10px', color: '#606070', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
          Voice
        </div>
        <select
          value={value?.voiceUri ?? ''}
          onChange={(e) => handleVoiceChange(e.target.value)}
          style={{
            width: '100%', background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '6px',
            color: '#e0e0e0', padding: '4px 8px', fontSize: '11px', cursor: 'pointer',
          }}
        >
          <option value="">Use Global Default</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </div>

      {/* Pitch slider */}
      <div>
        <div style={{ fontSize: '10px', color: '#606070', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
          Pitch
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="range"
            min={0} max={2} step={0.1}
            value={pitch}
            onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: '#3B82F6' }}
          />
          <span style={{ fontSize: '11px', color: '#606070', minWidth: '30px', textAlign: 'right' }}>
            {pitch.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Preview button */}
      <button
        onClick={handlePreview}
        style={{
          padding: '4px 10px', background: 'none',
          border: '1px solid #2a2a3e', borderRadius: '6px',
          color: '#a0a0b0', fontSize: '11px', cursor: 'pointer',
        }}
      >
        Preview Voice
      </button>
    </div>
  );
}
