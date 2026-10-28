import { Prec, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { bracketMatching } from '@codemirror/language';
import { chordProLanguage, chordProHighlightStyle } from './chordpro-lang';

const cvTheme = EditorView.theme({
  '.cm-content': { padding: '12px 0', minHeight: '300px' },
  '.cm-focused': { outline: 'none' },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-gutters': { display: 'none' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--text)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    background: 'var(--accent-bg) !important',
  },
  '.cm-activeLine': { backgroundColor: 'var(--chord-tint)' },
});

const darkTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--raise)', color: 'var(--text)' },
}, { dark: true });

const lightTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--raise)', color: 'var(--text)' },
}, { dark: false });

// closeBrackets only closes before whitespace or punctuation, but chords go in front of lyrics: `[` always pairs here.
const chordBracketInput = Prec.high(EditorView.inputHandler.of((view, from, to, text) => {
  if (from !== to || (text !== '[' && text !== ']')) return false;
  if (text === ']') {
    if (view.state.sliceDoc(from, from + 1) !== ']') return false;
    view.dispatch({ selection: { anchor: from + 1 }, userEvent: 'input.type' });
    return true;
  }
  view.dispatch({ changes: { from, insert: '[]' }, selection: { anchor: from + 1 }, userEvent: 'input.type' });
  return true;
}));

export const colorTheme = (dark: boolean) => (dark ? darkTheme : lightTheme);

/** Everything the ChordPro editor runs with, apart from per-instance callbacks and the swappable color theme. */
export function chordEditorExtensions(): Extension[] {
  return [
    cvTheme,
    chordProLanguage,
    chordProHighlightStyle,
    bracketMatching(),
    history(),
    closeBrackets(),
    chordBracketInput,
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
    EditorView.lineWrapping,
  ];
}
