// AI Judge — Response aggregation strategies
// Adapted from LLM-Counsel's Judge pattern
// Evaluates and selects the best response from panel results

import type { AICompletionResponse } from './aiProvider';
import { aiRouter } from './aiRouter';

export type AggregationStrategy =
  | 'BEST_OF_N'
  | 'MAJORITY_VOTE'
  | 'CONFIDENCE_WEIGHTED'
  | 'JUDGE_MODEL';

export interface JudgeConfig {
  strategy: AggregationStrategy;
  /** For JUDGE_MODEL: which model serves as judge */
  judgeProvider?: string;
  judgeModel?: string;
}

export interface JudgeResult {
  selectedResponse: AICompletionResponse;
  selectedIndex: number;
  confidence: number; // 0-1
  reasoning: string;
  scores?: number[]; // per-response scores
}

/**
 * Score a response by quality heuristics.
 * Measures structure, completeness, and content quality.
 */
function scoreResponseQuality(response: AICompletionResponse): number {
  const content = response.content;
  if (!content || response.latencyMs === 0) return 0;

  let score = 0;

  // Length — prefer substantive but not overly verbose
  const len = content.length;
  if (len > 10) score += 0.1;
  if (len > 50) score += 0.1;
  if (len > 200) score += 0.1;
  if (len > 2000) score -= 0.05; // Penalize excessive length

  // JSON validity (important for generation tasks)
  try {
    JSON.parse(content);
    score += 0.3; // Well-formed JSON is a strong signal
  } catch {
    // Not JSON — check for structured content
    if (content.includes('{') && content.includes('}')) score += 0.1;
  }

  // Hex color presence (relevant for color/scheme generation)
  const hexColors = content.match(/#[0-9A-Fa-f]{6}/g);
  if (hexColors && hexColors.length > 0) score += 0.1;

  // No error indicators
  if (content.toLowerCase().includes('error') || content.toLowerCase().includes('sorry')) {
    score -= 0.2;
  }

  // Completeness — response starts and ends cleanly
  if (content.startsWith('{') && content.endsWith('}')) score += 0.1;
  if (content.startsWith('[') && content.endsWith(']')) score += 0.1;

  return Math.max(0, Math.min(1, score));
}

/**
 * Compute cosine similarity between two strings using simple character n-gram approach.
 * For real semantic similarity, use embeddings (see aiCache.ts).
 */
function textSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  // Simple character trigram similarity
  const trigramsA = new Set<string>();
  const trigramsB = new Set<string>();
  for (let i = 0; i < a.length - 2; i++) trigramsA.add(a.substring(i, i + 3));
  for (let i = 0; i < b.length - 2; i++) trigramsB.add(b.substring(i, i + 3));

  let intersection = 0;
  for (const t of trigramsA) {
    if (trigramsB.has(t)) intersection++;
  }

  const union = trigramsA.size + trigramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * BEST_OF_N: Score responses by quality heuristics, pick highest.
 */
function bestOfN(responses: AICompletionResponse[]): JudgeResult {
  const scores = responses.map(r => scoreResponseQuality(r));
  const maxScore = Math.max(...scores);
  const selectedIndex = scores.indexOf(maxScore);

  return {
    selectedResponse: responses[selectedIndex],
    selectedIndex,
    confidence: maxScore,
    reasoning: `Selected response ${selectedIndex + 1} (${responses[selectedIndex].provider}/${responses[selectedIndex].model}) with quality score ${maxScore.toFixed(2)}`,
    scores,
  };
}

/**
 * MAJORITY_VOTE: Select response closest to consensus using text similarity.
 */
function majorityVote(responses: AICompletionResponse[]): JudgeResult {
  // Compute pairwise similarity
  const n = responses.length;
  const avgSimilarities = responses.map((r, i) => {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j) sum += textSimilarity(r.content, responses[j].content);
    }
    return sum / (n - 1);
  });

  const maxSim = Math.max(...avgSimilarities);
  const selectedIndex = avgSimilarities.indexOf(maxSim);

  return {
    selectedResponse: responses[selectedIndex],
    selectedIndex,
    confidence: maxSim,
    reasoning: `Selected response ${selectedIndex + 1} as closest to consensus (avg similarity: ${maxSim.toFixed(2)})`,
    scores: avgSimilarities,
  };
}

