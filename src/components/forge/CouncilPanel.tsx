// Council Panel — Side-by-side model comparison with dissent report
// Adapted from LLM-Counsel's Panel visualization

import { useState } from 'react';
import { Users, CheckCircle, AlertTriangle, Loader } from 'lucide-react';
import type { AICompletionRequest } from '../../utils/aiProvider';
import type { PanelResponse } from '../../utils/aiPanel';
import { dispatchPanel, getAvailablePanelConfig, PANEL_PRESETS } from '../../utils/aiPanel';
import type { JudgeResult, AggregationStrategy } from '../../utils/aiJudge';
import { judgeResponses } from '../../utils/aiJudge';
import type { DissentReport } from '../../utils/aiDissent';
import { analyzeDisent } from '../../utils/aiDissent';

interface CouncilPanelProps {
  /** The request to dispatch to the panel */
  request: AICompletionRequest;
  /** Task description for context */
  taskDescription?: string;
  /** Callback when a response is selected */
  onSelect?: (content: string, provider: string, model: string) => void;
}

type PanelPreset = 'high_stakes' | 'balanced' | 'budget';

const DISSENT_COLORS: Record<string, string> = {
  none: '#22C55E',
  low: '#84CC16',
  moderate: '#EAB308',
  high: '#EF4444',
};

const STRATEGY_LABELS: Record<AggregationStrategy, string> = {
  BEST_OF_N: 'Best of N',
  MAJORITY_VOTE: 'Majority Vote',
  CONFIDENCE_WEIGHTED: 'Confidence Weighted',
  JUDGE_MODEL: 'Judge Model',
};

