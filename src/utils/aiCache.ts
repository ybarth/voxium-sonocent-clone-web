// AI Semantic Cache — Cache generation results by semantic similarity
// Adapted from LLM-Counsel's SemanticCache pattern
// Returns cached results when similar prompts have been seen before

export interface CacheEntry {
  prompt: string;
  promptTokens: string[]; // Normalized word tokens for similarity
  response: string;
  provider: string;
  model: string;
  taskCategory: string;
  timestamp: number;
  hitCount: number;
}

export interface CacheConfig {
  /** Similarity threshold for cache hits (0-1). Default 0.92 */
  similarityThreshold: number;
  /** Max entries to keep */
  maxEntries: number;
  /** TTL in ms. Default 1 hour */
  ttlMs: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  similarityThreshold: 0.92,
  maxEntries: 200,
  ttlMs: 3600000, // 1 hour
};

/**
 * Normalize text into word tokens for similarity comparison.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1)
    .sort();
}

/**
 * Compute Jaccard similarity between two token arrays.
 */
function tokenSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const setA = new Set(a);
  const setB = new Set(b);

  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ─── Cache Manager ───────────────────────────────────────────────────────────

class SemanticCache {
  private entries: CacheEntry[] = [];
  private config: CacheConfig = { ...DEFAULT_CONFIG };

  /** Look up a cached response by semantic similarity */
  lookup(prompt: string, taskCategory: string): CacheEntry | null {
    const now = Date.now();
    const tokens = tokenize(prompt);

    // Search for similar cached entries
    let bestMatch: CacheEntry | null = null;
    let bestSimilarity = 0;

    for (const entry of this.entries) {
      // Must match task category
      if (entry.taskCategory !== taskCategory) continue;

      // Check TTL
      if (now - entry.timestamp > this.config.ttlMs) continue;

      const similarity = tokenSimilarity(tokens, entry.promptTokens);
      if (similarity >= this.config.similarityThreshold && similarity > bestSimilarity) {
        bestMatch = entry;
        bestSimilarity = similarity;
      }
    }

    if (bestMatch) {
      bestMatch.hitCount++;
    }

    return bestMatch;
  }

  /** Store a response in the cache */
  store(
    prompt: string,
    response: string,
    provider: string,
    model: string,
    taskCategory: string,
  ): void {
    // Evict expired entries
    this.evictExpired();

    // Check if we already have a very similar entry
    const tokens = tokenize(prompt);
    const existing = this.entries.find(e =>
      e.taskCategory === taskCategory && tokenSimilarity(tokens, e.promptTokens) > 0.98
    );
    if (existing) {
      // Update existing entry
      existing.response = response;
      existing.provider = provider;
      existing.model = model;
      existing.timestamp = Date.now();
      return;
    }

    // Add new entry
    this.entries.push({
      prompt,
      promptTokens: tokens,
      response,
      provider,
      model,
      taskCategory,
      timestamp: Date.now(),
      hitCount: 0,
    });

    // Enforce max entries (evict oldest, least-used)
    if (this.entries.length > this.config.maxEntries) {
      this.entries.sort((a, b) => {
        // Keep entries with more hits
        if (a.hitCount !== b.hitCount) return b.hitCount - a.hitCount;
        return b.timestamp - a.timestamp;
      });
      this.entries = this.entries.slice(0, this.config.maxEntries);
    }
  }

  /** Get cache statistics */
  getStats(): { entries: number; categories: Record<string, number>; totalHits: number } {
    const categories: Record<string, number> = {};
    let totalHits = 0;
    for (const entry of this.entries) {
      categories[entry.taskCategory] = (categories[entry.taskCategory] ?? 0) + 1;
      totalHits += entry.hitCount;
    }
    return { entries: this.entries.length, categories, totalHits };
  }

  /** Clear cache (all or by category) */
  clear(taskCategory?: string): void {
    if (taskCategory) {
      this.entries = this.entries.filter(e => e.taskCategory !== taskCategory);
    } else {
      this.entries = [];
    }
  }

  /** Update config */
  updateConfig(updates: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): CacheConfig {
    return this.config;
  }

  private evictExpired(): void {
    const now = Date.now();
    this.entries = this.entries.filter(e => now - e.timestamp <= this.config.ttlMs);
  }
}

// ─── Singleton Export ────────────────────────────────────────────────────────

export const semanticCache = new SemanticCache();
