import type { Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
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

export const colorTheme = (dark: boolean) => (dark ? darkTheme : lightTheme);

/** Everything the ChordPro editor runs with, apart from per-instance callbacks and the swappable color theme. */
export function chordEditorExtensions(): Extension[] {
  return [
    cvTheme,
    chordProLanguage,
    chordProHighlightStyle,
    bracketMatching(),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.lineWrapping,
  ];
}
