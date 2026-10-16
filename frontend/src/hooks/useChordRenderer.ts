import { useState, useCallback, useMemo } from 'react';
import { getSongKey } from '../lib/chords';
import { stepKey } from '../lib/keys';
import { useRenderedChords } from './useRenderedChords';

export function useChordRenderer(content: string) {
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const [nashville, setNashville] = useState(false);

  const sourceKey = useMemo(() => getSongKey(content, 0), [content]);
  const { transpose, renderedHtml, currentKey, hasKey } = useRenderedChords(content, targetKey, nashville);

  const stepCurrentKey = useCallback((direction: 1 | -1) => {
    setTargetKey((prev) => {
      const base = prev || sourceKey;
      return base ? stepKey(base, direction) : prev;
    });
  }, [sourceKey]);

  const resetKey = useCallback(() => setTargetKey(null), []);

  const toggleNashville = useCallback((checked: boolean) => {
    setNashville(checked);
    if (checked) setTargetKey(null);
  }, []);

  const pickKey = useCallback((key: string) => setTargetKey(key), []);

  return {
    targetKey, setTargetKey, transpose, nashville, setNashville,
    renderedHtml, currentKey, hasKey, stepCurrentKey, resetKey, toggleNashville, pickKey,
  };
}
