// Grammar Division — Sentence/clause/phrase boundary detection from transcription

import type { BoundaryPoint } from '../types/configuration';
import type { TranscribedWord } from '../types/transcription';

type GrammarGranularity = 'sentence' | 'clause' | 'phrase';

// Sentence-ending punctuation
const SENTENCE_ENDINGS = /[.!?]+$/;
// Clause-breaking punctuation
const CLAUSE_BREAKS = /[,;:\u2014\u2013\u2026]+$/; // comma, semicolon, colon, em/en dash, ellipsis
// Phrase-breaking patterns (conjunctions, prepositions at word start suggest new phrase)
const PHRASE_STARTERS = new Set([
  'and', 'but', 'or', 'nor', 'yet', 'so', 'for',
  'because', 'although', 'though', 'while', 'when',
  'if', 'unless', 'until', 'since', 'after', 'before',
  'however', 'therefore', 'moreover', 'furthermore',
  'meanwhile', 'nevertheless', 'nonetheless',
  'then', 'also', 'instead', 'otherwise',
]);

/**
 * Compute grammar-based boundaries from transcription word data.
 * Uses punctuation and word timestamps to find sentence/clause/phrase breaks.
 */
export function computeGrammarBoundaries(
  words: TranscribedWord[],
  params: {
    granularity?: GrammarGranularity;
    minPauseBetweenMs?: number;
  } = {},
): BoundaryPoint[] {
  const {
    granularity = 'sentence',
    minPauseBetweenMs = 100,
  } = params;

  if (words.length <= 1) return [];

  const sorted = [...words].sort((a, b) => a.startTime - b.startTime);
  const boundaries: BoundaryPoint[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const gap = (next.startTime - current.endTime) * 1000; // ms
    const text = current.text.trim();

    let isBoundary = false;
    let confidence = 0;

    // Check sentence endings
    if (SENTENCE_ENDINGS.test(text)) {
      isBoundary = true;
      confidence = 1.0;
    }

    // Check clause breaks (if granularity allows)
    if (!isBoundary && (granularity === 'clause' || granularity === 'phrase')) {
      if (CLAUSE_BREAKS.test(text)) {
        isBoundary = true;
        confidence = 0.8;
      }
    }

    // Check phrase breaks (if granularity allows)
    if (!isBoundary && granularity === 'phrase') {
      const nextWord = next.text.trim().toLowerCase();
      if (PHRASE_STARTERS.has(nextWord) && gap >= minPauseBetweenMs) {
        isBoundary = true;
        confidence = 0.6;
      }
    }

    // Long pause also suggests a boundary at any granularity
    if (!isBoundary && gap >= minPauseBetweenMs * 3) {
      isBoundary = true;
      confidence = 0.5;
    }

    if (isBoundary) {
      // Place boundary at the midpoint of the gap between words
      const boundaryTime = (current.endTime + next.startTime) / 2;
      boundaries.push({
        time: boundaryTime,
        source: 'grammar',
        confidence,
      });
    }
  }

  return boundaries;
}
