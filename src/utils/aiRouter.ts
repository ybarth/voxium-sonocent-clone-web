// AI Router — Task classification + model selection
// Adapted from LLM-Counsel's Router pattern
// Routes generation tasks to the appropriate model based on task category,
// model capabilities, and user preferences.

import type {
  AIProvider, AICompletionRequest, AICompletionResponse,
  AIImageRequest, AIImageResponse, AICapability, TaskCategory, ModelDefinition,
} from './aiProvider';
import { OpenAIProvider } from './providers/openai';
import { ClaudeProvider } from './providers/claude';
import { GeminiProvider } from './providers/gemini';

// ─── Routing Configuration ──────────────────────────────────────────────────

export interface RoutingRule {
  taskCategory: TaskCategory;
  primaryProvider: string;
  primaryModel: string;
  fallbackProvider?: string;
  fallbackModel?: string;
  requiredCapabilities: AICapability[];
  /** If true, prefer the cheapest capable model */
  budgetMode?: boolean;
}

export interface RouterConfig {
  rules: RoutingRule[];
  preferBudget: boolean;
  /** Enable panel mode for high-stakes tasks */
  panelEnabled: boolean;
  /** Panel trigger threshold — routes to panel when confidence < threshold */
  panelConfidenceThreshold: number;
}

// ─── Default Routing Rules ──────────────────────────────────────────────────

const DEFAULT_RULES: RoutingRule[] = [
  {
    taskCategory: 'color-generation',
    primaryProvider: 'openai', primaryModel: 'gpt-4o-mini',
    fallbackProvider: 'claude', fallbackModel: 'claude-haiku-4-5-20251001',
    requiredCapabilities: ['creative'],
  },
  {
    taskCategory: 'scheme-generation',
    primaryProvider: 'openai', primaryModel: 'gpt-4o-mini',
    fallbackProvider: 'claude', fallbackModel: 'claude-haiku-4-5-20251001',
    requiredCapabilities: ['creative', 'reasoning'],
  },
  {
    taskCategory: 'section-scheme-generation',
    primaryProvider: 'openai', primaryModel: 'gpt-4o-mini',
    fallbackProvider: 'claude', fallbackModel: 'claude-haiku-4-5-20251001',
    requiredCapabilities: ['creative'],
  },
  {
    taskCategory: 'form-attribute-generation',
    primaryProvider: 'openai', primaryModel: 'gpt-4o-mini',
    fallbackProvider: 'claude', fallbackModel: 'claude-haiku-4-5-20251001',
    requiredCapabilities: ['creative', 'reasoning'],
  },
  {
    taskCategory: 'gradient-generation',
    primaryProvider: 'openai', primaryModel: 'gpt-4o-mini',
    fallbackProvider: 'gemini', fallbackModel: 'gemini-2.0-flash',
    requiredCapabilities: ['creative'],
  },
  {
    taskCategory: 'texture-generation',
    primaryProvider: 'openai', primaryModel: 'dall-e-3',
    requiredCapabilities: ['image-gen'],
  },
  {
    taskCategory: 'texture-reference',
    primaryProvider: 'openai', primaryModel: 'gpt-4o-mini',
    requiredCapabilities: ['vision'],
  },
  {
    taskCategory: 'general-chat',
    primaryProvider: 'claude', primaryModel: 'claude-haiku-4-5-20251001',
    fallbackProvider: 'openai', fallbackModel: 'gpt-4o-mini',
    requiredCapabilities: ['reasoning'],
  },
];

// ─── Router Singleton ───────────────────────────────────────────────────────

class AIRouter {
  private providers = new Map<string, AIProvider>();
  private config: RouterConfig;

  constructor() {
    // Initialize providers
    this.providers.set('openai', new OpenAIProvider());
    this.providers.set('claude', new ClaudeProvider());
    this.providers.set('gemini', new GeminiProvider());

    this.config = {
      rules: [...DEFAULT_RULES],
      preferBudget: false,
      panelEnabled: false,
      panelConfidenceThreshold: 0.7,
    };
  }

  /** Get all registered providers */
  getProviders(): Map<string, AIProvider> {
    return this.providers;
  }

  /** Get a specific provider */
  getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  /** Get all available models across providers */
  getAllModels(): ModelDefinition[] {
    const models: ModelDefinition[] = [];
    for (const provider of this.providers.values()) {
      models.push(...provider.getModels());
    }
    return models;
  }

  /** Get configured providers (those with API keys) */
  getConfiguredProviders(): AIProvider[] {
    return Array.from(this.providers.values()).filter(p => p.isConfigured);
  }

