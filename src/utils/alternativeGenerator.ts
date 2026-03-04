// Alternative word suggestion generator

import { aiRouter } from './aiRouter';
import type { TranscribedWord, WordAlternative } from '../types/transcription';

/**
 * Generate alternative suggestions for a word in context.
 * Combines existing STT alternatives with on-demand LLM-generated ones.
 */
export async function generateAlternatives(
  word: TranscribedWord,
  contextWords: TranscribedWord[], // surrounding words for context
): Promise<WordAlternative[]> {
  // Start with existing STT alternatives
  const existing = [...word.alternatives];

  // Build context string
  const sorted = [...contextWords].sort((a, b) => a.startTime - b.startTime);
  const wordIdx = sorted.findIndex(w => w.id === word.id);
  const before = sorted.slice(Math.max(0, wordIdx - 5), wordIdx).map(w => w.text).join(' ');
  const after = sorted.slice(wordIdx + 1, wordIdx + 6).map(w => w.text).join(' ');

  const prompt = `In the sentence: "...${before} [${word.text}] ${after}..."

The word in brackets "${word.text}" might be incorrect (STT confidence: ${word.confidence.toFixed(2)}).

Suggest up to 5 alternative words that could fit this context. For each, provide:
- The alternative word/phrase
- Confidence (0-1) it's the correct word
- Category: "lexical" (different word), "grammatical" (different form), "syntactical" (rephrasing), "formatting" (punctuation/capitalization)

Respond in JSON:
{
  "alternatives": [
    {"text": "word", "confidence": 0.8, "category": "lexical"}
  ]
}`;

  try {
    const response = await aiRouter.complete('general-chat', {
      messages: [
        { role: 'system', content: 'You are a transcription error correction specialist. Suggest alternative words that fit the context. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      maxTokens: 500,
      responseFormat: 'json',
    });

    const parsed = JSON.parse(response.content);
    const llmAlts: WordAlternative[] = (parsed.alternatives ?? []).map((a: any) => ({
      text: a.text ?? '',
      confidence: Math.max(0, Math.min(1, a.confidence ?? 0.5)),
      category: ['lexical', 'grammatical', 'syntactical', 'formatting'].includes(a.category)
        ? a.category
        : 'lexical',
    }));

    // Merge and deduplicate
    const seen = new Set(existing.map(a => a.text.toLowerCase()));
    for (const alt of llmAlts) {
      if (!seen.has(alt.text.toLowerCase()) && alt.text.toLowerCase() !== word.text.toLowerCase()) {
        existing.push(alt);
        seen.add(alt.text.toLowerCase());
      }
    }
  } catch (err) {
    console.warn('Alternative generation failed:', err);
  }

  // Sort by confidence descending
  return existing.sort((a, b) => b.confidence - a.confidence);
}
