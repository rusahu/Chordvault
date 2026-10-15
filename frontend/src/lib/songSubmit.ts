import { detectFormat, toChordPro, ensureKeyDirective, extractDirective } from './chords';
import { parseBpm } from '../../../shared/chordpro.mjs';
import { SONG_ERRORS } from '../../../shared/song-errors.mjs';
import { MAX_CONTENT_LENGTH, MIN_BPM, MAX_BPM } from './constants';

export type PreparedSong = { content: string; format: string } | { error: string };

/** The editor's save checks and conversion, shared by every "save a song" path. */
export function prepareSongForSave(raw: string, { requireLanguage = true } = {}): PreparedSong {
  const text = raw.trim();
  if (!extractDirective(text, 'title')) return { error: SONG_ERRORS.titleRequired };
  if (text.length > MAX_CONTENT_LENGTH) return { error: SONG_ERRORS.contentTooLarge };
  const tempo = extractDirective(text, 'tempo');
  if (tempo && parseBpm(tempo, MIN_BPM, MAX_BPM) === null) return { error: SONG_ERRORS.bpmRange };
  const format = detectFormat(text);
  if (!format) return { error: SONG_ERRORS.noChords };
  if (requireLanguage && !extractDirective(text, 'x_language')) return { error: SONG_ERRORS.languageRequired };
  return { content: ensureKeyDirective(toChordPro(text)), format };
}
