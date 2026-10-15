const test = require('node:test');
const assert = require('node:assert/strict');
const { SONG_ERRORS } = require('../shared/song-errors.mjs');
const { validateSongInput, validateSongMetadata } = require('../lib/validation');

test('server song validation uses the shared messages', () => {
  assert.equal(validateSongMetadata({ title: '', language: 'en' }), SONG_ERRORS.titleRequired);
  assert.equal(validateSongInput({ content: '{title: T}\nno chords here', requireChord: true }), SONG_ERRORS.noChords);
  assert.equal(validateSongInput({ content: 'x'.repeat(100001) }), SONG_ERRORS.contentTooLarge);
  assert.equal(validateSongInput({ bpm: 0 }), SONG_ERRORS.bpmRange);
});

test('shared song messages carry the limits and no dashes', () => {
  assert.equal(SONG_ERRORS.bpmRange, 'BPM must be between 1 and 300');
  assert.match(SONG_ERRORS.contentTooLarge, /\(max 100KB\)/);
  for (const message of Object.values(SONG_ERRORS)) assert.doesNotMatch(message, /[–—]|--/);
});
