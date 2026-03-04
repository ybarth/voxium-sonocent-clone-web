// Topic Division — AI-powered topic shift detection from transcription

import type { BoundaryPoint } from '../types/configuration';
import type { TranscribedWord } from '../types/transcription';
import { aiRouter } from './aiRouter';

/**
 * Detect topic shift boundaries by sending transcript windows to an LLM.
 * Maps topic shifts back to word timestamps.
 */
export async function computeTopicBoundaries(
  words: TranscribedWord[],
  params: {
    windowSize?: number;   // words per window
    overlap?: number;      // overlap between windows
    sensitivity?: 'low' | 'medium' | 'high';
  } = {},
): Promise<BoundaryPoint[]> {
  const {
    windowSize = 50,
    overlap = 10,
    sensitivity = 'medium',
  } = params;

  if (words.length < windowSize) {
    // Too few words for topic detection
    return [];
  }

  const sorted = [...words].sort((a, b) => a.startTime - b.startTime);

  // Build windows of text with word indices
  const windows: { text: string; startIdx: number; endIdx: number }[] = [];
  for (let i = 0; i < sorted.length; i += windowSize - overlap) {
    const end = Math.min(i + windowSize, sorted.length);
    const text = sorted.slice(i, end).map(w => w.text).join(' ');
    windows.push({ text, startIdx: i, endIdx: end - 1 });
    if (end >= sorted.length) break;
  }

  if (windows.length < 2) return [];

  // Build prompt for LLM
  const sensitivityGuide = {
    low: 'Only mark major topic changes (completely different subjects).',
    medium: 'Mark moderate topic shifts (new subtopics or significant direction changes).',
    high: 'Mark even subtle topic shifts (new ideas, examples, or tangential points).',
  };

  const numberedWindows = windows.map((w, i) =>
    `[Window ${i + 1}] (words ${w.startIdx}-${w.endIdx}):\n${w.text}`,
  ).join('\n\n');

  const prompt = `Analyze this transcript for topic shifts. ${sensitivityGuide[sensitivity]}

${numberedWindows}

Return a JSON array of topic shift points. Each entry should have:
- "afterWindow": the window number after which the topic shifts (1-indexed)
- "confidence": 0-1 how confident you are this is a real topic shift
- "description": brief description of the topic change

Return ONLY the JSON array, no other text. Example: [{"afterWindow": 2, "confidence": 0.8, "description": "shifts from introduction to main argument"}]`;

  try {
    const response = await aiRouter.complete('division-suggestion', {
      messages: [
        { role: 'system', content: 'You are a text analysis assistant. Respond only with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 1000,
      responseFormat: 'json',
    });

    const shifts = JSON.parse(response.content) as {
      afterWindow: number;
      confidence: number;
      description: string;
    }[];

    // Map shifts back to word timestamps
    const boundaries: BoundaryPoint[] = [];
    for (const shift of shifts) {
      const windowIdx = shift.afterWindow - 1;
      if (windowIdx < 0 || windowIdx >= windows.length - 1) continue;

      const lastWordInWindow = sorted[windows[windowIdx].endIdx];
      const firstWordInNext = sorted[windows[windowIdx + 1].startIdx];

      if (lastWordInWindow && firstWordInNext) {
        boundaries.push({
          time: (lastWordInWindow.endTime + firstWordInNext.startTime) / 2,
          source: 'topic',
          confidence: Math.max(0.1, Math.min(1, shift.confidence)),
        });
      }
    }

    return boundaries;
  } catch (err) {
    console.warn('Topic division failed:', err);
    return [];
  }
}
