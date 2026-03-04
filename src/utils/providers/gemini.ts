// Google Gemini Provider Implementation
import type {
  AIProvider, AIProviderConfig, AICompletionRequest, AICompletionResponse,
  AIEmbeddingRequest, AIEmbeddingResponse, ModelDefinition, AIMessage,
} from '../aiProvider';
import { getGeminiKey } from '../aiProvider';

const MODELS: ModelDefinition[] = [
  {
    id: 'gemini-2.0-flash', provider: 'gemini', displayName: 'Gemini 2.0 Flash',
    capabilities: ['reasoning', 'creative', 'code', 'vision', 'fast'],
    maxTokens: 8192, costPer1kInput: 0.0001, costPer1kOutput: 0.0004,
    supportsVision: true, supportsJson: true,
  },
  {
    id: 'gemini-2.0-pro', provider: 'gemini', displayName: 'Gemini 2.0 Pro',
    capabilities: ['reasoning', 'creative', 'code', 'vision'],
    maxTokens: 8192, costPer1kInput: 0.00125, costPer1kOutput: 0.005,
    supportsVision: true, supportsJson: true,
  },
  {
    id: 'text-embedding-004', provider: 'gemini', displayName: 'Gemini Embedding',
    capabilities: ['embedding'],
    maxTokens: 2048, costPer1kInput: 0.00001, costPer1kOutput: 0,
    supportsVision: false, supportsJson: false,
  },
];

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private apiKey: string | null = null;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private defaultModel = 'gemini-2.0-flash';

  get isConfigured(): boolean {
    return !!(this.apiKey || getGeminiKey());
  }

  private get key(): string {
    const k = this.apiKey || getGeminiKey();
    if (!k) throw new Error('Google AI API key not configured. Set it in Settings > AI Configuration.');
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

    // Convert to Gemini format
    const systemInstruction = request.messages.find(m => m.role === 'system');
    const contents = request.messages
      .filter(m => m.role !== 'system')
      .map(m => this.convertMessage(m));

    const response = await fetch(
      `${this.baseUrl}/models/${useModel}:generateContent?key=${this.key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          ...(systemInstruction ? {
            systemInstruction: {
              parts: [{ text: typeof systemInstruction.content === 'string' ? systemInstruction.content : '' }],
            },
          } : {}),
          generationConfig: {
            temperature: request.temperature ?? 0.7,
            maxOutputTokens: request.maxTokens ?? 1000,
            ...(request.responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - start;

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const usage = data.usageMetadata;

    return {
      content,
      model: useModel,
      provider: 'gemini',
      usage: usage ? {
        promptTokens: usage.promptTokenCount ?? 0,
        completionTokens: usage.candidatesTokenCount ?? 0,
        totalTokens: usage.totalTokenCount ?? 0,
      } : undefined,
      latencyMs,
    };
  }

  private convertMessage(msg: AIMessage): { role: string; parts: unknown[] } {
    const role = msg.role === 'assistant' ? 'model' : 'user';

    if (typeof msg.content === 'string') {
      return { role, parts: [{ text: msg.content }] };
    }

    const parts = msg.content.map(part => {
      if (part.type === 'text') {
        return { text: part.text ?? '' };
      }
      if (part.type === 'image_url' && part.image_url) {
        const url = part.image_url.url;
        if (url.startsWith('data:')) {
          const match = url.match(/^data:(image\/\w+);base64,(.+)$/);
          if (match) {
            return { inlineData: { mimeType: match[1], data: match[2] } };
          }
        }
        return { text: `[Image: ${url}]` };
      }
      return { text: '' };
    });
    return { role, parts };
  }

  async embed(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    const useModel = request.model ?? 'text-embedding-004';

    const response = await fetch(
      `${this.baseUrl}/models/${useModel}:embedContent?key=${this.key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${useModel}`,
          content: { parts: [{ text: request.input }] },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini Embedding error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    return {
      embedding: data.embedding?.values ?? [],
      model: useModel,
      provider: 'gemini',
    };
  }

  getModels(): ModelDefinition[] {
    return MODELS;
  }
}
