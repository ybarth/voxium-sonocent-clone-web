// Asset validation utilities — file type checks, size limits, metadata extraction

const ACCEPTED_IMAGE_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif',
];

const ACCEPTED_AUDIO_TYPES = [
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
  'audio/x-wav', // Some browsers report wav as x-wav
];

const MAX_TEXTURE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_SOUND_BYTES = 3 * 1024 * 1024;   // 3 MB
const MAX_LIBRARY_BYTES = 8 * 1024 * 1024;  // 8 MB total quota

export const IMAGE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(',');
export const AUDIO_ACCEPT = ACCEPTED_AUDIO_TYPES.map(t => {
  // Map MIME types to accept string
  if (t === 'audio/mpeg') return 'audio/mpeg,.mp3';
  if (t === 'audio/wav' || t === 'audio/x-wav') return 'audio/wav,.wav';
  if (t === 'audio/ogg') return 'audio/ogg,.ogg';
  if (t === 'audio/webm') return 'audio/webm';
  return t;
}).join(',');

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return `Unsupported image type: ${file.type}. Accepted: PNG, JPEG, WebP, SVG, GIF.`;
  }
  if (file.size > MAX_TEXTURE_BYTES) {
    return `Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max: 2 MB.`;
  }
  return null;
}

export function validateAudioFile(file: File): string | null {
  if (!ACCEPTED_AUDIO_TYPES.includes(file.type)) {
    return `Unsupported audio type: ${file.type}. Accepted: MP3, WAV, OGG, WebM.`;
  }
  if (file.size > MAX_SOUND_BYTES) {
    return `Audio too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max: 3 MB.`;
  }
  return null;
}

export function checkLibraryQuota(currentBytes: number, newBytes: number): string | null {
  if (currentBytes + newBytes > MAX_LIBRARY_BYTES) {
    const remaining = Math.max(0, MAX_LIBRARY_BYTES - currentBytes);
    return `Library quota exceeded. ${(remaining / 1024).toFixed(0)} KB remaining of ${MAX_LIBRARY_BYTES / 1024 / 1024} MB total.`;
  }
  return null;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
}

export function getAudioDuration(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.onloadedmetadata = () => resolve(audio.duration);
    audio.onerror = () => resolve(0);
    audio.src = dataUrl;
  });
}

export function dataUrlSizeBytes(dataUrl: string): number {
  // Data URL format: data:[mime];base64,[data]
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return dataUrl.length;
  const base64 = dataUrl.slice(commaIndex + 1);
  return Math.ceil(base64.length * 0.75);
}
