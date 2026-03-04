// AI Usage Dashboard — Cost, latency, and cache analytics
// Displays per-model and per-task usage statistics

import { useState, useEffect } from 'react';
import { BarChart3, RefreshCw, Trash2 } from 'lucide-react';
import type { AggregateStats } from '../../utils/aiMetrics';
import { metricsTracker } from '../../utils/aiMetrics';
import { semanticCache } from '../../utils/aiCache';

type TimeRange = 'all' | 'hour' | 'day' | 'week';

const TIME_RANGES: Record<TimeRange, { label: string; ms?: number }> = {
  all: { label: 'All Time' },
  hour: { label: 'Last Hour', ms: 3600000 },
  day: { label: 'Last 24h', ms: 86400000 },
  week: { label: 'Last 7d', ms: 604800000 },
};

function formatCost(usd: number): string {
  if (usd < 0.001) return '<$0.001';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function AIUsageDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [stats, setStats] = useState<AggregateStats | null>(null);
  const [cacheStats, setCacheStats] = useState<{ entries: number; categories: Record<string, number>; totalHits: number } | null>(null);

  const refresh = () => {
    const sinceMs = TIME_RANGES[timeRange].ms;
    setStats(metricsTracker.getStats(sinceMs));
    setCacheStats(semanticCache.getStats());
  };

  useEffect(() => { refresh(); }, [timeRange]);

  if (!stats) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={14} color="#8B5CF6" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#e0e0e0' }}>AI Usage</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={refresh}
            style={{ background: 'none', border: 'none', color: '#606070', cursor: 'pointer', padding: '2px' }}
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
          <button
            onClick={() => { metricsTracker.clear(); semanticCache.clear(); refresh(); }}
            style={{ background: 'none', border: 'none', color: '#606070', cursor: 'pointer', padding: '2px' }}
            title="Clear all data"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Time range selector */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {Object.entries(TIME_RANGES).map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => setTimeRange(key as TimeRange)}
            style={{
              padding: '3px 8px', fontSize: '10px', fontWeight: 600,
              background: timeRange === key ? '#8B5CF615' : 'none',
              border: `1px solid ${timeRange === key ? '#8B5CF650' : '#2a2a3e'}`,
              borderRadius: '3px', color: timeRange === key ? '#8B5CF6' : '#606070',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {[
          { label: 'Queries', value: stats.totalQueries.toString() },
          { label: 'Total Cost', value: formatCost(stats.totalCost) },
          { label: 'Avg Latency', value: formatMs(stats.avgLatencyMs) },
          { label: 'Cache Hit Rate', value: `${(stats.cacheHitRate * 100).toFixed(0)}%` },
        ].map((card) => (
          <div key={card.label} style={{
            padding: '8px', background: '#12121e', borderRadius: '4px',
            border: '1px solid #1a1a2e', textAlign: 'center',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#e0e0e0' }}>{card.value}</div>
            <div style={{ fontSize: '9px', color: '#606070', textTransform: 'uppercase', marginTop: '2px' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* By Provider */}
      {Object.keys(stats.byProvider).length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#808090', marginBottom: '6px' }}>By Provider</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {Object.entries(stats.byProvider).map(([provider, pStats]) => (
              <div key={provider} style={{
                padding: '6px 8px', background: '#12121e', borderRadius: '4px',
                border: '1px solid #1a1a2e',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#c0c0d0' }}>{provider}</span>
                  <span style={{ fontSize: '10px', color: '#606070' }}>
                    {pStats.queries} queries · {formatCost(pStats.totalCost)} · avg {formatMs(pStats.avgLatencyMs)}
                  </span>
                </div>
                {Object.entries(pStats.models).length > 1 && (
                  <div style={{ marginTop: '4px', paddingLeft: '8px' }}>
                    {Object.entries(pStats.models).map(([model, mStats]) => (
                      <div key={model} style={{ fontSize: '10px', color: '#505060', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{model}</span>
                        <span>{mStats.queries}x · {formatCost(mStats.totalCost)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Task */}
      {Object.keys(stats.byTask).length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#808090', marginBottom: '6px' }}>By Task</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {Object.entries(stats.byTask).map(([task, tStats]) => (
              <div key={task} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '4px 8px', background: '#12121e', borderRadius: '4px',
                border: '1px solid #1a1a2e', fontSize: '10px',
              }}>
                <span style={{ color: '#a0a0b0' }}>{task}</span>
                <span style={{ color: '#606070' }}>
                  {tStats.queries}x · {formatCost(tStats.totalCost)} · avg {formatMs(tStats.avgLatencyMs)}
                  {tStats.cacheHits > 0 && ` · ${tStats.cacheHits} cached`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cache Stats */}
      {cacheStats && cacheStats.entries > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#808090', marginBottom: '6px' }}>Cache</div>
          <div style={{
            padding: '6px 8px', background: '#12121e', borderRadius: '4px',
            border: '1px solid #1a1a2e', fontSize: '10px', color: '#606070',
          }}>
            {cacheStats.entries} entries · {cacheStats.totalHits} hits
            {Object.keys(cacheStats.categories).length > 0 && (
              <span> · {Object.entries(cacheStats.categories).map(([k, v]) => `${k}: ${v}`).join(', ')}</span>
            )}
          </div>
        </div>
      )}

      {stats.totalQueries === 0 && (
        <div style={{ fontSize: '11px', color: '#505060', textAlign: 'center', padding: '16px 0' }}>
          No AI queries recorded yet. Generate colors, schemes, or textures in the Forge to see usage data.
        </div>
      )}
    </div>
  );
}
