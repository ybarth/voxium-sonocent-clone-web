// Clarification query generator — generates questions for ambiguous words

import { v4 as uuid } from 'uuid';
import { aiRouter } from './aiRouter';
import type { TranscribedWord, ClarificationQuery } from '../types/transcription';

/**
 * Generate clarification queries for flagged/low-confidence words.
 */
export async function generateClarifications(
  flaggedWords: TranscribedWord[],
  allWords: TranscribedWord[],
): Promise<ClarificationQuery[]> {
  if (flaggedWords.length === 0) return [];

  const sorted = [...allWords].sort((a, b) => a.startTime - b.startTime);

  // Build context for each flagged word
  const entries = flaggedWords.slice(0, 20).map((fw, i) => {
    const idx = sorted.findIndex(w => w.id === fw.id);
    const start = Math.max(0, idx - 5);
    const end = Math.min(sorted.length - 1, idx + 5);
    const before = sorted.slice(start, idx).map(w => w.text).join(' ');
    const after = sorted.slice(idx + 1, end + 1).map(w => w.text).join(' ');
    return `${i + 1}. "...${before} [${fw.text}] ${after}..." (confidence: ${fw.confidence.toFixed(2)}, flags: ${fw.flags.join(', ') || 'none'})`;
  });

  const prompt = `The following words (in brackets) have low transcription confidence. Generate a natural-language clarification question for each, along with 2-3 suggested corrections.

${entries.join('\n')}

Respond in JSON:
{
  "queries": [
    {
      "index": 1,
      "question": "Did the speaker say 'word' or 'alternative'?",
      "suggestions": ["word1", "word2", "word3"]
    }
  ]
}`;

  try {
    const response = await aiRouter.complete('general-chat', {
      messages: [
        { role: 'system', content: 'You are a transcription review assistant. Generate helpful clarification questions for ambiguous words. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      maxTokens: 1500,
      responseFormat: 'json',
    });

    const parsed = JSON.parse(response.content);
    const queries: ClarificationQuery[] = [];

    for (const q of parsed.queries ?? []) {
      const idx = (q.index ?? 1) - 1;
      if (idx < 0 || idx >= flaggedWords.length) continue;

      const fw = flaggedWords[idx];
      const sortedIdx = sorted.findIndex(w => w.id === fw.id);
      const start = Math.max(0, sortedIdx - 5);
      const end = Math.min(sorted.length - 1, sortedIdx + 5);
      const context = sorted.slice(start, end + 1).map(w => w.text).join(' ');

      queries.push({
        id: uuid(),
        wordId: fw.id,
        context,
        question: q.question ?? `Is "${fw.text}" the correct word here?`,
        suggestions: q.suggestions ?? [],
        resolved: false,
        resolvedText: null,
      });
    }

    return queries;
  } catch (err) {
    console.warn('Clarification generation failed:', err);

    // Fallback: generate simple queries
    return flaggedWords.slice(0, 10).map(fw => ({
      id: uuid(),
      wordId: fw.id,
      context: fw.text,
      question: `Is "${fw.text}" the correct word here?`,
      suggestions: [],
      resolved: false,
      resolvedText: null,
    }));
  }
}
