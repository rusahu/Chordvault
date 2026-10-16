import { useMemo } from 'react';
import { renderChordPro, getSongKey, songHasKey } from '../lib/chords';
import { entrySemitones } from '../lib/setlistKeys';

/** A song rendered in `targetKey` (as written when null): the HTML, the key it plays in, and whether it declares a key. */
export function useRenderedChords(content: string, targetKey: string | null | undefined, nashville: boolean) {
  const transpose = useMemo(() => entrySemitones(content, targetKey), [content, targetKey]);
  const renderedHtml = useMemo(() => renderChordPro(content, transpose, nashville), [content, transpose, nashville]);
  const currentKey = useMemo(() => getSongKey(content, transpose), [content, transpose]);
  const hasKey = useMemo(() => songHasKey(content, transpose), [content, transpose]);
  return { transpose, renderedHtml, currentKey, hasKey };
}