export function CouncilPanel({ request, taskDescription, onSelect }: CouncilPanelProps) {
  const [preset, setPreset] = useState<PanelPreset>('balanced');
  const [strategy, setStrategy] = useState<AggregationStrategy>('BEST_OF_N');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [panelResult, setPanelResult] = useState<PanelResponse | null>(null);
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);
  const [dissentReport, setDissentReport] = useState<DissentReport | null>(null);

  const handleDispatch = async () => {
    setLoading(true);
    setError('');
    setPanelResult(null);
    setJudgeResult(null);
    setDissentReport(null);

    try {
      const config = getAvailablePanelConfig(preset);
      const result = await dispatchPanel(request, config);
      setPanelResult(result);

      // Run judge
      const validResponses = result.responses.filter(r => r.content && !r.error);
      if (validResponses.length >= 2) {
        const judge = await judgeResponses(validResponses, { strategy });
        setJudgeResult(judge);

        // Run dissent analysis
        const dissent = analyzeDisent(validResponses);
        setDissentReport(dissent);
      } else if (validResponses.length === 1) {
        setJudgeResult({
          selectedResponse: validResponses[0],
          selectedIndex: 0,
          confidence: 0.5,
          reasoning: 'Only one valid response available',
        });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Users size={14} color="#8B5CF6" />
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#e0e0e0' }}>
          AI Council
        </span>
        <span style={{ fontSize: '11px', color: '#606070' }}>
          Multi-model comparison
        </span>
      </div>

      {taskDescription && (
        <div style={{ fontSize: '11px', color: '#808090', padding: '6px 8px', background: '#12121e', borderRadius: '4px' }}>
          {taskDescription}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <label style={{ fontSize: '10px', color: '#606070', textTransform: 'uppercase' }}>Panel</label>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as PanelPreset)}
            style={{
              background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '4px',
              color: '#c0c0d0', fontSize: '11px', padding: '4px 8px', outline: 'none',
            }}
          >
            {Object.keys(PANEL_PRESETS).map(p => (
              <option key={p} value={p}>{p.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <label style={{ fontSize: '10px', color: '#606070', textTransform: 'uppercase' }}>Judge Strategy</label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as AggregationStrategy)}
            style={{
              background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '4px',
              color: '#c0c0d0', fontSize: '11px', padding: '4px 8px', outline: 'none',
            }}
          >
            {Object.entries(STRATEGY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={handleDispatch}
            disabled={loading}
            style={{
              padding: '5px 14px', background: loading ? '#2a2a3e' : '#8B5CF6',
              border: 'none', borderRadius: '4px', color: '#fff',
              fontSize: '11px', fontWeight: 600, cursor: loading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {loading ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Consulting...</> : 'Consult Council'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: '11px', color: '#EF4444', padding: '6px 8px', background: '#1a0a0a', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {/* Responses */}
      {panelResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', color: '#606070' }}>
            {panelResult.responses.length} responses in {panelResult.totalLatencyMs}ms
          </div>

          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
            {panelResult.responses.map((r, i) => {
              const isSelected = judgeResult?.selectedIndex === i;
              const hasError = !!r.error;
              return (
                <div
                  key={i}
                  style={{
                    flex: '1 1 0',
                    minWidth: '160px',
                    background: isSelected ? '#1a1a3e' : '#12121e',
                    border: `1px solid ${isSelected ? '#8B5CF6' : hasError ? '#3a1a1a' : '#1a1a2e'}`,
                    borderRadius: '6px',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {/* Model header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: isSelected ? '#8B5CF6' : '#808090' }}>
                      {r.provider}/{r.model}
                    </span>
                    {isSelected && <CheckCircle size={12} color="#8B5CF6" />}
                    {hasError && <AlertTriangle size={12} color="#EF4444" />}
                  </div>

                  {/* Latency */}
                  <span style={{ fontSize: '9px', color: '#505060' }}>
                    {r.latencyMs}ms
                    {judgeResult?.scores?.[i] != null && ` · score: ${judgeResult.scores[i].toFixed(2)}`}
                  </span>

                  {/* Content preview */}
                  <div style={{
                    fontSize: '10px', color: hasError ? '#EF4444' : '#a0a0b0',
                    maxHeight: '120px', overflow: 'auto',
                    fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  }}>
                    {hasError ? r.error : (r.content.length > 400 ? r.content.slice(0, 400) + '...' : r.content)}
                  </div>

                  {/* Select button */}
                  {!hasError && onSelect && (
                    <button
                      onClick={() => onSelect(r.content, r.provider, r.model)}
                      style={{
                        padding: '3px 8px', background: isSelected ? '#8B5CF6' : '#2a2a3e',
                        border: 'none', borderRadius: '3px', color: '#e0e0e0',
                        fontSize: '10px', cursor: 'pointer', marginTop: 'auto',
                      }}
                    >
                      {isSelected ? 'Selected' : 'Use This'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Judge Result */}
      {judgeResult && (
        <div style={{
          padding: '8px', background: '#12121e', borderRadius: '6px',
          border: '1px solid #1a1a2e',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#8B5CF6', marginBottom: '4px' }}>
            Judge Decision
          </div>
          <div style={{ fontSize: '11px', color: '#a0a0b0' }}>
            {judgeResult.reasoning}
          </div>
          <div style={{ fontSize: '10px', color: '#606070', marginTop: '4px' }}>
            Confidence: {(judgeResult.confidence * 100).toFixed(0)}%
          </div>
        </div>
      )}

      {/* Dissent Report */}
      {dissentReport && (
        <div style={{
          padding: '8px', background: '#12121e', borderRadius: '6px',
          border: '1px solid #1a1a2e',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#e0e0e0' }}>Dissent Report</span>
            <span style={{
              fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
              color: DISSENT_COLORS[dissentReport.level],
              padding: '1px 6px', borderRadius: '3px',
              background: `${DISSENT_COLORS[dissentReport.level]}15`,
            }}>
              {dissentReport.level}
            </span>
            <span style={{ fontSize: '10px', color: '#606070' }}>
              ({(dissentReport.overallSimilarity * 100).toFixed(0)}% agreement)
            </span>
          </div>

          {dissentReport.consensusPoints.length > 0 && (
            <div style={{ marginBottom: '6px' }}>
              <div style={{ fontSize: '10px', color: '#22C55E', fontWeight: 600, marginBottom: '2px' }}>Consensus</div>
              {dissentReport.consensusPoints.slice(0, 5).map((p, i) => (
                <div key={i} style={{ fontSize: '10px', color: '#808090', paddingLeft: '8px' }}>· {p}</div>
              ))}
            </div>
          )}

          {dissentReport.uniqueContributions.filter(u => u.points.length > 0).length > 0 && (
            <div style={{ marginBottom: '6px' }}>
              <div style={{ fontSize: '10px', color: '#EAB308', fontWeight: 600, marginBottom: '2px' }}>Unique Contributions</div>
              {dissentReport.uniqueContributions.filter(u => u.points.length > 0).map((u, i) => (
                <div key={i} style={{ marginBottom: '3px' }}>
                  <div style={{ fontSize: '9px', color: '#606070' }}>{u.provider}/{u.model}:</div>
                  {u.points.slice(0, 3).map((p, j) => (
                    <div key={j} style={{ fontSize: '10px', color: '#808090', paddingLeft: '8px' }}>· {p}</div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {dissentReport.divergentPairs.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', color: '#EF4444', fontWeight: 600, marginBottom: '2px' }}>Divergent Pairs</div>
              {dissentReport.divergentPairs.slice(0, 3).map((p, i) => (
                <div key={i} style={{ fontSize: '10px', color: '#808090', paddingLeft: '8px' }}>
                  {p.a} ↔ {p.b}: {(p.similarity * 100).toFixed(0)}% similar
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
