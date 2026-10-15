const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSongInput } = require('../lib/validation');
const { SONG_ERRORS } = require('../shared/song-errors.mjs');

test('the chord check rejects content with no chords', () => {
  const err = validateSongInput({ content: 'just lyrics', requireContent: true });
  assert.equal(err, SONG_ERRORS.noChords);
});

test('the chord check accepts content containing a bracket chord', () => {
  const err = validateSongInput({ content: '[G]Amazing grace', requireContent: true });
  assert.equal(err, null);
});

test('the chord check is skipped when content is absent', () => {
  const err = validateSongInput({ youtube_url: null });
  assert.equal(err, null);
});

test('section labels alone do not count as chords', () => {
  const err = validateSongInput({ content: 'Chorus\nsome lyrics', requireContent: true });
  assert.equal(err, SONG_ERRORS.noChords);
});
