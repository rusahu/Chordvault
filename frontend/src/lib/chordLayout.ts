import { chordTokens, lineRanges, type ChordToken } from './chordTokens';

export interface LyricSegment {
  chord: ChordToken | null;
  text: string;
  /** Document offset of the segment's first lyric character. */
  from: number;
}

export type LayoutLine =
  | { kind: 'lyrics'; from: number; to: number; segments: LyricSegment[] }
  | { kind: 'other'; from: number; text: string };

const isOther = (text: string) => !text.trim() || /^\s*[{#]/.test(text);

function segments(text: string, from: number): LyricSegment[] {
  const tokens = chordTokens(text, from);
  const firstChord = tokens[0]?.from ?? from + text.length;
  const out: LyricSegment[] = firstChord > from ? [{ chord: null, text: text.slice(0, firstChord - from), from }] : [];
  tokens.forEach((token, i) => {
    const end = tokens[i + 1]?.from ?? from + text.length;
    out.push({ chord: token, text: text.slice(token.to - from, end - from), from: token.to });
  });
  return out;
}

/** The song as chords over lyrics, keeping every document offset so a tap maps back to the source. */
export function chordLayout(text: string): LayoutLine[] {
  return lineRanges(text).map(({ text: line, from }) => (isOther(line)
    ? { kind: 'other', from, text: line }
    : { kind: 'lyrics', from, to: from + line.length, segments: segments(line, from) }));
}

// Where a line may wrap: around spaces, and around each Chinese, Japanese or Korean character.
const BREAK = /(\s+|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])/u;

/**
 * Regroups a line's segments into words, each a list of pieces that must stay on one row.
 * A mid-word chord (`som[E]ething`) ends up inside one word, so the word never wraps apart.
 */
export function lineWords(segments: LyricSegment[]): LyricSegment[][] {
  const words: LyricSegment[][] = [];
  let word: LyricSegment[] = [];
  const flush = () => { if (word.length) words.push(word); word = []; };
  for (const segment of segments) {
    let chord = segment.chord;
    let from = segment.from;
    if (!segment.text) word.push({ chord, text: '', from });
    for (const part of segment.text.split(BREAK)) {
      if (!part) continue;
      const piece = { chord, text: part, from };
      if (BREAK.test(part)) { flush(); words.push([piece]); } else word.push(piece);
      chord = null;
      from += part.length;
    }
  }
  flush();
  return words;
}