  /** Update routing configuration */
  updateConfig(updates: Partial<RouterConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /** Get current config */
  getConfig(): RouterConfig {
    return this.config;
  }

  /** Update a specific routing rule */
  updateRule(taskCategory: TaskCategory, updates: Partial<RoutingRule>): void {
    const idx = this.config.rules.findIndex(r => r.taskCategory === taskCategory);
    if (idx >= 0) {
      this.config.rules[idx] = { ...this.config.rules[idx], ...updates };
    }
  }

  /**
   * Route a text completion to the appropriate model.
   * Tries primary model first, falls back if primary fails.
   */
  async complete(
    taskCategory: TaskCategory,
    request: AICompletionRequest,
    overrideProvider?: string,
    overrideModel?: string,
  ): Promise<AICompletionResponse> {
    // If overrides specified, use them directly
    if (overrideProvider && overrideModel) {
      const provider = this.providers.get(overrideProvider);
      if (!provider?.isConfigured) {
        throw new Error(`Provider ${overrideProvider} is not configured`);
      }
      return provider.complete(request, overrideModel);
    }

    const rule = this.config.rules.find(r => r.taskCategory === taskCategory);
    if (!rule) {
      // Default fallback: try any configured provider
      return this.fallbackComplete(request);
    }

    // Budget mode: find cheapest capable model
    if (this.config.preferBudget || rule.budgetMode) {
      return this.budgetComplete(request, rule.requiredCapabilities);
    }

    // Try primary
    const primary = this.providers.get(rule.primaryProvider);
    if (primary?.isConfigured) {
      try {
        return await primary.complete(request, rule.primaryModel);
      } catch (err) {
        console.warn(`Primary provider ${rule.primaryProvider} failed:`, err);
      }
    }

    // Try fallback
    if (rule.fallbackProvider && rule.fallbackModel) {
      const fallback = this.providers.get(rule.fallbackProvider);
      if (fallback?.isConfigured) {
        return fallback.complete(request, rule.fallbackModel);
      }
    }

    // Last resort: any configured provider
    return this.fallbackComplete(request);
  }

  /**
   * Route an image generation request.
   */
  async generateImage(
    taskCategory: TaskCategory,
    request: AIImageRequest,
  ): Promise<AIImageResponse> {
    const rule = this.config.rules.find(r => r.taskCategory === taskCategory);

    if (rule) {
      const provider = this.providers.get(rule.primaryProvider);
      if (provider?.isConfigured && provider.generateImage) {
        return provider.generateImage(request, rule.primaryModel);
      }
    }

    // Fallback: find any provider with image-gen capability
    for (const provider of this.providers.values()) {
      if (provider.isConfigured && provider.generateImage) {
        const imageModel = provider.getModels().find(m => m.capabilities.includes('image-gen'));
        if (imageModel) {
          return provider.generateImage(request, imageModel.id);
        }
      }
    }

    throw new Error('No configured provider supports image generation');
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private async fallbackComplete(request: AICompletionRequest): Promise<AICompletionResponse> {
    for (const provider of this.providers.values()) {
      if (provider.isConfigured) {
        const models = provider.getModels().filter(m =>
          m.capabilities.some(c => ['reasoning', 'creative'].includes(c))
        );
        if (models.length > 0) {
          return provider.complete(request, models[0].id);
        }
      }
    }
    throw new Error('No AI provider is configured. Add an API key in Settings > AI Configuration.');
  }

  private async budgetComplete(
    request: AICompletionRequest,
    requiredCapabilities: AICapability[],
  ): Promise<AICompletionResponse> {
    // Find cheapest model across all configured providers
    const candidates: { provider: AIProvider; model: ModelDefinition }[] = [];
    for (const provider of this.providers.values()) {
      if (!provider.isConfigured) continue;
      for (const model of provider.getModels()) {
        if (requiredCapabilities.every(cap => model.capabilities.includes(cap))) {
          candidates.push({ provider, model });
        }
      }
    }

    if (candidates.length === 0) {
      return this.fallbackComplete(request);
    }

    // Sort by total cost (input + output)
    candidates.sort((a, b) =>
      (a.model.costPer1kInput + a.model.costPer1kOutput) -
      (b.model.costPer1kInput + b.model.costPer1kOutput)
    );

    const cheapest = candidates[0];
    return cheapest.provider.complete(request, cheapest.model.id);
  }
}

// ─── Singleton Export ───────────────────────────────────────────────────────

export const aiRouter = new AIRouter();
