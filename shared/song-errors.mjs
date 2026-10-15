import constants from './public-constants.json' with { type: 'json' };

const { limits } = constants;

export const SONG_ERRORS = Object.freeze({
  titleRequired: 'Title is required. Add {title: Song Name} to your content.',
  contentTooLarge: `Song content too large (max ${limits.MAX_CONTENT / 1000}KB)`,
  bpmRange: `BPM must be between ${limits.MIN_BPM} and ${limits.MAX_BPM}`,
  noChords: 'No chords detected. Add chords in [brackets] before the syllable, e.g. [G]Amazing [C]grace',
  languageRequired: 'Please select a language',
});
