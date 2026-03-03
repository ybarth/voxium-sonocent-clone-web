// Asset Library types — textures and sounds persisted in localStorage

export interface TextureAsset {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
  source: 'upload' | 'ai-generated';
  aiPrompt?: string;
  width?: number;
  height?: number;
  sizeBytes: number;
  createdAt: number;
}

export interface SoundAsset {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
  source: 'upload' | 'ai-generated';
  aiPrompt?: string;
  durationSeconds?: number;
  sizeBytes: number;
  createdAt: number;
}

export interface AssetLibrary {
  textures: TextureAsset[];
  sounds: SoundAsset[];
}
