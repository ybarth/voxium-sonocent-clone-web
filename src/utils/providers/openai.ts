// OpenAI Provider Implementation
import type {
  AIProvider, AIProviderConfig, AICompletionRequest, AICompletionResponse,
  AIImageRequest, AIImageResponse, AIEmbeddingRequest, AIEmbeddingResponse,
  ModelDefinition,
} from '../aiProvider';
import { getOpenAIKey } from '../aiProvider';

const MODELS: ModelDefinition[] = [
  {
    id: 'gpt-4o-mini', provider: 'openai', displayName: 'GPT-4o Mini',
    capabilities: ['reasoning', 'creative', 'code', 'vision', 'fast'],
    maxTokens: 16384, costPer1kInput: 0.00015, costPer1kOutput: 0.0006,
    supportsVision: true, supportsJson: true,
  },
  {
    id: 'gpt-4o', provider: 'openai', displayName: 'GPT-4o',
    capabilities: ['reasoning', 'creative', 'code', 'vision'],
    maxTokens: 4096, costPer1kInput: 0.005, costPer1kOutput: 0.015,
    supportsVision: true, supportsJson: true,
  },
  {
    id: 'dall-e-3', provider: 'openai', displayName: 'DALL-E 3',
    capabilities: ['image-gen'],
    maxTokens: 0, costPer1kInput: 0, costPer1kOutput: 0,
    supportsVision: false, supportsJson: false,
  },
  {
    id: 'text-embedding-3-small', provider: 'openai', displayName: 'Embedding 3 Small',
    capabilities: ['embedding'],
    maxTokens: 8191, costPer1kInput: 0.00002, costPer1kOutput: 0,
    supportsVision: false, supportsJson: false,
  },
];

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private apiKey: string | null = null;
  private baseUrl = 'https://api.openai.com/v1';
  private defaultModel = 'gpt-4o-mini';

  get isConfigured(): boolean {
    return !!(this.apiKey || getOpenAIKey());
  }

  private get key(): string {
    const k = this.apiKey || getOpenAIKey();
    if (!k) throw new Error('OpenAI API key not configured. Set it in Settings > AI Configuration.');
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

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.key}`,
      },
      body: JSON.stringify({
        model: useModel,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 1000,
        ...(request.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - start;

    return {
      content: data.choices?.[0]?.message?.content?.trim() ?? '',
      model: useModel,
      provider: 'openai',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      latencyMs,
    };
  }

  async generateImage(request: AIImageRequest, model?: string): Promise<AIImageResponse> {
    const start = Date.now();
    const useModel = model ?? 'dall-e-3';

    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.key}`,
      },
      body: JSON.stringify({
        model: useModel,
        prompt: request.prompt,
        n: 1,
        size: request.size ?? '1024x1024',
        response_format: request.responseFormat ?? 'b64_json',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`DALL-E API error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - start;

    const b64 = data.data?.[0]?.b64_json;
    const url = data.data?.[0]?.url;
    const imageUrl = b64 ? `data:image/png;base64,${b64}` : url;
    if (!imageUrl) throw new Error('No image data in response');

    return { imageUrl, model: useModel, provider: 'openai', latencyMs };
  }

  async embed(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    const useModel = request.model ?? 'text-embedding-3-small';

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.key}`,
      },
      body: JSON.stringify({
        model: useModel,
        input: request.input,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI Embedding error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    return {
      embedding: data.data?.[0]?.embedding ?? [],
      model: useModel,
      provider: 'openai',
    };
  }

  getModels(): ModelDefinition[] {
    return MODELS;
  }
}
