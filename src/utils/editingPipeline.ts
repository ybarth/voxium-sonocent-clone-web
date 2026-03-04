// Editing Pipeline — Tier 1 (deterministic cleanup) + Tier 2 (LLM substantive editing)

import { aiRouter } from './aiRouter';
import type { TranscribedWord, EditingTierConfig, WordFlag } from '../types/transcription';

// ─── Tier 1: Deterministic Cleanup ──────────────────────────────────────────

const FILLER_WORDS = new Set([
  'um', 'uh', 'uhh', 'umm', 'erm', 'er', 'ah', 'ahh',
  'like', 'you know', 'basically', 'literally', 'actually',
  'i mean', 'sort of', 'kind of', 'right', 'okay so',
]);

const FALSE_START_PATTERNS = [
  /^(I|he|she|we|they)\s+(I|he|she|we|they)\b/i, // repeated pronoun
  /^(\w+)\s+\1\b/i, // repeated first word
];

export interface Tier1Result {
  words: TranscribedWord[];
  removedWordIds: string[];
  flaggedWordIds: string[];
}

/**
 * Apply Tier 1 deterministic cleanup to words.
 * Returns modified word list with filler words removed, false starts detected, and formatting applied.
 */
export function applyTier1(
  words: TranscribedWord[],
  config: EditingTierConfig['tier1'],
): Tier1Result {
  const sorted = [...words].sort((a, b) => a.startTime - b.startTime);
  const removedWordIds: string[] = [];
  const flaggedWordIds: string[] = [];
  const result: TranscribedWord[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const word = sorted[i];
    let modified = { ...word };
    let remove = false;

    // Filler word detection
    if (config.cleanFillerWords) {
      const lower = word.text.toLowerCase().replace(/[.,!?]/g, '');
      if (FILLER_WORDS.has(lower)) {
        modified = { ...modified, flags: [...modified.flags, 'filler-word' as WordFlag] };
        remove = true;
      }
    }

    // False start detection (simple heuristic)
    if (config.cleanFalseStarts && i < sorted.length - 1) {
      const next = sorted[i + 1];
      const pair = `${word.text} ${next.text}`;
      if (FALSE_START_PATTERNS.some(p => p.test(pair))) {
        modified = { ...modified, flags: [...modified.flags, 'false-start' as WordFlag] };
        flaggedWordIds.push(word.id);
        remove = true;
      }
    }

    // Basic formatting
    if (config.basicFormatting) {
      let text = modified.text;

      // Capitalize after sentence-ending punctuation
      if (i === 0 || (i > 0 && sorted[i - 1].text.match(/[.!?]$/))) {
        text = text.charAt(0).toUpperCase() + text.slice(1);
      }

      modified = { ...modified, text };
    }

    // Custom rules (simple keyword removal)
    if (config.customRules.length > 0) {
      for (const rule of config.customRules) {
        try {
          const regex = new RegExp(rule, 'i');
          if (regex.test(modified.text)) {
            remove = true;
            break;
          }
        } catch {
          // Invalid regex — skip
        }
      }
    }

    if (remove) {
      removedWordIds.push(word.id);
      modified = { ...modified, source: 'edited' as const };
    }

    if (!remove) {
      result.push(modified);
    }
  }

  return { words: result, removedWordIds, flaggedWordIds };
}

// ─── Tier 2: LLM Substantive Editing ────────────────────────────────────────

export interface Tier2Change {
  type: 'replace' | 'insert' | 'delete' | 'reorder';
  originalText: string;
  newText: string;
  reason: string;
  wordIds: string[];
}

export interface Tier2Result {
  editedText: string;
  changes: Tier2Change[];
}

/**
 * Apply Tier 2 LLM-based substantive editing.
 * Sends text + prompt to LLM, returns structured diff.
 */
export async function applyTier2(
  words: TranscribedWord[],
  config: EditingTierConfig['tier2'],
): Promise<Tier2Result> {
  const sorted = [...words].sort((a, b) => a.startTime - b.startTime);
  const originalText = sorted.map(w => w.text).join(' ');

  const prompt = `${config.promptTemplate}

Original transcription:
"${originalText}"

Respond in JSON format:
{
  "editedText": "the cleaned up text",
  "changes": [
    {
      "type": "replace",
      "originalText": "original phrase",
      "newText": "new phrase",
      "reason": "why this change was made"
    }
  ]
}`;

  const response = await aiRouter.complete(
    'general-chat',
    {
      messages: [
        {
          role: 'system',
          content: 'You are a professional transcription editor. Clean up speech-to-text output while preserving the original meaning. Always respond with valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 2000,
      responseFormat: 'json',
    },
    config.provider,
    config.model,
  );

  try {
    const parsed = JSON.parse(response.content);
    return {
      editedText: parsed.editedText ?? originalText,
      changes: (parsed.changes ?? []).map((c: any) => ({
        type: c.type ?? 'replace',
        originalText: c.originalText ?? '',
        newText: c.newText ?? '',
        reason: c.reason ?? '',
        wordIds: [], // TODO: match changes back to word IDs via text alignment
      })),
    };
  } catch {
    return { editedText: originalText, changes: [] };
  }
}
