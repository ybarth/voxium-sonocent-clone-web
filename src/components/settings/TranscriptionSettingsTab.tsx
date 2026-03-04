import { useProjectStore } from '../../stores/projectStore';
import type { TranscriptionSettings, EditingTierConfig } from '../../types/transcription';

// Reuse setting row styles from SettingsModal pattern
const settingRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  backgroundColor: 'rgba(255,255,255,0.02)',
  borderRadius: '6px',
  border: '1px solid #1a1a2e',
};

const selectStyle: React.CSSProperties = {
  background: '#1a1a2e',
  border: '1px solid #2a2a3e',
  borderRadius: '6px',
  color: '#e0e0e0',
  padding: '4px 8px',
  fontSize: '12px',
  cursor: 'pointer',
};

const LANGUAGES = [
  { value: '', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'nl', label: 'Dutch' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ru', label: 'Russian' },
  { value: 'pl', label: 'Polish' },
  { value: 'sv', label: 'Swedish' },
  { value: 'da', label: 'Danish' },
  { value: 'fi', label: 'Finnish' },
  { value: 'he', label: 'Hebrew' },
];

export function TranscriptionSettingsTab() {
  const settings = useProjectStore(s => s.project.transcription.settings);
  const editingConfig = useProjectStore(s => s.project.transcription.editingConfig);
  const updateSettings = useProjectStore(s => s.updateTranscriptionSettings);
  const updateEditing = useProjectStore(s => s.updateEditingConfig);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* ── STT Provider ── */}
      <SectionHeader>Speech-to-Text Provider</SectionHeader>

      <div style={settingRowStyle}>
        <div>
          <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500 }}>Default Provider</div>
          <div style={{ fontSize: '11px', color: '#505060', marginTop: '2px' }}>
            Primary STT engine for transcription
          </div>
        </div>
        <select
          value={settings.defaultProvider}
          onChange={e => updateSettings({ defaultProvider: e.target.value as TranscriptionSettings['defaultProvider'] })}
          style={selectStyle}
        >
          <option value="openai-whisper">OpenAI Whisper</option>
          <option value="google-stt">Google Speech-to-Text</option>
        </select>
      </div>

      <div style={settingRowStyle}>
        <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500 }}>Language</div>
        <select
          value={settings.language}
          onChange={e => updateSettings({ language: e.target.value })}
          style={selectStyle}
        >
          {LANGUAGES.map(l => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>

      {/* ── Multi-Speaker ── */}
      <SectionHeader>Speaker Detection</SectionHeader>

      <ToggleRow
        title="Multi-Speaker Detection"
        description="Identify and label different speakers (requires Google STT)"
        value={settings.enableMultiSpeaker}
        onChange={() => updateSettings({ enableMultiSpeaker: !settings.enableMultiSpeaker })}
      />

      {settings.enableMultiSpeaker && (
        <div style={settingRowStyle}>
          <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500 }}>Max Speakers</div>
          <select
            value={settings.maxSpeakers}
            onChange={e => updateSettings({ maxSpeakers: parseInt(e.target.value) })}
            style={selectStyle}
          >
            {[2, 3, 4, 5, 6].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Behavior ── */}
      <SectionHeader>Behavior</SectionHeader>

      <ToggleRow
        title="Clarification Queries"
        description="Generate questions for ambiguous transcription results"
        value={settings.clarificationQueriesEnabled}
        onChange={() => updateSettings({ clarificationQueriesEnabled: !settings.clarificationQueriesEnabled })}
      />

      <ToggleRow
        title="Auto-Transcribe on Record"
        description="Automatically transcribe chunks after recording"
        value={settings.autoTranscribeOnRecord}
        onChange={() => updateSettings({ autoTranscribeOnRecord: !settings.autoTranscribeOnRecord })}
      />

      {/* ── Confidence ── */}
      <SectionHeader>Confidence Thresholds</SectionHeader>

      <SliderRow
        title="Low Confidence Threshold"
        value={settings.confidenceThreshold}
        min={0.1}
        max={0.9}
        step={0.05}
        display={`${(settings.confidenceThreshold * 100).toFixed(0)}%`}
        description="Words below this are flagged red"
        onChange={v => updateSettings({ confidenceThreshold: v })}
      />

      <SliderRow
        title="Borderline Threshold"
        value={settings.borderlineThreshold}
        min={0.3}
        max={0.95}
        step={0.05}
        display={`${(settings.borderlineThreshold * 100).toFixed(0)}%`}
        description="Words below this get contextual analysis"
        onChange={v => updateSettings({ borderlineThreshold: v })}
      />

      {/* ── Tier 1: Cleanup ── */}
      <SectionHeader>Tier 1 — Cleanup</SectionHeader>

      <ToggleRow
        title="Clean False Starts"
        description="Remove repeated words and false starts"
        value={editingConfig.tier1.cleanFalseStarts}
        onChange={() => updateEditing({ tier1: { ...editingConfig.tier1, cleanFalseStarts: !editingConfig.tier1.cleanFalseStarts } })}
      />

      <ToggleRow
        title="Clean Filler Words"
        description='Remove "um", "uh", "like", "you know", etc.'
        value={editingConfig.tier1.cleanFillerWords}
        onChange={() => updateEditing({ tier1: { ...editingConfig.tier1, cleanFillerWords: !editingConfig.tier1.cleanFillerWords } })}
      />

      <ToggleRow
        title="Basic Formatting"
        description="Capitalize sentences, basic punctuation"
        value={editingConfig.tier1.basicFormatting}
        onChange={() => updateEditing({ tier1: { ...editingConfig.tier1, basicFormatting: !editingConfig.tier1.basicFormatting } })}
      />

      {/* ── Tier 2: Substantive ── */}
      <SectionHeader>Tier 2 — Substantive Editing</SectionHeader>

      <ToggleRow
        title="Enable Tier 2"
        description="Use LLM for substantive text editing (Wispr Flow style)"
        value={editingConfig.tier2.enabled}
        onChange={() => updateEditing({ tier2: { ...editingConfig.tier2, enabled: !editingConfig.tier2.enabled } })}
      />

      {editingConfig.tier2.enabled && (
        <>
          <div style={settingRowStyle}>
            <div>
              <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500 }}>Provider</div>
            </div>
            <select
              value={editingConfig.tier2.provider}
              onChange={e => updateEditing({ tier2: { ...editingConfig.tier2, provider: e.target.value } })}
              style={selectStyle}
            >
              <option value="claude">Claude</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>

          <div style={{ ...settingRowStyle, flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
            <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500 }}>Prompt Template</div>
            <textarea
              value={editingConfig.tier2.promptTemplate}
              onChange={e => updateEditing({ tier2: { ...editingConfig.tier2, promptTemplate: e.target.value } })}
              rows={3}
              style={{
                background: '#1a1a2e',
                border: '1px solid #2a2a3e',
                borderRadius: '6px',
                color: '#e0e0e0',
                padding: '8px',
                fontSize: '12px',
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '12px', fontWeight: 700, color: '#808090',
      textTransform: 'uppercase', letterSpacing: '0.5px',
      paddingTop: '8px', borderTop: '1px solid #1a1a2e',
    }}>
      {children}
    </div>
  );
}

