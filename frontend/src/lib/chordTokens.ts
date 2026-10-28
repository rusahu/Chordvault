import type { EditorState } from '@codemirror/state';
import { normalizeChord } from './keys';

/** One inline chord: `from` is at `[`, `to` is just after `]`. */
export interface ChordToken {
  from: number;
  to: number;
  name: string;
}

// No `g` flag: CodeMirror's StringStream.match needs a non-global pattern.
export const CHORD_TOKEN = /\[[^[\]\n]*\]/;
export const SECTION_DIRECTIVE = /\{(start_of_|end_of_)?(verse|chorus|bridge|tab|grid|intro|outro)[^}]*\}/i;

export function chordTokens(text: string, offset = 0): ChordToken[] {
  return [...text.matchAll(new RegExp(CHORD_TOKEN.source, 'g'))].map((m) => ({
    from: offset + m.index,
    to: offset + m.index + m[0].length,
    name: m[0].slice(1, -1),
  }));
}

/** The chord the cursor is in or touching, on the cursor's line. A chord starting at `pos` wins over one ending there. */
export function chordAt(state: EditorState, pos: number): ChordToken | null {
  const line = state.doc.lineAt(pos);
  const tokens = chordTokens(line.text, line.from);
  return tokens.find((t) => t.from === pos) ?? tokens.find((t) => t.from < pos && pos <= t.to) ?? null;
}

/** Spaces around a slash removed and the preferred spelling applied: `A / Db` becomes `A/C#`. */
export const cleanChordName = (inner: string) => normalizeChord(inner.replace(/\s*\/\s*/g, '/'));

/** Each line of `text` with the document offset it starts at. */
export function lineRanges(text: string): { text: string; from: number }[] {
  let from = 0;
  return text.split('\n').map((line) => {
    const range = { text: line, from };
    from += line.length + 1;
    return range;
  });
}

/** A chord name as it is written in the sheet: cleaned and in brackets. */
export const bracketed = (name: string) => `[${cleanChordName(name)}]`;
