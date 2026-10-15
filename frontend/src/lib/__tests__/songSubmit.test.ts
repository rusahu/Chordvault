import { prepareSongForSave } from '../songSubmit';
import { SONG_ERRORS } from '../../../../shared/song-errors.mjs';

const ok = '{title: T}\n{x_language: en}\n[C]Amazing [G]grace';

it('rejects in order: title, length, bpm, chords, language', () => {
  expect(prepareSongForSave('[C]a')).toEqual({ error: SONG_ERRORS.titleRequired });
  expect(prepareSongForSave('{title: T}\n{x_language: en}\n' + 'a'.repeat(100001))).toEqual({ error: SONG_ERRORS.contentTooLarge });
  expect(prepareSongForSave('{title: T}\n{tempo: 120bpm}\n{x_language: en}\n[C]a')).toEqual({ error: SONG_ERRORS.bpmRange });
  expect(prepareSongForSave('{title: T}\n{x_language: en}\nno chords')).toEqual({ error: SONG_ERRORS.noChords });
  expect(prepareSongForSave('{title: T}\n[C]a')).toEqual({ error: SONG_ERRORS.languageRequired });
});

it('reports a missing title for empty content', () => {
  expect(prepareSongForSave('   ')).toEqual({ error: SONG_ERRORS.titleRequired });
});

it('rejects tempos the server would drop and accepts a padded whole number', () => {
  for (const bad of ['72.5', '90-100', '0', '400']) {
    expect(prepareSongForSave(`{title: T}\n{tempo: ${bad}}\n{x_language: en}\n[C]a`)).toEqual({ error: SONG_ERRORS.bpmRange });
  }
  expect('content' in prepareSongForSave('{title: T}\n{tempo:  120 }\n{x_language: en}\n[C]a')).toBe(true);
});

it('skips the language check when not required', () => {
  expect('content' in prepareSongForSave('{title: T}\n[C]a', { requireLanguage: false })).toBe(true);
});

it('converts to ChordPro and adds a key', () => {
  const r = prepareSongForSave(`  ${ok}  `);
  expect(r).toEqual({ content: expect.stringMatching(/^\{key: C\}\n\{title: T\}/), format: expect.any(String) });
});

it('converts chords over lyrics to inline ChordPro', () => {
  const r = prepareSongForSave('{title: T}\n{x_language: en}\nG       C\nAmazing grace');
  expect(r).toEqual({ content: expect.stringContaining('[G]Amazing'), format: expect.any(String) });
});
