import * as ChordSheetJS from 'chordsheetjs';
import { chordTokens, cleanChordName } from './chordTokens';
import { getSongKey } from './chords';
import { isChordName } from './chordProblems';

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MAJOR_QUALITIES = ['', 'm', 'm', '', '', 'm', 'dim'];
const RELATIVE_MINOR_DEGREE = 5;

/** The seven chords that belong to `key`, tonic first. */
export function keyChords(key: string): string[] {
  const parsed = key ? ChordSheetJS.Key.parse(key) : null;
  if (!parsed) return [];
  const major = parsed.isMinor() ? parsed.relativeMajor : parsed;
  const root = major.toString();
  const chords = MAJOR_STEPS.map((step, i) => cleanChordName(ChordSheetJS.Chord.parse(root + MAJOR_QUALITIES[i])!.transpose(step).toString()));
  const start = parsed.isMinor() ? RELATIVE_MINOR_DEGREE : 0;
  return [...chords.slice(start), ...chords.slice(0, start)];
}

/** The chords a song already uses, spelled as sheets render them, most used first (ties keep their first appearance). */
export function songChords(text: string): string[] {
  const counts = new Map<string, number>();
  for (const { name } of chordTokens(text)) {
    if (!isChordName(name)) continue;
    const clean = cleanChordName(name);
    counts.set(clean, (counts.get(clean) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

/** What to offer when choosing a chord: the song's own chords, then the rest of its key. */
export function suggestChords(text: string): string[] {
  return [...new Set([...songChords(text), ...keyChords(getSongKey(text))])];
}
