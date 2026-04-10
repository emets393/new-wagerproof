// useThinkingSprite — Persisted thinking sprite preference.
// Both ThinkingIndicator and ThinkingBlockView read from this
// to show the user's chosen Lottie animation.

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'chat.thinkingSprite';
const DEFAULT_SPRITE = 'thinking_petals';

export const THINKING_SPRITES = [
  { name: 'thinking_petals', label: 'Petals' },
  { name: 'thinking_1', label: 'Classic' },
  { name: 'thinking_2', label: 'Bubbly' },
  { name: 'thinking_birb', label: 'Birb' },
] as const;

export type SpriteName = typeof THINKING_SPRITES[number]['name'];

/** Read-only hook for components that just display the sprite */
export function useThinkingSprite(): SpriteName {
  const [sprite, setSprite] = useState<SpriteName>(DEFAULT_SPRITE);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val && THINKING_SPRITES.some((s) => s.name === val)) {
        setSprite(val as SpriteName);
      }
    });
  }, []);

  return sprite;
}

/** Read/write hook for the sprite picker */
export function useThinkingSpriteEditor(): [SpriteName, (name: SpriteName) => void] {
  const [sprite, setSprite] = useState<SpriteName>(DEFAULT_SPRITE);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val && THINKING_SPRITES.some((s) => s.name === val)) {
        setSprite(val as SpriteName);
      }
    });
  }, []);

  const selectSprite = useCallback((name: SpriteName) => {
    setSprite(name);
    AsyncStorage.setItem(STORAGE_KEY, name);
  }, []);

  return [sprite, selectSprite];
}