function ToggleRow({ title, description, value, onChange }: {
  title: string; description?: string; value: boolean; onChange: () => void;
}) {
  return (
    <div style={settingRowStyle}>
      <div>
        <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500 }}>{title}</div>
        {description && <div style={{ fontSize: '11px', color: '#505060', marginTop: '2px' }}>{description}</div>}
      </div>
      <button
        onClick={onChange}
        style={{
          width: '40px', height: '22px', borderRadius: '11px', border: 'none',
          backgroundColor: value ? '#3B82F6' : '#2a2a3e', cursor: 'pointer',
          position: 'relative', transition: 'background-color 0.2s', flexShrink: 0,
        }}
      >
        <div style={{
          width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#e0e0e0',
          position: 'absolute', top: '3px', left: value ? '21px' : '3px', transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}

function SliderRow({ title, value, min, max, step, display, description, onChange }: {
  title: string; value: number; min: number; max: number; step: number;
  display: string; description?: string; onChange: (v: number) => void;
}) {
  return (
    <div style={settingRowStyle}>
      <div>
        <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500 }}>{title}</div>
        {description && <div style={{ fontSize: '11px', color: '#505060', marginTop: '2px' }}>{description}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ width: '80px', accentColor: '#3B82F6' }}
        />
        <span style={{ fontSize: '12px', color: '#a0a0b0', minWidth: '36px', textAlign: 'right' }}>
          {display}
        </span>
      </div>
    </div>
  );
}
