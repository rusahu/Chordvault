import * as ChordSheetJS from 'chordsheetjs';
import { keyChords, songChords, suggestChords } from '../chordSuggestions';
import { ALL_KEYS, ALL_KEYS_MINOR } from '../keys';

describe('keyChords', () => {
  it.each([
    ['G', ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim']],
    ['Em', ['Em', 'F#dim', 'G', 'Am', 'Bm', 'C', 'D']],
    ['F#', ['F#', 'G#m', 'Bbm', 'B', 'C#', 'Ebm', 'Fdim']],
  ])('gives the chords of %s, tonic first, spelled the way sheets render', (key, chords) => {
    expect(keyChords(key)).toEqual(chords);
  });

  it.each([...ALL_KEYS, ...ALL_KEYS_MINOR])('gives seven real chords for %s', (key) => {
    const chords = keyChords(key);
    expect(chords).toHaveLength(7);
    for (const chord of chords) expect(ChordSheetJS.Chord.parse(chord)).not.toBeNull();
  });

  it('gives nothing without a key', () => {
    expect(keyChords('')).toEqual([]);
    expect(keyChords('nonsense')).toEqual([]);
  });
});

describe('songChords', () => {
  it('lists the chords a song uses, most used first, skipping section labels', () => {
    expect(songChords('[G]a [D]b [G]c [G/B]d [Chorus]')).toEqual(['G', 'D', 'G/B']);
  });
});

describe('suggestChords', () => {
  it('puts song chords first, then the rest of the key, without repeats', () => {
    expect(suggestChords('{key: G}\n[D]a [D]b [G/B]c [G]d')).toEqual(['D', 'G/B', 'G', 'Am', 'Bm', 'C', 'Em', 'F#dim']);
  });

  it('works for text with no key and no chords', () => {
    expect(suggestChords('just lyrics')).toEqual([]);
  });
});
