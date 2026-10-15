import { prepareSongForSave } from '../songSubmit';

const t = (k: string) => k;
const ok = '{title: T}\n{x_language: en}\n[C]Amazing [G]grace';

it('rejects in order: title, content, length, bpm, chords, language', () => {
  expect(prepareSongForSave('[C]a', t)).toEqual({ error: 'songEdit.titleRequired' });
  expect(prepareSongForSave('{title: T}\n{x_language: en}\n' + 'a'.repeat(100001), t)).toEqual({ error: 'songEdit.contentTooLarge' });
  expect(prepareSongForSave('{title: T}\n{tempo: 120bpm}\n{x_language: en}\n[C]a', t)).toEqual({ error: 'BPM must be between 1 and 300' });
  expect('error' in prepareSongForSave('{title: T}\n{x_language: en}\nno chords', t)).toBe(true);
  expect(prepareSongForSave('{title: T}\n[C]a', t)).toEqual({ error: 'Please select a language' });
});

it('rejects tempos the server would drop and accepts a padded whole number', () => {
  for (const bad of ['72.5', '90-100', '0', '400']) {
    expect(prepareSongForSave(`{title: T}\n{tempo: ${bad}}\n{x_language: en}\n[C]a`, t)).toEqual({ error: 'BPM must be between 1 and 300' });
  }
  expect('content' in prepareSongForSave('{title: T}\n{tempo:  120 }\n{x_language: en}\n[C]a', t)).toBe(true);
});

it('skips the language check when not required', () => {
  expect('content' in prepareSongForSave('{title: T}\n[C]a', t, { requireLanguage: false })).toBe(true);
});

it('converts to ChordPro and adds a key', () => {
  const r = prepareSongForSave(`  ${ok}  `, t);
  expect(r).toEqual({ content: expect.stringMatching(/^\{key: C\}\n\{title: T\}/), format: expect.any(String) });
});

it('converts chords over lyrics to inline ChordPro', () => {
  const r = prepareSongForSave('{title: T}\n{x_language: en}\nG       C\nAmazing grace', t);
  expect(r).toEqual({ content: expect.stringContaining('[G]Amazing'), format: expect.any(String) });
});
