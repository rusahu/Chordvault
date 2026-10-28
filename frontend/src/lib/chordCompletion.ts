import { startCompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import type { Command } from '@codemirror/view';
import { chordAt } from './chordTokens';
import { suggestChords } from './chordSuggestions';

const MAX_BOOST = 99;

/** Suggests chord names while the cursor is inside `[...]`, closed or not. */
export function chordCompletionSource(context: CompletionContext): CompletionResult | null {
  const before = context.matchBefore(/\[[^\]\s[]*$/);
  if (!before) return null;
  const after = /^[^\]\s[]*/.exec(context.state.sliceDoc(context.pos, context.state.doc.lineAt(context.pos).to))![0];
  const names = suggestChords(context.state.doc.toString());
  return {
    from: before.from + 1,
    to: context.pos + after.length,
    // Boost keeps the order (song chords first); CodeMirror would otherwise sort ties alphabetically.
    options: names.map((label, i) => ({ label, type: 'keyword', boost: Math.max(MAX_BOOST - i, -MAX_BOOST) })),
    // Change (an explicit request) shows every option, not only names matching the current one.
    filter: context.explicit ? false : undefined,
  };
}

/** Opens the chord list for the chord at the cursor, to replace it. */
export const startChordChange: Command = (view) => {
  const token = chordAt(view.state, view.state.selection.main.head);
  if (!token) return false;
  view.dispatch({ selection: { anchor: token.to - 1 } });
  return startCompletion(view);
};
