import * as ChordSheetJS from 'chordsheetjs';
import { chordTokens, cleanChordName } from './chordTokens';
import { detectFormat, SECTION_LABEL_RE } from './chords';

export type ChordProblemCode = 'unclosed' | 'unknown' | 'unmatchedStart' | 'unmatchedEnd';

export interface ChordProblem {
  from: number;
  to: number;
  code: ChordProblemCode;
  /** The chord name, or the section name for unmatched sections. */
  name?: string;
}

// Written inside brackets on real sheets but not chords: no chord, repeat, bar line, annotation, rest marks.
const NOT_A_CHORD = /^(N\.?C\.?|x|%|\||\*.*|[.\-\s]+)$/i;
const SHORT_SECTIONS: Record<string, string> = { c: 'chorus', v: 'verse', b: 'bridge', t: 'tab' };
const SECTION = /^\{(?:(start_of_|end_of_)(\w+)|(so|eo)([cvbt]))\b[^}]*\}/;
const SKIPPED_FORMATS = ['Ultimate Guitar', 'Chords over lyrics'];

function bracketProblems(line: string, from: number): ChordProblem[] {
  const problems: ChordProblem[] = [];
  let open: number | null = null;
  // Index loop, not [...line]: offsets are UTF-16 positions, and an emoji is two of them.
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '[') {
      if (open !== null) problems.push({ from: from + open, to: from + i, code: 'unclosed' });
      open = i;
    } else if (line[i] === ']') open = null;
  }
  if (open !== null) problems.push({ from: from + open, to: from + line.length, code: 'unclosed' });
  return problems;
}

// Several chords or a note in one bracket (`[G (Em F# G)]`, `[INTRO: C G/B]`) is deliberate, not a misspelt chord.
const isNotation = (name: string) => NOT_A_CHORD.test(name) || SECTION_LABEL_RE.test(name) || /\s/.test(cleanChordName(name));

function chordNameProblems(line: string, from: number): ChordProblem[] {
  return chordTokens(line, from)
    .filter(({ name }) => name.trim() && !isNotation(name.trim()) && !ChordSheetJS.Chord.parse(cleanChordName(name)))
    .map((t) => ({ from: t.from, to: t.to, code: 'unknown', name: t.name }));
}

function sectionProblems(lines: { text: string; from: number }[]): ChordProblem[] {
  const problems: ChordProblem[] = [];
  const open: ChordProblem[] = [];
  for (const { text, from } of lines) {
    const m = SECTION.exec(text.trim());
    if (!m) continue;
    const start = m[1] === 'start_of_' || m[3] === 'so';
    const name = m[2] ?? SHORT_SECTIONS[m[4]];
    const offset = from + text.indexOf('{');
    const at = { from: offset, to: offset + m[0].length, name };
    if (start) open.push({ ...at, code: 'unmatchedStart' });
    else if (open[open.length - 1]?.name === name) open.pop();
    else problems.push({ ...at, code: 'unmatchedEnd' });
  }
  return [...problems, ...open];
}

/** Mistakes worth flagging in a ChordPro sheet: unclosed brackets, chords nobody can read, unmatched sections. */
export function chordProblems(text: string): ChordProblem[] {
  if (SKIPPED_FORMATS.includes(detectFormat(text) ?? '')) return [];
  let from = 0;
  const lines = text.split('\n').map((line) => {
    const at = { text: line, from };
    from += line.length + 1;
    return at;
  });
  return [
    ...lines.flatMap(({ text: line, from: start }) => [...bracketProblems(line, start), ...chordNameProblems(line, start)]),
    ...sectionProblems(lines),
  ].sort((a, b) => a.from - b.from);
}

type TReplace = (key: string, replacements: Record<string, string | number>) => string;

export function describeProblem(problem: ChordProblem, tReplace: TReplace): string {
  const name = { name: problem.name ?? '' };
  switch (problem.code) {
    case 'unclosed': return tReplace('chordProblem.unclosed', name);
    case 'unknown': return tReplace('chordProblem.unknown', name);
    case 'unmatchedStart': return tReplace('chordProblem.unmatchedStart', name);
    case 'unmatchedEnd': return tReplace('chordProblem.unmatchedEnd', name);
  }
}
