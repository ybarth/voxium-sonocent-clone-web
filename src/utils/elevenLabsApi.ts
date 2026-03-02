// ElevenLabs API integration for sound effect generation
// Requires user to configure API key in settings (stored in localStorage)

const API_KEY_STORAGE = 'voxium_elevenlabs_api_key';
const RATE_LIMIT_MS = 2000; // min time between requests
let lastRequestTime = 0;

// ─── API key management ──────────────────────────────────────────────────────

export function getElevenLabsApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE) || import.meta.env.VITE_ELEVEN_LABS_API_KEY || null;
}

export function setElevenLabsApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key);
}

export function clearElevenLabsApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE);
}

export function hasElevenLabsApiKey(): boolean {
  return !!getElevenLabsApiKey();
}

// ─── Rate limiting ───────────────────────────────────────────────────────────

function checkRateLimit(): boolean {
  const now = Date.now();
  if (now - lastRequestTime < RATE_LIMIT_MS) return false;
  lastRequestTime = now;
  return true;
}

// ─── Sound effect generation ─────────────────────────────────────────────────

export async function generateSoundEffect(
  prompt: string,
  durationSeconds: number,
  apiKey?: string
): Promise<string> {
  const key = apiKey ?? getElevenLabsApiKey();
  if (!key) throw new Error('ElevenLabs API key not configured. Set it in Settings > AI Configuration.');
  if (!checkRateLimit()) throw new Error('Please wait a moment before generating again.');

  const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': key,
    },
    body: JSON.stringify({
      text: prompt,
      duration_seconds: durationSeconds,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} — ${err}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:audio/mpeg;base64,${base64}`;
}
