import { useCallback } from 'react';
import { useLocalStorage } from '@mantine/hooks';
import { clampFontSize } from '../lib/chords';

export function useFontScale() {
  const [fontSize, setFontSize] = useLocalStorage({
    key: 'cv_fontsize', defaultValue: 0, getInitialValueInEffect: false, sync: false,
    serialize: String, deserialize: (value) => parseInt(value ?? '0') || 0,
  });
  const changeFontSize = useCallback((delta: number) => setFontSize((prev) => clampFontSize(prev + delta)), [setFontSize]);
  const resetFontSize = useCallback(() => setFontSize(0), [setFontSize]);
  const setFontSizeTo = useCallback((value: number) => setFontSize(clampFontSize(value)), [setFontSize]);
  return { fontSize, changeFontSize, resetFontSize, setFontSizeTo };
}
