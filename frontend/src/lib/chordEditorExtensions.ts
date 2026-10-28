import { Prec, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { bracketMatching } from '@codemirror/language';
import { chordProLanguage, chordProHighlightStyle } from './chordpro-lang';
import { moveChord } from './chordCommands';
import { chordCompletionSource } from './chordCompletion';

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

// Keep the cursor clear of the sticky editor and chord bars when CodeMirror scrolls it into view.
const stickyBarMargins = EditorView.scrollMargins.of((view) => {
  const editorBar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--editor-bar-h')) || 0;
  const chordBar = view.dom.parentElement?.parentElement?.querySelector<HTMLElement>(':scope > .chord-bar')?.offsetHeight ?? 0;
  return { top: editorBar + chordBar };
});

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
    autocompletion({ override: [chordCompletionSource], icons: false }),
    keymap.of([
      { key: 'Alt-ArrowLeft', run: moveChord(-1) },
      { key: 'Alt-ArrowRight', run: moveChord(1) },
      ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap,
    ]),
    EditorView.lineWrapping,
    stickyBarMargins,
  ];
}
