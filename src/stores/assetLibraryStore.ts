// Asset Library Store — global, persisted to localStorage
// Manages user-uploaded and AI-generated texture/sound assets

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TextureAsset, SoundAsset } from '../types/assetLibrary';
import {
  validateImageFile,
  validateAudioFile,
  readFileAsDataUrl,
  getImageDimensions,
  getAudioDuration,
  dataUrlSizeBytes,
  checkLibraryQuota,
} from '../utils/assetValidation';

interface AssetLibraryStore {
  textures: TextureAsset[];
  sounds: SoundAsset[];

  addTextureAsset: (file: File) => Promise<TextureAsset>;
  addTextureFromDataUrl: (dataUrl: string, name: string, source: 'upload' | 'ai-generated', aiPrompt?: string) => Promise<TextureAsset>;
  addSoundAsset: (file: File) => Promise<SoundAsset>;
  addSoundFromDataUrl: (dataUrl: string, name: string, source: 'upload' | 'ai-generated', aiPrompt?: string) => Promise<SoundAsset>;
  renameAsset: (type: 'texture' | 'sound', id: string, name: string) => void;
  deleteAsset: (type: 'texture' | 'sound', id: string) => void;
  getTextureById: (id: string) => TextureAsset | undefined;
  getSoundById: (id: string) => SoundAsset | undefined;
  getTotalSizeBytes: () => number;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useAssetLibraryStore = create<AssetLibraryStore>()(
  persist(
    (set, get) => ({
      textures: [],
      sounds: [],

      addTextureAsset: async (file: File) => {
        const validationError = validateImageFile(file);
        if (validationError) throw new Error(validationError);

        const dataUrl = await readFileAsDataUrl(file);
        const sizeBytes = dataUrlSizeBytes(dataUrl);
        const quotaError = checkLibraryQuota(get().getTotalSizeBytes(), sizeBytes);
        if (quotaError) throw new Error(quotaError);

        const dims = await getImageDimensions(dataUrl);
        const asset: TextureAsset = {
          id: generateId(),
          name: file.name.replace(/\.[^.]+$/, ''),
          dataUrl,
          mimeType: file.type,
          source: 'upload',
          width: dims.width,
          height: dims.height,
          sizeBytes,
          createdAt: Date.now(),
        };

        set((s) => ({ textures: [...s.textures, asset] }));
        return asset;
      },

      addTextureFromDataUrl: async (dataUrl, name, source, aiPrompt) => {
        const sizeBytes = dataUrlSizeBytes(dataUrl);
        const quotaError = checkLibraryQuota(get().getTotalSizeBytes(), sizeBytes);
        if (quotaError) throw new Error(quotaError);

        const dims = await getImageDimensions(dataUrl);
        const mimeType = dataUrl.match(/^data:([^;]+)/)?.[1] ?? 'image/png';
        const asset: TextureAsset = {
          id: generateId(),
          name,
          dataUrl,
          mimeType,
          source,
          aiPrompt,
          width: dims.width,
          height: dims.height,
          sizeBytes,
          createdAt: Date.now(),
        };

        set((s) => ({ textures: [...s.textures, asset] }));
        return asset;
      },

      addSoundAsset: async (file: File) => {
        const validationError = validateAudioFile(file);
        if (validationError) throw new Error(validationError);

        const dataUrl = await readFileAsDataUrl(file);
        const sizeBytes = dataUrlSizeBytes(dataUrl);
        const quotaError = checkLibraryQuota(get().getTotalSizeBytes(), sizeBytes);
        if (quotaError) throw new Error(quotaError);

        const durationSeconds = await getAudioDuration(dataUrl);
        const asset: SoundAsset = {
          id: generateId(),
          name: file.name.replace(/\.[^.]+$/, ''),
          dataUrl,
          mimeType: file.type,
          source: 'upload',
          durationSeconds,
          sizeBytes,
          createdAt: Date.now(),
        };

        set((s) => ({ sounds: [...s.sounds, asset] }));
        return asset;
      },

      addSoundFromDataUrl: async (dataUrl, name, source, aiPrompt) => {
        const sizeBytes = dataUrlSizeBytes(dataUrl);
        const quotaError = checkLibraryQuota(get().getTotalSizeBytes(), sizeBytes);
        if (quotaError) throw new Error(quotaError);

        const durationSeconds = await getAudioDuration(dataUrl);
        const mimeType = dataUrl.match(/^data:([^;]+)/)?.[1] ?? 'audio/mpeg';
        const asset: SoundAsset = {
          id: generateId(),
          name,
          dataUrl,
          mimeType,
          source,
          aiPrompt,
          durationSeconds,
          sizeBytes,
          createdAt: Date.now(),
        };

        set((s) => ({ sounds: [...s.sounds, asset] }));
        return asset;
      },

      renameAsset: (type, id, name) => {
        if (type === 'texture') {
          set((s) => ({
            textures: s.textures.map((t) => (t.id === id ? { ...t, name } : t)),
          }));
        } else {
          set((s) => ({
            sounds: s.sounds.map((s2) => (s2.id === id ? { ...s2, name } : s2)),
          }));
        }
      },

      deleteAsset: (type, id) => {
        if (type === 'texture') {
          set((s) => ({ textures: s.textures.filter((t) => t.id !== id) }));
        } else {
          set((s) => ({ sounds: s.sounds.filter((s2) => s2.id !== id) }));
        }
      },

      getTextureById: (id) => get().textures.find((t) => t.id === id),
      getSoundById: (id) => get().sounds.find((s) => s.id === id),

      getTotalSizeBytes: () => {
        const { textures, sounds } = get();
        return (
          textures.reduce((sum, t) => sum + t.sizeBytes, 0) +
          sounds.reduce((sum, s) => sum + s.sizeBytes, 0)
        );
      },
    }),
    {
      name: 'voxium_asset_library',
      partialize: (state) => ({
        textures: state.textures,
        sounds: state.sounds,
      }),
    }
  )
);
