// Iteration Panel — Chat-like refinement UI for dialogic AI iteration
// Shows previous attempts with accept/refine/discard controls

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, RotateCcw, Check, X, Loader, Settings } from 'lucide-react';
import type { AICompletionResponse, TaskCategory } from '../../utils/aiProvider';
import type { ConversationSession, IterationMode } from '../../utils/aiConversation';
import { conversationManager } from '../../utils/aiConversation';

interface IterationPanelProps {
  taskCategory: TaskCategory;
  systemMessage: string;
  initialPrompt: string;
  /** Called when user accepts a response */
  onAccept: (content: string) => void;
  /** Parse/preview function for response content */
  renderPreview?: (content: string) => React.ReactNode;
}

interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
  response?: AICompletionResponse;
  timestamp: number;
}

const MODE_LABELS: Record<IterationMode, string> = {
  single: 'Single Shot',
  dialogic: 'Dialogic',
  'auto-iterate': 'Auto-Iterate',
};

export function IterationPanel({
  taskCategory,
  systemMessage,
  initialPrompt,
  onAccept,
  renderPreview,
}: IterationPanelProps) {
  const [session, setSession] = useState<ConversationSession | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [refinement, setRefinement] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<IterationMode>(conversationManager.getConfig().mode);
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const { session: newSession, response } = await conversationManager.startConversation(
        taskCategory,
        systemMessage,
        initialPrompt,
      );
      setSession(newSession);
      setHistory([
        { role: 'user', content: initialPrompt, timestamp: Date.now() },
        { role: 'assistant', content: response.content, response, timestamp: Date.now() },
      ]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!session || !refinement.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await conversationManager.iterate(session.id, refinement.trim());
      setHistory(prev => [
        ...prev,
        { role: 'user', content: refinement.trim(), timestamp: Date.now() },
        { role: 'assistant', content: response.content, response, timestamp: Date.now() },
      ]);
      setRefinement('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const response = await conversationManager.regenerate(session.id);
      // Replace the last assistant entry
      setHistory(prev => {
        const newHistory = [...prev];
        const lastAssistantIdx = newHistory.findLastIndex(h => h.role === 'assistant');
        if (lastAssistantIdx >= 0) {
          newHistory[lastAssistantIdx] = {
            role: 'assistant', content: response.content,
            response, timestamp: Date.now(),
          };
        }
        return newHistory;
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptLatest = () => {
    const lastAssistant = [...history].reverse().find(h => h.role === 'assistant');
    if (lastAssistant) {
      onAccept(lastAssistant.content);
      if (session) conversationManager.deleteSession(session.id);
    }
  };

  const handleDiscard = () => {
    if (session) conversationManager.deleteSession(session.id);
    setSession(null);
    setHistory([]);
    setError('');
  };

  const lastAssistantContent = [...history].reverse().find(h => h.role === 'assistant')?.content;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MessageSquare size={14} color="#8B5CF6" />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#e0e0e0' }}>
            AI Iteration
          </span>
          <span style={{
            fontSize: '9px', fontWeight: 600, color: '#8B5CF6',
            background: '#8B5CF615', padding: '1px 6px', borderRadius: '3px',
          }}>
            {MODE_LABELS[mode]}
          </span>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{ background: 'none', border: 'none', color: '#606070', cursor: 'pointer', padding: '2px' }}
        >
          <Settings size={12} />
        </button>
      </div>

      {/* Settings */}
      {showSettings && (
        <div style={{
          padding: '8px', background: '#12121e', borderRadius: '4px',
          border: '1px solid #1a1a2e', display: 'flex', gap: '8px', flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '9px', color: '#606070', textTransform: 'uppercase' }}>Mode</label>
            <select
              value={mode}
              onChange={(e) => {
                const m = e.target.value as IterationMode;
                setMode(m);
                conversationManager.updateConfig({ mode: m });
              }}
              style={{
                background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '4px',
                color: '#c0c0d0', fontSize: '10px', padding: '3px 6px', outline: 'none',
              }}
            >
              {Object.entries(MODE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: '10px', color: '#606070', alignSelf: 'flex-end' }}>
            {mode === 'single' && 'Generate once, accept or regenerate'}
            {mode === 'dialogic' && 'Chat-like refinement with AI'}
            {mode === 'auto-iterate' && 'AI auto-improves until threshold'}
          </div>
        </div>
      )}

      {/* Initial generate button */}
      {!session && (
        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            padding: '8px 16px', background: loading ? '#2a2a3e' : '#8B5CF6',
            border: 'none', borderRadius: '6px', color: '#fff',
            fontSize: '12px', fontWeight: 600, cursor: loading ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          {loading ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</> : 'Generate'}
        </button>
      )}

      {/* Chat history */}
      {history.length > 0 && (
        <div
          ref={scrollRef}
          style={{
            maxHeight: '300px', overflowY: 'auto', display: 'flex',
            flexDirection: 'column', gap: '6px', padding: '4px 0',
          }}
        >
          {history.map((entry, i) => (
            <div
              key={i}
              style={{
                padding: '6px 8px', borderRadius: '6px',
                background: entry.role === 'user' ? '#1a1a3e' : '#12121e',
                borderLeft: entry.role === 'user' ? '2px solid #8B5CF6' : '2px solid #2a2a3e',
              }}
            >
              <div style={{ fontSize: '9px', color: '#505060', marginBottom: '3px' }}>
                {entry.role === 'user' ? 'You' : entry.response ? `${entry.response.provider}/${entry.response.model} · ${entry.response.latencyMs}ms` : 'AI'}
              </div>
              {entry.role === 'assistant' && renderPreview ? (
                renderPreview(entry.content)
              ) : (
                <div style={{
                  fontSize: '11px', color: '#a0a0b0', whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all', fontFamily: entry.role === 'assistant' ? 'monospace' : 'inherit',
                  maxHeight: '100px', overflow: 'auto',
                }}>
                  {entry.content.length > 500 ? entry.content.slice(0, 500) + '...' : entry.content}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ fontSize: '11px', color: '#EF4444', padding: '6px 8px', background: '#1a0a0a', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {/* Actions */}
      {session && !loading && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={handleAcceptLatest}
            style={{
              padding: '4px 10px', background: '#22C55E', border: 'none',
              borderRadius: '4px', color: '#fff', fontSize: '11px', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <Check size={12} /> Accept
          </button>
          <button
            onClick={handleRegenerate}
            style={{
              padding: '4px 10px', background: '#2a2a3e', border: 'none',
              borderRadius: '4px', color: '#c0c0d0', fontSize: '11px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <RotateCcw size={12} /> Regenerate
          </button>
          <button
            onClick={handleDiscard}
            style={{
              padding: '4px 10px', background: 'none', border: '1px solid #3a1a1a',
              borderRadius: '4px', color: '#EF4444', fontSize: '11px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <X size={12} /> Discard
          </button>
        </div>
      )}

      {/* Refinement input (dialogic mode) */}
      {session && mode !== 'single' && !loading && (
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            value={refinement}
            onChange={(e) => setRefinement(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
            placeholder="Refine: 'make it warmer', 'try a different approach'..."
            style={{
              flex: 1, background: '#1a1a2e', border: '1px solid #2a2a3e',
              borderRadius: '4px', color: '#e0e0e0', padding: '6px 8px',
              fontSize: '11px', outline: 'none',
            }}
          />
          <button
            onClick={handleRefine}
            disabled={!refinement.trim()}
            style={{
              padding: '6px 12px', background: refinement.trim() ? '#8B5CF6' : '#2a2a3e',
              border: 'none', borderRadius: '4px', color: '#fff',
              fontSize: '11px', cursor: refinement.trim() ? 'pointer' : 'default',
            }}
          >
            Send
          </button>
        </div>
      )}

      {loading && session && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }}>
          <Loader size={12} color="#8B5CF6" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '11px', color: '#606070' }}>Thinking...</span>
        </div>
      )}
    </div>
  );
}
