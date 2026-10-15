import { useRef, useEffect, useState } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching } from '@codemirror/language';
import { chordProLanguage, chordProHighlightStyle } from '../lib/chordpro-lang';

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  darkMode: boolean;
  placeholder?: string;
}

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

export function CodeMirrorEditor({ value, onChange, darkMode, placeholder }: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [theme] = useState(() => new Compartment());
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const placeholderRef = useRef(placeholder);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { placeholderRef.current = placeholder; }, [placeholder]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const extensions = [
      cvTheme,
      theme.of([]),
      chordProLanguage,
      chordProHighlightStyle,
      bracketMatching(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      updateListener,
      EditorView.lineWrapping,
    ];
    if (placeholderRef.current) extensions.push(cmPlaceholder(placeholderRef.current));

    const state = EditorState.create({ doc: valueRef.current, extensions });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => { view.destroy(); viewRef.current = null; };
  }, [theme]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: theme.reconfigure(darkMode ? darkTheme : lightTheme) });
  }, [darkMode, theme]);

  // Sync external value changes (OCR import, initial load) into CodeMirror
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    // Skip if value matches what's already in the editor (avoids cursor jump on typing)
    if (value === currentDoc) return;
    view.dispatch({ changes: { from: 0, to: currentDoc.length, insert: value } });
  }, [value]);

  return <div ref={containerRef} className="cm-editor-container" />;
}
