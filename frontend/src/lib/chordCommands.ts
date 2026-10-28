import { findClusterBreak, type EditorState, type TransactionSpec } from '@codemirror/state';
import type { Command } from '@codemirror/view';
import { chordAt, chordTokens, cleanChordName, type ChordToken } from './chordTokens';

// Not input.type or delete: CodeMirror history joins those, and each chord action must undo on its own.
const MOVE = 'chord.move';
const DELETE = 'chord.delete';
const INSERT = 'chord.insert';

/** The letter, or the whole neighbouring chord, next to `token` on its line; null at the line's edge. */
function neighbour(state: EditorState, token: ChordToken, direction: 1 | -1): { from: number; to: number } | null {
  const line = state.doc.lineAt(token.from);
  const edge = direction === 1 ? token.to : token.from;
  if (direction === 1 ? edge >= line.to : edge <= line.from) return null;
  const chord = chordTokens(line.text, line.from).find((t) => (direction === 1 ? t.from === edge : t.to === edge));
  if (chord) return chord;
  const step = findClusterBreak(line.text, edge - line.from, direction === 1) + line.from;
  return direction === 1 ? { from: edge, to: step } : { from: step, to: edge };
}

/** Moves `token` past one letter or one neighbouring chord, keeping the cursor at the same spot inside it. */
export function moveChordBy(state: EditorState, token: ChordToken, direction: 1 | -1): TransactionSpec | null {
  const other = neighbour(state, token, direction);
  if (!other) return null;
  const chordText = state.sliceDoc(token.from, token.to);
  const otherText = state.sliceDoc(other.from, other.to);
  const from = Math.min(token.from, other.from);
  const newFrom = direction === 1 ? from + otherText.length : from;
  const inside = Math.min(Math.max(state.selection.main.head - token.from, 1), chordText.length - 1);
  return {
    changes: { from, to: Math.max(token.to, other.to), insert: direction === 1 ? otherText + chordText : chordText + otherText },
    selection: { anchor: newFrom + inside },
    userEvent: MOVE,
  };
}

/** Moves `token` so it sits just before `pos` (a position in the current document). */
export function moveChordTo(state: EditorState, token: ChordToken, pos: number): TransactionSpec {
  if (pos >= token.from && pos <= token.to) return {};
  const chordText = state.sliceDoc(token.from, token.to);
  const newFrom = pos > token.to ? pos - chordText.length : pos;
  return {
    changes: [{ from: token.from, to: token.to }, { from: pos, insert: chordText }],
    selection: { anchor: newFrom + 1 },
    userEvent: MOVE,
  };
}

export function insertChordAt(pos: number, name: string): TransactionSpec {
  const chordText = `[${cleanChordName(name)}]`;
  return { changes: { from: pos, insert: chordText }, selection: { anchor: pos + chordText.length }, userEvent: INSERT };
}

export function deleteChordToken(token: ChordToken): TransactionSpec {
  return { changes: { from: token.from, to: token.to }, selection: { anchor: token.from }, userEvent: DELETE };
}

const chordAtCursor = (state: EditorState) => chordAt(state, state.selection.main.head);

/** Returns true whenever the cursor is in a chord, even at a line edge, so the key does not fall through to cursor movement. */
export const moveChord = (direction: 1 | -1): Command => (view) => {
  const token = chordAtCursor(view.state);
  if (!token) return false;
  const spec = moveChordBy(view.state, token, direction);
  if (spec) view.dispatch(spec);
  return true;
};

export const deleteChord: Command = (view) => {
  const token = chordAtCursor(view.state);
  if (!token) return false;
  view.dispatch(deleteChordToken(token));
  return true;
};

export const insertText = (text: string): Command => (view) => {
  view.dispatch(view.state.replaceSelection(text), { userEvent: 'input.type' });
  return true;
};
