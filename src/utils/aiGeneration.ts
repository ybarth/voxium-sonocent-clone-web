// AI generation functions — routes through aiRouter for multi-model support
// Legacy API key management preserved for backward compatibility

import { aiRouter } from './aiRouter';
import { setProviderKey, getOpenAIKey } from './aiProvider';

const API_KEY_STORAGE = 'voxium_openai_api_key';
const RATE_LIMIT_MS = 2000;
let lastRequestTime = 0;

// ─── API key management (legacy, kept for backward compat) ──────────────────

export function getApiKey(): string | null {
  return getOpenAIKey();
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key);
  setProviderKey('openai', key);
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE);
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}

// ─── Rate limiting ───────────────────────────────────────────────────────────

function checkRateLimit(): boolean {
  const now = Date.now();
  if (now - lastRequestTime < RATE_LIMIT_MS) return false;
  lastRequestTime = now;
  return true;
}

// ─── Color generation ───────────────────────────────────────────────────────

export async function generateColorFromText(
  prompt: string,
  _apiKey?: string
): Promise<string[]> {
  if (!checkRateLimit()) throw new Error('Please wait a moment before generating again.');

  const response = await aiRouter.complete('color-generation', {
    messages: [
      {
        role: 'system',
        content: 'You are a color palette generator. Given a description, return 5 hex color codes that match the mood/theme. Return ONLY a JSON array of hex strings like ["#FF0000","#00FF00","#0000FF","#FFFF00","#FF00FF"]. No other text.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    maxTokens: 100,
  });

  try {
    const colors = JSON.parse(response.content);
    if (Array.isArray(colors) && colors.every((c: unknown) => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c as string))) {
      return colors;
    }
  } catch {
    const matches = response.content.match(/#[0-9A-Fa-f]{6}/g);
    if (matches && matches.length > 0) return matches.slice(0, 5);
  }

  throw new Error('Could not parse color response from AI');
}

// ─── Scheme generation ──────────────────────────────────────────────────────

export async function generateSchemeFromText(
  prompt: string,
  _apiKey?: string
): Promise<{ labels: string[]; colors: string[]; shapes: string[] }> {
  if (!checkRateLimit()) throw new Error('Please wait a moment before generating again.');

  const response = await aiRouter.complete('scheme-generation', {
    messages: [
      {
        role: 'system',
        content: `You are an annotation scheme designer. Given a use case description, generate a scheme with 5-9 form categories.
Each form has a label, color (hex), and optional shape (one of: default, sharp, rounded, tapered, scalloped, notched, wave, chevron).
Return ONLY valid JSON in this exact format:
{"labels":["Label1","Label2"],"colors":["#FF0000","#00FF00"],"shapes":["default","sharp"]}
No other text. Labels should be concise (1-3 words). Colors should be visually distinct and appropriate for the theme.`,
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    maxTokens: 300,
  });

  try {
    const parsed = JSON.parse(response.content);
    if (parsed.labels && parsed.colors && Array.isArray(parsed.labels)) {
      return {
        labels: parsed.labels,
        colors: parsed.colors,
        shapes: parsed.shapes ?? parsed.labels.map(() => 'default'),
      };
    }
  } catch { /* fallback */ }

  throw new Error('Could not parse scheme response from AI');
}

// ─── Section scheme generation ──────────────────────────────────────────────

export async function generateSectionSchemeFromText(
  prompt: string,
  _apiKey?: string
): Promise<{ labels: string[]; colors: string[] }> {
  if (!checkRateLimit()) throw new Error('Please wait a moment before generating again.');

  const response = await aiRouter.complete('section-scheme-generation', {
    messages: [
      {
        role: 'system',
        content: `You are a section annotation scheme designer. Given a use case description, generate a section color scheme with 3-6 high-saturation section categories.
Each section has a label and color (hex). Colors must be high-saturation and visually distinct for use as section background indicators.
Return ONLY valid JSON in this exact format:
{"labels":["Label1","Label2"],"colors":["#2563EB","#DC2626"]}
No other text. Labels should be concise (1-3 words). Colors should have high saturation (S>70%) and work as UI accent colors.`,
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    maxTokens: 200,
  });

  try {
    const parsed = JSON.parse(response.content);
    if (parsed.labels && parsed.colors && Array.isArray(parsed.labels)) {
      return { labels: parsed.labels, colors: parsed.colors };
    }
  } catch { /* fallback */ }

  throw new Error('Could not parse section scheme response from AI');
}

// ─── Form attribute suggestion ──────────────────────────────────────────────

export async function generateFormAttributesFromText(
  prompt: string,
  currentLabel?: string,
  _apiKey?: string
): Promise<{ label?: string; color?: string; shape?: string; reasoning?: string }> {
  if (!checkRateLimit()) throw new Error('Please wait a moment before generating again.');

  const context = currentLabel ? `The form is currently labeled "${currentLabel}". ` : '';

  const response = await aiRouter.complete('form-attribute-generation', {
    messages: [
      {
        role: 'system',
        content: `You are a form attribute designer for an audio annotation tool. Given a description, suggest attributes for an annotation form.
Shape meanings: sharp=urgent/important, rounded=soft/gentle, tapered=building/growing, scalloped=decorative/special, notched=technical/precise, wave=flowing/musical, chevron=directional/action, default=neutral.
Available shapes: default, sharp, rounded, tapered, scalloped, notched, wave, chevron.
${context}Return ONLY valid JSON: {"label":"Short Label","color":"#hexcolor","shape":"shapeid","reasoning":"Brief explanation of choices"}
No other text. Label should be 1-3 words. Color should be semantically appropriate.`,
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    maxTokens: 150,
  });

  try {
    return JSON.parse(response.content);
  } catch { /* fallback */ }

  throw new Error('Could not parse form attribute response from AI');
}

// ─── Gradient generation ────────────────────────────────────────────────────

export async function generateGradientFromText(
  prompt: string,
  _apiKey?: string
): Promise<{ stops: { color: string; position: number }[]; angle: number }> {
  if (!checkRateLimit()) throw new Error('Please wait a moment before generating again.');

  const response = await aiRouter.complete('gradient-generation', {
    messages: [
      {
        role: 'system',
        content: `You are a gradient designer. Given a description, generate a CSS gradient.
Return ONLY valid JSON: {"stops":[{"color":"#FF0000","position":0},{"color":"#0000FF","position":1}],"angle":90}
Position is 0-1, angle is degrees. 2-5 stops. No other text.`,
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    maxTokens: 200,
  });

  try {
    const parsed = JSON.parse(response.content);
    if (parsed.stops && Array.isArray(parsed.stops)) {
      return { stops: parsed.stops, angle: parsed.angle ?? 90 };
    }
  } catch { /* fallback */ }

  throw new Error('Could not parse gradient response from AI');
}

// ─── Texture generation via image model ─────────────────────────────────────

export async function generateTextureFromText(
  prompt: string,
  _apiKey?: string
): Promise<string> {
  if (!checkRateLimit()) throw new Error('Please wait a moment before generating again.');

  const response = await aiRouter.generateImage('texture-generation', {
    prompt: `Create a seamless tileable texture pattern: ${prompt}. The pattern should be subtle, low-contrast, and tile perfectly in all directions. PNG format, 256x256 pixels.`,
    size: '1024x1024',
    responseFormat: 'b64_json',
  });

  return response.imageUrl;
}

// ─── Texture generation from reference image ─────────────────────────────────

export async function generateTextureFromReference(
  prompt: string,
  referenceImageDataUrl: string,
  _apiKey?: string
): Promise<string> {
  if (!checkRateLimit()) throw new Error('Please wait a moment before generating again.');

  // Step 1: Analyze reference image with vision model
  const analysis = await aiRouter.complete('texture-reference', {
    messages: [
      {
        role: 'system',
        content: 'You are a visual texture analyst. Describe the visual properties of this texture image in detail: colors, patterns, spacing, contrast, material appearance. Be concise (2-3 sentences).',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this texture image:' },
          { type: 'image_url', image_url: { url: referenceImageDataUrl, detail: 'low' } },
        ],
      },
    ],
    maxTokens: 200,
  });

  // Reset rate limit for the image generation
  lastRequestTime = 0;

  // Step 2: Generate new texture
  const enrichedPrompt = `Create a seamless tileable texture pattern. User request: ${prompt}. Reference texture style: ${analysis.content}. The pattern should be subtle, low-contrast, and tile perfectly in all directions. PNG format, 256x256 pixels.`;

  const imageResponse = await aiRouter.generateImage('texture-generation', {
    prompt: enrichedPrompt,
    size: '1024x1024',
    responseFormat: 'b64_json',
  });

  return imageResponse.imageUrl;
}