/**
 * CONFIDENCE_WEIGHTED: Combine quality score (70%) + latency factor (30%).
 */
function confidenceWeighted(responses: AICompletionResponse[]): JudgeResult {
  const qualityScores = responses.map(r => scoreResponseQuality(r));
  const maxLatency = Math.max(...responses.map(r => r.latencyMs), 1);
  const latencyScores = responses.map(r => 1 - (r.latencyMs / maxLatency)); // Faster = higher

  const combined = responses.map((_, i) =>
    qualityScores[i] * 0.7 + latencyScores[i] * 0.3
  );

  const maxScore = Math.max(...combined);
  const selectedIndex = combined.indexOf(maxScore);

  return {
    selectedResponse: responses[selectedIndex],
    selectedIndex,
    confidence: maxScore,
    reasoning: `Selected response ${selectedIndex + 1} (quality: ${qualityScores[selectedIndex].toFixed(2)}, speed: ${latencyScores[selectedIndex].toFixed(2)}, combined: ${maxScore.toFixed(2)})`,
    scores: combined,
  };
}

/**
 * JUDGE_MODEL: Use a designated model to evaluate and select the best response.
 */
async function judgeModel(
  responses: AICompletionResponse[],
  originalRequest: string,
  config: JudgeConfig,
): Promise<JudgeResult> {
  const judgeProvider = config.judgeProvider ?? 'openai';
  const judgeModelId = config.judgeModel ?? 'gpt-4o-mini';

  const responseSummaries = responses.map((r, i) =>
    `Response ${i + 1} (${r.provider}/${r.model}, ${r.latencyMs}ms):\n${r.content}`
  ).join('\n\n---\n\n');

  try {
    const judgeResponse = await aiRouter.complete(
      'general-chat',
      {
        messages: [
          {
            role: 'system',
            content: `You are a response quality judge. Given an original prompt and multiple AI responses, select the best one.
Return ONLY valid JSON: {"selected":1,"confidence":0.85,"reasoning":"Brief explanation"}
"selected" is 1-indexed. "confidence" is 0-1. Be concise.`,
          },
          {
            role: 'user',
            content: `Original prompt: ${originalRequest}\n\n${responseSummaries}\n\nWhich response is best?`,
          },
        ],
        maxTokens: 150,
      },
      judgeProvider,
      judgeModelId,
    );

    const parsed = JSON.parse(judgeResponse.content);
    const selectedIndex = (parsed.selected ?? 1) - 1;
    const clamped = Math.max(0, Math.min(responses.length - 1, selectedIndex));

    return {
      selectedResponse: responses[clamped],
      selectedIndex: clamped,
      confidence: parsed.confidence ?? 0.5,
      reasoning: parsed.reasoning ?? 'Judge model selected this response',
    };
  } catch {
    // Fallback to BEST_OF_N if judge fails
    return bestOfN(responses);
  }
}

/**
 * Judge responses using the specified aggregation strategy.
 */
export async function judgeResponses(
  responses: AICompletionResponse[],
  config: JudgeConfig,
  originalPrompt?: string,
): Promise<JudgeResult> {
  // Filter out error responses
  const valid = responses.filter(r => r.content && !('error' in r && (r as any).error));
  if (valid.length === 0) {
    throw new Error('No valid responses to judge');
  }
  if (valid.length === 1) {
    return {
      selectedResponse: valid[0],
      selectedIndex: 0,
      confidence: 0.5,
      reasoning: 'Only one valid response available',
    };
  }

  switch (config.strategy) {
    case 'BEST_OF_N':
      return bestOfN(valid);
    case 'MAJORITY_VOTE':
      return majorityVote(valid);
    case 'CONFIDENCE_WEIGHTED':
      return confidenceWeighted(valid);
    case 'JUDGE_MODEL':
      return judgeModel(valid, originalPrompt ?? '', config);
    default:
      return bestOfN(valid);
  }
}
