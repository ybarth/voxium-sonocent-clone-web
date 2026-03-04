// AI Dissent Detector — Disagreement analysis between model responses
// Adapted from LLM-Counsel's DissentDetector pattern
// Analyzes divergence between panel responses to surface where models agree/disagree

import type { AICompletionResponse } from './aiProvider';

export type DissentLevel = 'none' | 'low' | 'moderate' | 'high';

export interface DissentReport {
  level: DissentLevel;
  overallSimilarity: number; // 0-1
  consensusPoints: string[];
  uniqueContributions: { provider: string; model: string; points: string[] }[];
  divergentPairs: { a: string; b: string; similarity: number }[];
}

/**
 * Extract key features/claims from a response.
 * Uses simple heuristic extraction (JSON keys, hex colors, labels, sentences).
 */
function extractFeatures(content: string): string[] {
  const features: string[] = [];

  // Try JSON key extraction
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === 'object' && parsed !== null) {
      for (const [key, value] of Object.entries(parsed)) {
        if (Array.isArray(value)) {
          features.push(`${key}:[${value.length} items]`);
          value.forEach((v, i) => {
            if (typeof v === 'string') features.push(`${key}[${i}]=${v}`);
          });
        } else if (typeof value === 'string') {
          features.push(`${key}=${value}`);
        } else if (typeof value === 'number') {
          features.push(`${key}=${value}`);
        }
      }
    }
  } catch {
    // Not JSON — extract from plain text
    // Extract hex colors
    const hexColors = content.match(/#[0-9A-Fa-f]{6}/g);
    if (hexColors) hexColors.forEach(c => features.push(`color=${c}`));

    // Extract quoted strings
    const quoted = content.match(/"([^"]{2,40})"/g);
    if (quoted) quoted.forEach(q => features.push(`label=${q}`));

    // Split into sentences as features
    const sentences = content.split(/[.!?\n]+/).filter(s => s.trim().length > 10);
    sentences.slice(0, 10).forEach(s => features.push(s.trim().toLowerCase()));
  }

  return features;
}

/**
 * Compute Jaccard similarity between two feature sets.
 */
function featureSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const setA = new Set(a.map(f => f.toLowerCase()));
  const setB = new Set(b.map(f => f.toLowerCase()));

  let intersection = 0;
  for (const f of setA) {
    if (setB.has(f)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Classify dissent level from similarity score.
 */
function classifyDissent(similarity: number): DissentLevel {
  if (similarity > 0.85) return 'none';
  if (similarity > 0.7) return 'low';
  if (similarity > 0.5) return 'moderate';
  return 'high';
}

/**
 * Find features common across all responses (consensus points).
 */
function findConsensus(allFeatures: string[][]): string[] {
  if (allFeatures.length < 2) return [];

  const featureCounts = new Map<string, number>();
  for (const features of allFeatures) {
    const unique = new Set(features.map(f => f.toLowerCase()));
    for (const f of unique) {
      featureCounts.set(f, (featureCounts.get(f) ?? 0) + 1);
    }
  }

  // Features present in majority of responses
  const threshold = Math.ceil(allFeatures.length / 2);
  return Array.from(featureCounts.entries())
    .filter(([, count]) => count >= threshold)
    .map(([feature]) => feature)
    .slice(0, 10);
}

/**
 * Find features unique to a single response.
 */
function findUniqueContributions(
  allFeatures: string[][],
  responses: AICompletionResponse[],
): { provider: string; model: string; points: string[] }[] {
  const allFeaturesLower = allFeatures.map(f => new Set(f.map(x => x.toLowerCase())));

  return responses.map((r, i) => {
    const unique: string[] = [];
    for (const feature of allFeaturesLower[i]) {
      let isUnique = true;
      for (let j = 0; j < allFeaturesLower.length; j++) {
        if (i !== j && allFeaturesLower[j].has(feature)) {
          isUnique = false;
          break;
        }
      }
      if (isUnique) unique.push(feature);
    }
    return {
      provider: r.provider,
      model: r.model,
      points: unique.slice(0, 5),
    };
  });
}

/**
 * Analyze disagreement between panel responses.
 * Returns a dissent report with consensus points, unique contributions, and divergent pairs.
 */
export function analyzeDisent(responses: AICompletionResponse[]): DissentReport {
  if (responses.length < 2) {
    return {
      level: 'none',
      overallSimilarity: 1,
      consensusPoints: [],
      uniqueContributions: [],
      divergentPairs: [],
    };
  }

  // Extract features from each response
  const allFeatures = responses.map(r => extractFeatures(r.content));

  // Compute pairwise similarity
  const pairSimilarities: { a: string; b: string; similarity: number }[] = [];
  let totalSimilarity = 0;
  let pairCount = 0;

  for (let i = 0; i < responses.length; i++) {
    for (let j = i + 1; j < responses.length; j++) {
      const sim = featureSimilarity(allFeatures[i], allFeatures[j]);
      pairSimilarities.push({
        a: `${responses[i].provider}/${responses[i].model}`,
        b: `${responses[j].provider}/${responses[j].model}`,
        similarity: sim,
      });
      totalSimilarity += sim;
      pairCount++;
    }
  }

  const overallSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 1;

  // Sort pairs by divergence (lowest similarity first)
  const divergentPairs = pairSimilarities
    .filter(p => p.similarity < 0.85)
    .sort((a, b) => a.similarity - b.similarity);

  return {
    level: classifyDissent(overallSimilarity),
    overallSimilarity,
    consensusPoints: findConsensus(allFeatures),
    uniqueContributions: findUniqueContributions(allFeatures, responses),
    divergentPairs,
  };
}
