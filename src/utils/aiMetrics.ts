// AI Metrics Tracker — Cost, latency, and usage tracking per model
// Adapted from LLM-Counsel's MetricsTracker pattern

export interface QueryMetric {
  timestamp: number;
  provider: string;
  model: string;
  taskCategory: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number; // USD
  cached: boolean;
}

export interface AggregateStats {
  totalQueries: number;
  totalCost: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  cacheHitRate: number;
  byProvider: Record<string, ProviderStats>;
  byTask: Record<string, TaskStats>;
}

export interface ProviderStats {
  queries: number;
  totalCost: number;
  avgLatencyMs: number;
  models: Record<string, { queries: number; totalCost: number; avgLatencyMs: number }>;
}

export interface TaskStats {
  queries: number;
  totalCost: number;
  avgLatencyMs: number;
  cacheHits: number;
}

// Approximate cost per 1K tokens (USD) — kept in sync with aiProvider model defs
const COST_TABLE: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'dall-e-3': { input: 0.04, output: 0 }, // Per image, not token
  'claude-sonnet-4-6': { input: 0.003, output: 0.015 },
  'claude-haiku-4-5-20251001': { input: 0.0008, output: 0.004 },
  'claude-opus-4-6': { input: 0.015, output: 0.075 },
  'gemini-2.0-flash': { input: 0.000075, output: 0.0003 },
  'gemini-2.0-pro': { input: 0.00125, output: 0.005 },
};

// ─── Metrics Manager ─────────────────────────────────────────────────────────

class MetricsTracker {
  private metrics: QueryMetric[] = [];
  private maxEntries = 1000;

  /** Record a query metric */
  record(metric: Omit<QueryMetric, 'estimatedCost'>): void {
    const costs = COST_TABLE[metric.model];
    const estimatedCost = costs
      ? (metric.inputTokens / 1000) * costs.input + (metric.outputTokens / 1000) * costs.output
      : 0;

    this.metrics.push({ ...metric, estimatedCost });

    // Enforce max entries
    if (this.metrics.length > this.maxEntries) {
      this.metrics = this.metrics.slice(-this.maxEntries);
    }
  }

  /** Convenience recorder for standard completion responses */
  recordCompletion(
    provider: string,
    model: string,
    taskCategory: string,
    latencyMs: number,
    contentLength: number,
    cached: boolean = false,
  ): void {
    // Rough token estimation: ~4 chars per token
    const outputTokens = Math.ceil(contentLength / 4);
    this.record({
      timestamp: Date.now(),
      provider,
      model,
      taskCategory,
      latencyMs,
      inputTokens: 0, // Not easily available without provider SDK
      outputTokens,
      cached,
    });
  }

  /** Get aggregate statistics */
  getStats(sinceMs?: number): AggregateStats {
    const cutoff = sinceMs ? Date.now() - sinceMs : 0;
    const relevant = this.metrics.filter(m => m.timestamp >= cutoff);

    const totalQueries = relevant.length;
    const totalCost = relevant.reduce((s, m) => s + m.estimatedCost, 0);
    const totalLatencyMs = relevant.reduce((s, m) => s + m.latencyMs, 0);
    const cacheHits = relevant.filter(m => m.cached).length;

    const byProvider: Record<string, ProviderStats> = {};
    const byTask: Record<string, TaskStats> = {};

    for (const m of relevant) {
      // By provider
      if (!byProvider[m.provider]) {
        byProvider[m.provider] = { queries: 0, totalCost: 0, avgLatencyMs: 0, models: {} };
      }
      const p = byProvider[m.provider];
      p.queries++;
      p.totalCost += m.estimatedCost;
      p.avgLatencyMs = (p.avgLatencyMs * (p.queries - 1) + m.latencyMs) / p.queries;

      if (!p.models[m.model]) {
        p.models[m.model] = { queries: 0, totalCost: 0, avgLatencyMs: 0 };
      }
      const pm = p.models[m.model];
      pm.queries++;
      pm.totalCost += m.estimatedCost;
      pm.avgLatencyMs = (pm.avgLatencyMs * (pm.queries - 1) + m.latencyMs) / pm.queries;

      // By task
      if (!byTask[m.taskCategory]) {
        byTask[m.taskCategory] = { queries: 0, totalCost: 0, avgLatencyMs: 0, cacheHits: 0 };
      }
      const t = byTask[m.taskCategory];
      t.queries++;
      t.totalCost += m.estimatedCost;
      t.avgLatencyMs = (t.avgLatencyMs * (t.queries - 1) + m.latencyMs) / t.queries;
      if (m.cached) t.cacheHits++;
    }

    return {
      totalQueries,
      totalCost,
      totalLatencyMs,
      avgLatencyMs: totalQueries > 0 ? totalLatencyMs / totalQueries : 0,
      cacheHitRate: totalQueries > 0 ? cacheHits / totalQueries : 0,
      byProvider,
      byTask,
    };
  }

  /** Get raw metrics (for export/debugging) */
  getRawMetrics(): QueryMetric[] {
    return [...this.metrics];
  }

  /** Clear all metrics */
  clear(): void {
    this.metrics = [];
  }

  /** Get recent metrics (last N) */
  getRecent(n: number = 20): QueryMetric[] {
    return this.metrics.slice(-n);
  }
}

// ─── Singleton Export ────────────────────────────────────────────────────────

export const metricsTracker = new MetricsTracker();
