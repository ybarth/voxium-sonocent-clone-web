// AI Panel — Parallel multi-model dispatch with timeout
// Adapted from LLM-Counsel's Panel pattern
// Dispatches the same prompt to 2-3 models in parallel, collects responses

import type { AICompletionRequest, AICompletionResponse } from './aiProvider';
import { aiRouter } from './aiRouter';

export interface PanelConfig {
  /** Models to dispatch to: [{provider, model}] */
  models: { provider: string; model: string }[];
  /** Timeout per model in ms */
  timeoutMs: number;
}

export interface PanelResponse {
  responses: (AICompletionResponse & { error?: string })[];
  totalLatencyMs: number;
}

// Pre-configured panels
export const PANEL_PRESETS: Record<string, PanelConfig> = {
  high_stakes: {
    models: [
      { provider: 'openai', model: 'gpt-4o' },
      { provider: 'claude', model: 'claude-sonnet-4-6' },
      { provider: 'gemini', model: 'gemini-2.0-pro' },
    ],
    timeoutMs: 30000,
  },
  balanced: {
    models: [
      { provider: 'openai', model: 'gpt-4o-mini' },
      { provider: 'claude', model: 'claude-haiku-4-5-20251001' },
    ],
    timeoutMs: 15000,
  },
  budget: {
    models: [
      { provider: 'openai', model: 'gpt-4o-mini' },
      { provider: 'gemini', model: 'gemini-2.0-flash' },
    ],
    timeoutMs: 10000,
  },
};

/**
 * Dispatch a request to multiple models in parallel.
 * Returns all responses (including errors) within the timeout window.
 */
export async function dispatchPanel(
  request: AICompletionRequest,
  config: PanelConfig,
): Promise<PanelResponse> {
  const start = Date.now();

  // Filter to only configured providers
  const availableModels = config.models.filter(m => {
    const provider = aiRouter.getProvider(m.provider);
    return provider?.isConfigured;
  });

  if (availableModels.length === 0) {
    throw new Error('No configured providers available for panel dispatch');
  }

  // Dispatch to all models with timeout
  const promises = availableModels.map(async ({ provider, model }) => {
    try {
      const result = await Promise.race([
        aiRouter.complete('general-chat', request, provider, model),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${config.timeoutMs}ms`)), config.timeoutMs)
        ),
      ]);
      return result;
    } catch (err) {
      return {
        content: '',
        model,
        provider,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Unknown error',
      } as AICompletionResponse & { error?: string };
    }
  });

  const responses = await Promise.all(promises);
  const totalLatencyMs = Date.now() - start;

  return { responses, totalLatencyMs };
}

/**
 * Get an appropriate panel config based on available providers.
 * Falls back to simpler configs when not all providers are available.
 */
export function getAvailablePanelConfig(preferredPreset?: string): PanelConfig {
  if (preferredPreset && PANEL_PRESETS[preferredPreset]) {
    const preset = PANEL_PRESETS[preferredPreset];
    const available = preset.models.filter(m => aiRouter.getProvider(m.provider)?.isConfigured);
    if (available.length >= 2) {
      return { ...preset, models: available };
    }
  }

  // Build from configured providers
  const configured = aiRouter.getConfiguredProviders();
  if (configured.length < 2) {
    throw new Error('Panel mode requires at least 2 configured AI providers');
  }

  const models = configured.slice(0, 3).map(p => {
    const defaultModel = p.getModels().find(m =>
      m.capabilities.includes('creative') || m.capabilities.includes('reasoning')
    );
    return { provider: p.name, model: defaultModel?.id ?? p.getModels()[0].id };
  });

  return { models, timeoutMs: 15000 };
}
