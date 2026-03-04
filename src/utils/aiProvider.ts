// Abstract AI Provider Interface
// Part of Phase 3.5 — AI Infrastructure (modeled on LLM-Counsel)

export type AICapability = 'reasoning' | 'creative' | 'code' | 'image-gen' | 'vision' | 'embedding' | 'fast';

export type TaskCategory =
  | 'color-generation'
  | 'scheme-generation'
  | 'section-scheme-generation'
  | 'form-attribute-generation'
  | 'gradient-generation'
  | 'texture-generation'
  | 'texture-reference'
  | 'general-chat'
  | 'transcription'
  | 'tts'
  | 'voice-cloning'
  | 'division-suggestion';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | AIMessageContent[];
}

export interface AIMessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: 'low' | 'high' | 'auto' };
}

export interface AICompletionRequest {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
}

export interface AICompletionResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

export interface AIImageRequest {
  prompt: string;
  size?: '256x256' | '512x512' | '1024x1024';
  responseFormat?: 'url' | 'b64_json';
}

export interface AIImageResponse {
  imageUrl: string; // URL or data URL
  model: string;
  provider: string;
  latencyMs: number;
}

export interface AIEmbeddingRequest {
  input: string;
  model?: string;
}

export interface AIEmbeddingResponse {
  embedding: number[];
  model: string;
  provider: string;
}

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  organization?: string;
}

export interface ModelDefinition {
  id: string;
  provider: string;
  displayName: string;
  capabilities: AICapability[];
  maxTokens: number;
  costPer1kInput: number;   // USD per 1K input tokens
  costPer1kOutput: number;  // USD per 1K output tokens
  supportsVision: boolean;
  supportsJson: boolean;
}

/**
 * Abstract AI Provider — implemented per-provider (OpenAI, Claude, Gemini)
 */
export interface AIProvider {
  readonly name: string;
  readonly isConfigured: boolean;

  /** Check if provider has a valid API key */
  configure(config: AIProviderConfig): void;

  /** Text completion */
  complete(request: AICompletionRequest, model?: string): Promise<AICompletionResponse>;

  /** Image generation (only for providers that support it) */
  generateImage?(request: AIImageRequest, model?: string): Promise<AIImageResponse>;

  /** Embedding generation */
  embed?(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse>;

  /** List available models */
  getModels(): ModelDefinition[];
}

// ─── API Key Management (provider-specific) ─────────────────────────────────

const KEY_PREFIX = 'voxium_api_key_';

export function getProviderKey(provider: string): string | null {
  return localStorage.getItem(`${KEY_PREFIX}${provider}`) || null;
}

export function setProviderKey(provider: string, key: string): void {
  localStorage.setItem(`${KEY_PREFIX}${provider}`, key);
}

export function clearProviderKey(provider: string): void {
  localStorage.removeItem(`${KEY_PREFIX}${provider}`);
}

// Also check legacy key locations and env vars
export function getOpenAIKey(): string | null {
  return (
    localStorage.getItem(`${KEY_PREFIX}openai`) ||
    localStorage.getItem('voxium_openai_api_key') ||
    (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_OPENAI_API_KEY : null) ||
    null
  );
}

export function getClaudeKey(): string | null {
  return (
    localStorage.getItem(`${KEY_PREFIX}claude`) ||
    (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_ANTHROPIC_API_KEY : null) ||
    null
  );
}

export function getGeminiKey(): string | null {
  return (
    localStorage.getItem(`${KEY_PREFIX}gemini`) ||
    (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_GEMINI_API_KEY : null) ||
    null
  );
}
