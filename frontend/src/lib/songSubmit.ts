import { detectFormat, toChordPro, ensureKeyDirective, extractDirective } from './chords';
import { parseBpm } from '../../../shared/chordpro.mjs';
import { MAX_CONTENT_LENGTH, MIN_BPM, MAX_BPM } from './constants';

type Translate = (key: string) => string;
export type PreparedSong = { content: string; format: string } | { error: string };

/** The editor's save checks and conversion, shared by every "save a song" path. */
export function prepareSongForSave(raw: string, t: Translate, { requireLanguage = true } = {}): PreparedSong {
  const text = raw.trim();
  if (!extractDirective(text, 'title')) return { error: t('songEdit.titleRequired') };
  if (!text) return { error: t('songEdit.contentRequired') };
  if (text.length > MAX_CONTENT_LENGTH) return { error: t('songEdit.contentTooLarge') };
  const tempo = extractDirective(text, 'tempo');
  if (tempo && parseBpm(tempo, MIN_BPM, MAX_BPM) === null) return { error: `BPM must be between ${MIN_BPM} and ${MAX_BPM}` };
  const format = detectFormat(text);
  if (!format) return { error: 'No chords detected. Add chords in [brackets] before the syllable, e.g. [G]Amazing [C]grace' };
  if (requireLanguage && !extractDirective(text, 'x_language')) return { error: 'Please select a language' };
  return { content: ensureKeyDirective(toChordPro(text)), format };
}
