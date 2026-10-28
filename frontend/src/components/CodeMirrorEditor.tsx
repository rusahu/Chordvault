import { useRef, useEffect, useState } from 'react';
import { useComputedColorScheme } from '@mantine/core';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, placeholder as cmPlaceholder } from '@codemirror/view';
import { chordEditorExtensions, colorTheme } from '../lib/chordEditorExtensions';

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  onViewReady?: (view: EditorView | null) => void;
}

export function CodeMirrorEditor({ value, onChange, placeholder, ariaLabel, autoFocus, onViewReady }: CodeMirrorEditorProps) {
  const dark = useComputedColorScheme('dark') === 'dark';
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [theme] = useState(() => new Compartment());
  const onChangeRef = useRef(onChange);
  const onViewReadyRef = useRef(onViewReady);
  const initial = useRef({ value, placeholder, ariaLabel, autoFocus });

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onViewReadyRef.current = onViewReady; }, [onViewReady]);

  useEffect(() => {
    if (!containerRef.current) return;
    const { value: doc, placeholder: hint, ariaLabel: label, autoFocus: focus } = initial.current;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const extensions = [...chordEditorExtensions(), theme.of([]), updateListener];
    if (hint) extensions.push(cmPlaceholder(hint));
    if (label) extensions.push(EditorView.contentAttributes.of({ 'aria-label': label }));

    const view = new EditorView({ state: EditorState.create({ doc, extensions }), parent: containerRef.current });
    viewRef.current = view;
    if (focus) view.focus();
    onViewReadyRef.current?.(view);

    return () => { view.destroy(); viewRef.current = null; onViewReadyRef.current?.(null); };
  }, [theme]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: theme.reconfigure(colorTheme(dark)) });
  }, [dark, theme]);

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
