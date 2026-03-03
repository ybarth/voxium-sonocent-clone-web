// OpenAI API integration for AI-generated colors and textures
// Requires user to configure API key in settings (stored in localStorage)

const API_KEY_STORAGE = 'voxium_openai_api_key';
const RATE_LIMIT_MS = 2000; // min time between requests
let lastRequestTime = 0;

// ─── API key management ──────────────────────────────────────────────────────

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE) || import.meta.env.VITE_OPENAI_API_KEY || null;
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key);
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

// ─── Color generation via GPT ────────────────────────────────────────────────

export async function generateColorFromText(
  prompt: string,
  apiKey?: string
): Promise<string[]> {
  const key = apiKey ?? getApiKey();
  if (!key) throw new Error('OpenAI API key not configured. Set it in Settings > AI Configuration.');
  if (!checkRateLimit()) throw new Error('Please wait a moment before generating again.');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a color palette generator. Given a description, return 5 hex color codes that match the mood/theme. Return ONLY a JSON array of hex strings like ["#FF0000","#00FF00","#0000FF","#FFFF00","#FF00FF"]. No other text.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 100,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() ?? '';

  try {
    const colors = JSON.parse(content);
    if (Array.isArray(colors) && colors.every((c: unknown) => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c as string))) {
      return colors;
    }
  } catch {
    // Try to extract hex colors from freeform text
    const matches = content.match(/#[0-9A-Fa-f]{6}/g);
    if (matches && matches.length > 0) return matches.slice(0, 5);
  }

  throw new Error('Could not parse color response from AI');
}

// ─── Scheme generation via GPT ───────────────────────────────────────────────

export async function generateSchemeFromText(
  prompt: string,
  apiKey?: string
): Promise<{ labels: string[]; colors: string[]; shapes: string[] }> {
  const key = apiKey ?? getApiKey();
  if (!key) throw new Error('OpenAI API key not configured. Set it in Settings > AI Configuration.');
  if (!checkRateLimit()) throw new Error('Please wait a moment before generating again.');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
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
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() ?? '';

  try {
    const parsed = JSON.parse(content);
    if (parsed.labels && parsed.colors && Array.isArray(parsed.labels)) {
      return {
        labels: parsed.labels,
        colors: parsed.colors,
        shapes: parsed.shapes ?? parsed.labels.map(() => 'default'),
      };
    }
  } catch {
    // fallback: ignore
  }

  throw new Error('Could not parse scheme response from AI');
}

// ─── Section scheme generation via GPT ───────────────────────────────────────

export async function generateSectionSchemeFromText(
  prompt: string,
  apiKey?: string
): Promise<{ labels: string[]; colors: string[] }> {
  const key = apiKey ?? getApiKey();
  if (!key) throw new Error('OpenAI API key not configured. Set it in Settings > AI Configuration.');
  if (!checkRateLimit()) throw new Error('Please wait a moment before generating again.');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
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
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() ?? '';

  try {
    const parsed = JSON.parse(content);
    if (parsed.labels && parsed.colors && Array.isArray(parsed.labels)) {
      return {
        labels: parsed.labels,
        colors: parsed.colors,
      };
    }
  } catch {
    // fallback: ignore
  }

  throw new Error('Could not parse section scheme response from AI');
}

// ─── Form attribute suggestion via GPT ───────────────────────────────────────

export async function generateFormAttributesFromText(
  prompt: string,
  currentLabel?: string,
  apiKey?: string
): Promise<{ label?: string; color?: string; shape?: string; reasoning?: string }> {
  const key = apiKey ?? getApiKey();
  if (!key) throw new Error('OpenAI API key not configured. Set it in Settings > AI Configuration.');
  if (!checkRateLimit()) throw new Error('Please wait a moment before generating again.');

  const context = currentLabel ? `The form is currently labeled "${currentLabel}". ` : '';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
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
      max_tokens: 150,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() ?? '';

  try {
    const parsed = JSON.parse(content);
    return {
      label: parsed.label,
      color: parsed.color,
      shape: parsed.shape,
      reasoning: parsed.reasoning,
    };
  } catch {
    // fallback: ignore
  }

  throw new Error('Could not parse form attribute response from AI');
}

// ─── Gradient generation via GPT ────────────────────────────────────────────

export async function generateGradientFromText(
  prompt: string,
  apiKey?: string
): Promise<{ stops: { color: string; position: number }[]; angle: number }> {
  const key = apiKey ?? getApiKey();
  if (!key) throw new Error('OpenAI API key not configured. Set it in Settings > AI Configuration.');
  if (!checkRateLimit()) throw new Error('Please wait a moment before generating again.');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
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
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() ?? '';

  try {
    const parsed = JSON.parse(content);
    if (parsed.stops && Array.isArray(parsed.stops)) {
      return { stops: parsed.stops, angle: parsed.angle ?? 90 };
    }
  } catch {
    // fallback: ignore
  }

  throw new Error('Could not parse gradient response from AI');
}

// ─── Texture generation via DALL-E ───────────────────────────────────────────

export async function generateTextureFromText(
  prompt: string,
  apiKey?: string
): Promise<string> {
  const key = apiKey ?? getApiKey();
  if (!key) throw new Error('OpenAI API key not configured. Set it in Settings > AI Configuration.');
  if (!checkRateLimit()) throw new Error('Please wait a moment before generating again.');

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: `Create a seamless tileable texture pattern: ${prompt}. The pattern should be subtle, low-contrast, and tile perfectly in all directions. PNG format, 256x256 pixels.`,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DALL-E API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data in DALL-E response');

  return `data:image/png;base64,${b64}`;
}

// ─── Texture generation from reference image ─────────────────────────────────

export async function generateTextureFromReference(
  prompt: string,
  referenceImageDataUrl: string,
  apiKey?: string
): Promise<string> {
  const key = apiKey ?? getApiKey();
  if (!key) throw new Error('OpenAI API key not configured. Set it in Settings > AI Configuration.');
  if (!checkRateLimit()) throw new Error('Please wait a moment before generating again.');

  // Step 1: Analyze reference image with GPT-4o-mini vision
  const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a visual texture analyst. Describe the visual properties of this texture image in detail: colors, patterns, spacing, contrast, material appearance. Be concise (2-3 sentences). Focus on properties that would help recreate or iterate on this texture.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this texture image:' },
            { type: 'image_url', image_url: { url: referenceImageDataUrl, detail: 'low' } },
          ],
        },
      ],
      max_tokens: 200,
    }),
  });

  if (!analysisResponse.ok) {
    const err = await analysisResponse.text();
    throw new Error(`Vision API error: ${analysisResponse.status} — ${err}`);
  }

  const analysisData = await analysisResponse.json();
  const description = analysisData.choices?.[0]?.message?.content?.trim() ?? '';

  // Step 2: Generate new texture incorporating the reference analysis
  const enrichedPrompt = `Create a seamless tileable texture pattern. User request: ${prompt}. Reference texture style: ${description}. The pattern should be subtle, low-contrast, and tile perfectly in all directions. PNG format, 256x256 pixels.`;

  // Reset rate limit since we just made a request
  lastRequestTime = 0;

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: enrichedPrompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DALL-E API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data in DALL-E response');

  return `data:image/png;base64,${b64}`;
}
