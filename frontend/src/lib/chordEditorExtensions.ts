import { Prec, type Extension } from '@codemirror/state';
import { EditorView, keymap, type KeyBinding } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { bracketMatching } from '@codemirror/language';
import { chordProLanguage, chordProHighlightStyle } from './chordpro-lang';
import { moveChord } from './chordCommands';
import { chordCompletionSource } from './chordCompletion';
import { chordProblems, type ChordProblem } from './chordProblems';
import { linter } from '@codemirror/lint';
import { search, searchKeymap } from '@codemirror/search';

const cvTheme = EditorView.theme({
  // --cm-end-space (editor.css) leaves room on touch screens to scroll the last line above the on-screen keyboard.
  '.cm-content': { padding: '12px 0 var(--cm-end-space, 12px)', minHeight: '300px' },
  '.cm-focused': { outline: 'none' },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-gutters': { display: 'none' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--text)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    background: 'var(--accent-bg) !important',
  },
  '.cm-activeLine': { backgroundColor: 'var(--chord-tint)' },
  // The find panel sticks below the sticky editor and chord bars (offset set in editor.css), and under them when they overlap.
  '.cm-panels.cm-panels-top': { top: 'var(--cm-panel-top, 0px)', zIndex: 30 },
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

// Option+Arrow is the word jump on a Mac, so chords move with Ctrl+Option+Arrow there.
export const chordKeymap: KeyBinding[] = [
  { key: 'Alt-ArrowLeft', mac: 'Ctrl-Alt-ArrowLeft', run: moveChord(-1) },
  { key: 'Alt-ArrowRight', mac: 'Ctrl-Alt-ArrowRight', run: moveChord(1) },
];

const LINT_DELAY_MS = 500;

const chordLinter = (describe: (problem: ChordProblem) => string) => linter(
  (view) => chordProblems(view.state.doc.toString()).map((p) => ({ from: p.from, to: p.to, severity: 'warning' as const, message: describe(p) })),
  { delay: LINT_DELAY_MS },
);

/**
 * Everything the ChordPro editor runs with, apart from per-instance callbacks and the swappable color theme.
 * `describe` turns a chord problem into the message shown for it.
 */
export function chordEditorExtensions(describe: (problem: ChordProblem) => string): Extension[] {
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
      ...chordKeymap,
      ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...searchKeymap,
    ]),
    EditorView.lineWrapping,
    stickyBarMargins,
    chordLinter(describe),
    search({ top: true }),
  ];
}
