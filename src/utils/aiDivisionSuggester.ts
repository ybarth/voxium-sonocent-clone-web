// AI Division Suggester — Generates division strategy suggestions for a section

import { v4 as uuid } from 'uuid';
import type { AIDivisionSuggestion, DivisionCriterion, Configuration } from '../types/configuration';
import type { TranscribedWord } from '../types/transcription';
import { aiRouter } from './aiRouter';
import { createConfiguration, computeBoundaries } from './divisionEngine';

interface SectionAnalysis {
  duration: number;
  avgRms: number;
  silenceRatio: number;
  wordCount: number;
  transcriptExcerpt: string;
}

function analyzeSection(
  channelData: Float32Array,
  sampleRate: number,
  startTime: number,
  endTime: number,
  words: TranscribedWord[],
): SectionAnalysis {
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.min(Math.floor(endTime * sampleRate), channelData.length);
  const duration = endTime - startTime;

  // RMS and silence analysis
  const frameSize = Math.floor(sampleRate * 0.01);
  const threshold = 0.01; // approximate -40dB
  let totalRms = 0;
  let silentFrames = 0;
  let totalFrames = 0;

  for (let i = startSample; i < endSample; i += frameSize) {
    const end = Math.min(i + frameSize, endSample);
    let sum = 0;
    for (let j = i; j < end; j++) {
      sum += channelData[j] * channelData[j];
    }
    const rms = Math.sqrt(sum / (end - i));
    totalRms += rms;
    if (rms < threshold) silentFrames++;
    totalFrames++;
  }

  const sectionWords = words.filter(w => w.startTime >= startTime && w.endTime <= endTime);
  const excerpt = sectionWords.slice(0, 30).map(w => w.text).join(' ');

  return {
    duration,
    avgRms: totalFrames > 0 ? totalRms / totalFrames : 0,
    silenceRatio: totalFrames > 0 ? silentFrames / totalFrames : 0,
    wordCount: sectionWords.length,
    transcriptExcerpt: excerpt.length > 200 ? excerpt.slice(0, 200) + '...' : excerpt,
  };
}

/**
 * Generate AI suggestions for how to divide a section into chunks.
 * Returns 3-5 division strategies.
 */
export async function suggestDivisions(
  channelData: Float32Array,
  sampleRate: number,
  startTime: number,
  endTime: number,
  words: TranscribedWord[],
): Promise<AIDivisionSuggestion[]> {
  const analysis = analyzeSection(channelData, sampleRate, startTime, endTime, words);
  const audioRange = { audioBufferId: '', startTime, endTime };

  const prompt = `You are an audio annotation expert. A user has a ${analysis.duration.toFixed(1)}s audio section with the following properties:
- Average volume: ${(analysis.avgRms * 100).toFixed(1)}%
- Silence ratio: ${(analysis.silenceRatio * 100).toFixed(1)}%
- Word count: ${analysis.wordCount}
- Transcript excerpt: "${analysis.transcriptExcerpt}"

Suggest 3-5 different division strategies for splitting this audio into chunks. Each strategy should serve a different use case.

Return a JSON array where each entry has:
- "name": short name (2-4 words)
- "description": one sentence explaining the strategy
- "reasoning": why this strategy works for this audio
- "signals": array of audio/content signals that informed this choice
- "criteria": array of division criteria, each with:
  - "type": one of "silence", "volume-fluctuation", "loudness", "max-duration", "target-duration", "cadence", "grammar", "word-level"
  - "weight": 0-1
  - "params": object with type-specific parameters

Available criterion types and their params:
- silence: { thresholdDb: number, minSilenceDurationMs: number, minChunkDurationMs: number }
- volume-fluctuation: { fluctuationThresholdDb: number, smoothingWindowMs: number, minGapMs: number }
- loudness: { loudnessThresholdLufs: number, windowMs: number, minGapMs: number }
- max-duration: { maxMs: number }
- target-duration: { targetMs: number }
- cadence: { silenceThresholdDb: number, minPauseDurationMs: number, phraseGrouping: number }
- grammar: { granularity: "sentence" | "clause" | "phrase", minPauseBetweenMs: number }
- word-level: {}

Return ONLY the JSON array.`;

  try {
    const response = await aiRouter.complete('division-suggestion', {
      messages: [
        { role: 'system', content: 'You are an audio analysis assistant. Respond only with valid JSON arrays.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 2000,
      responseFormat: 'json',
    });

    const strategies = JSON.parse(response.content) as {
      name: string;
      description: string;
      reasoning: string;
      signals: string[];
      criteria: { type: string; weight: number; params: Record<string, number | string | boolean> }[];
    }[];

    // Convert each strategy to an AIDivisionSuggestion with computed boundaries
    const suggestions: AIDivisionSuggestion[] = [];

    for (const strategy of strategies) {
      const divisionCriteria: DivisionCriterion[] = strategy.criteria.map(c => ({
        type: c.type as DivisionCriterion['type'],
        enabled: true,
        weight: c.weight,
        params: c.params,
      }));

      // Compute actual boundaries using the criteria
      const boundaries = computeBoundaries(
        divisionCriteria, channelData, sampleRate, audioRange, words,
      );

      const config = createConfiguration(strategy.name, boundaries, divisionCriteria, 'ai');

      suggestions.push({
        id: uuid(),
        name: strategy.name,
        description: strategy.description,
        configuration: config,
        reasoning: strategy.reasoning,
        signals: strategy.signals,
      });
    }

    return suggestions;
  } catch (err) {
    console.warn('AI division suggestion failed:', err);
    return [];
  }
}

/**
 * Suggest sub-divisions for specific chunks.
 */
export async function suggestChunkSubdivisions(
  chunks: { startTime: number; endTime: number }[],
  channelData: Float32Array,
  sampleRate: number,
  words: TranscribedWord[],
): Promise<AIDivisionSuggestion[]> {
  // Combine chunk ranges
  const startTime = Math.min(...chunks.map(c => c.startTime));
  const endTime = Math.max(...chunks.map(c => c.endTime));

  return suggestDivisions(channelData, sampleRate, startTime, endTime, words);
}
