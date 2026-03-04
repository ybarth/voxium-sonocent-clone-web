// Confidence Analyzer — contextual confidence scoring via LLM

import { v4 as uuid } from 'uuid';
import { aiRouter } from './aiRouter';
import type { TranscribedWord, WordAlternative, WordFlag, TranscriptionSettings } from '../types/transcription';

interface ConfidenceResult {
  wordId: string;
  contextualConfidence: number;
  alternatives: WordAlternative[];
  flags: WordFlag[];
}

/**
 * Analyze words below the borderline threshold using LLM context windows.
 * Groups flagged words into context windows and batch-analyzes them.
 */
export async function analyzeConfidence(
  words: TranscribedWord[],
  settings: TranscriptionSettings,
): Promise<ConfidenceResult[]> {
  const sorted = [...words].sort((a, b) => a.startTime - b.startTime);

  // Find words needing analysis
  const flaggedIndices: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].confidence < settings.borderlineThreshold) {
      flaggedIndices.push(i);
    }
  }

  if (flaggedIndices.length === 0) return [];

  // Build context windows (±5 words around each flagged word)
  const windowSize = 5;
  const windows: { wordIdx: number; contextBefore: string; word: string; contextAfter: string }[] = [];

  for (const idx of flaggedIndices) {
    const start = Math.max(0, idx - windowSize);
    const end = Math.min(sorted.length - 1, idx + windowSize);
    const before = sorted.slice(start, idx).map(w => w.text).join(' ');
    const after = sorted.slice(idx + 1, end + 1).map(w => w.text).join(' ');
    windows.push({
      wordIdx: idx,
      contextBefore: before,
      word: sorted[idx].text,
      contextAfter: after,
    });
  }

  // Batch into groups of 10 to avoid overwhelming the LLM
  const batchSize = 10;
  const results: ConfidenceResult[] = [];

  for (let i = 0; i < windows.length; i += batchSize) {
    const batch = windows.slice(i, i + batchSize);

    const wordEntries = batch.map((w, j) => (
      `${j + 1}. Context: "...${w.contextBefore} [${w.word}] ${w.contextAfter}..."\n   Word: "${w.word}" (STT confidence: ${sorted[w.wordIdx].confidence.toFixed(2)})`
    )).join('\n');

    const prompt = `Analyze the following transcription words marked in [brackets] for correctness in context. For each word:
1. Does the word make sense in this context? (score 0-1)
2. What alternative words could fit here? List up to 3 alternatives with confidence scores.
3. Flag any issues: "false-start", "filler-word", "incomplete-clause", "sense-check-fail"

Words to analyze:
${wordEntries}

Respond in JSON format:
{
  "analyses": [
    {
      "index": 1,
      "contextualConfidence": 0.8,
      "alternatives": [{"text": "word", "confidence": 0.7, "category": "lexical"}],
      "flags": []
    }
  ]
}`;

    try {
      const response = await aiRouter.complete('general-chat', {
        messages: [
          { role: 'system', content: 'You are a transcription quality analyst. Analyze word-level transcription accuracy in context. Always respond with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        maxTokens: 1500,
        responseFormat: 'json',
      });

      const parsed = JSON.parse(response.content);
      if (parsed.analyses) {
        for (const analysis of parsed.analyses) {
          const batchIdx = (analysis.index ?? 1) - 1;
          if (batchIdx < 0 || batchIdx >= batch.length) continue;

          const wordIdx = batch[batchIdx].wordIdx;
          const word = sorted[wordIdx];

          results.push({
            wordId: word.id,
            contextualConfidence: Math.max(0, Math.min(1, analysis.contextualConfidence ?? word.confidence)),
            alternatives: (analysis.alternatives ?? []).map((a: any) => ({
              text: a.text ?? '',
              confidence: a.confidence ?? 0.5,
              category: a.category ?? 'lexical',
            })),
            flags: (analysis.flags ?? []).filter((f: string) =>
              ['false-start', 'filler-word', 'incomplete-clause', 'sense-check-fail', 'low-confidence', 'borderline'].includes(f)
            ),
          });
        }
      }
    } catch (err) {
      console.warn('Confidence analysis batch failed:', err);
      // Fallback: mark all in batch with raw confidence
      for (const w of batch) {
        const word = sorted[w.wordIdx];
        results.push({
          wordId: word.id,
          contextualConfidence: word.confidence,
          alternatives: [],
          flags: word.confidence < settings.confidenceThreshold ? ['low-confidence'] : [],
        });
      }
    }
  }

  return results;
}
