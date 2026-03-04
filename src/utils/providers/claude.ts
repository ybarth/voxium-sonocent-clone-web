// Claude (Anthropic) Provider Implementation
import type {
  AIProvider, AIProviderConfig, AICompletionRequest, AICompletionResponse,
  ModelDefinition, AIMessage,
} from '../aiProvider';
import { getClaudeKey } from '../aiProvider';

const MODELS: ModelDefinition[] = [
  {
    id: 'claude-sonnet-4-6', provider: 'claude', displayName: 'Claude Sonnet 4.6',
    capabilities: ['reasoning', 'creative', 'code', 'vision'],
    maxTokens: 8192, costPer1kInput: 0.003, costPer1kOutput: 0.015,
    supportsVision: true, supportsJson: true,
  },
  {
    id: 'claude-haiku-4-5-20251001', provider: 'claude', displayName: 'Claude Haiku 4.5',
    capabilities: ['reasoning', 'creative', 'code', 'vision', 'fast'],
    maxTokens: 8192, costPer1kInput: 0.0008, costPer1kOutput: 0.004,
    supportsVision: true, supportsJson: true,
  },
  {
    id: 'claude-opus-4-6', provider: 'claude', displayName: 'Claude Opus 4.6',
    capabilities: ['reasoning', 'creative', 'code', 'vision'],
    maxTokens: 8192, costPer1kInput: 0.015, costPer1kOutput: 0.075,
    supportsVision: true, supportsJson: true,
  },
];

export class ClaudeProvider implements AIProvider {
  readonly name = 'claude';
  private apiKey: string | null = null;
  private baseUrl = 'https://api.anthropic.com/v1';
  private defaultModel = 'claude-haiku-4-5-20251001';

  get isConfigured(): boolean {
    return !!(this.apiKey || getClaudeKey());
  }

  private get key(): string {
    const k = this.apiKey || getClaudeKey();
    if (!k) throw new Error('Anthropic API key not configured. Set it in Settings > AI Configuration.');
    return k;
  }

  configure(config: AIProviderConfig): void {
    this.apiKey = config.apiKey;
    if (config.baseUrl) this.baseUrl = config.baseUrl;
    if (config.defaultModel) this.defaultModel = config.defaultModel;
  }

  async complete(request: AICompletionRequest, model?: string): Promise<AICompletionResponse> {
    const start = Date.now();
    const useModel = model ?? this.defaultModel;

    // Convert OpenAI-style messages to Anthropic format
    const systemMessage = request.messages.find(m => m.role === 'system');
    const conversationMessages = request.messages
      .filter(m => m.role !== 'system')
      .map(m => this.convertMessage(m));

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: useModel,
        max_tokens: request.maxTokens ?? 1000,
        ...(systemMessage ? { system: typeof systemMessage.content === 'string' ? systemMessage.content : '' } : {}),
        messages: conversationMessages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - start;

    const content = data.content?.[0]?.text ?? '';

    return {
      content,
      model: useModel,
      provider: 'claude',
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      } : undefined,
      latencyMs,
    };
  }

  private convertMessage(msg: AIMessage): { role: string; content: unknown } {
    if (typeof msg.content === 'string') {
      return { role: msg.role, content: msg.content };
    }
    // Multi-part content (text + images)
    const parts = msg.content.map(part => {
      if (part.type === 'text') {
        return { type: 'text', text: part.text ?? '' };
      }
      if (part.type === 'image_url' && part.image_url) {
        // Convert data URL to Anthropic format
        const url = part.image_url.url;
        if (url.startsWith('data:')) {
          const match = url.match(/^data:(image\/\w+);base64,(.+)$/);
          if (match) {
            return {
              type: 'image',
              source: { type: 'base64', media_type: match[1], data: match[2] },
            };
          }
        }
        return { type: 'image', source: { type: 'url', url } };
      }
      return { type: 'text', text: '' };
    });
    return { role: msg.role, content: parts };
  }

  getModels(): ModelDefinition[] {
    return MODELS;
  }
}
