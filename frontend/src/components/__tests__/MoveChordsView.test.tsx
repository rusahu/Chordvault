import { fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { EditorState, StateEffect } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { history, undo } from '@codemirror/commands';
import { act } from 'react';
import { MoveChordsView } from '../MoveChordsView';

vi.mock('../../context/I18nContext', () => import('../../test/i18nMock'));

let view: EditorView;
afterEach(() => view?.destroy());

// The real editor hands MoveChordsView its view and the text it last reported; this does the same.
function Harness({ editor }: { editor: EditorView }) {
  const [content, setContent] = useState(() => editor.state.doc.toString());
  useEffect(() => {
    editor.dispatch({ effects: StateEffect.appendConfig.of(EditorView.updateListener.of((u) => { if (u.docChanged) setContent(u.state.doc.toString()); })) });
  }, [editor]);
  return <MoveChordsView view={editor} content={content} />;
}

function renderDoc(doc: string) {
  view = new EditorView({ state: EditorState.create({ doc, extensions: [history()] }) });
  return render(<Harness editor={view} />);
}

const letter = (container: HTMLElement, pos: number) => container.querySelector<HTMLElement>(`[data-pos="${pos}"]`)!;
const text = () => view.state.doc.toString();

it('moves a picked chord into the middle of a word', () => {
  const { container } = renderDoc('som[E]ething');
  fireEvent.click(screen.getByRole('button', { name: 'Chord E' }));
  fireEvent.click(letter(container, 9));
  expect(text()).toBe('someth[E]ing');
});

it('moves a chord later on its own line', () => {
  const { container } = renderDoc('[G]Amazing grace');
  fireEvent.click(screen.getByRole('button', { name: 'Chord G' }));
  fireEvent.click(letter(container, 11));
  expect(text()).toBe('Amazing [G]grace');
});

it('keeps the chord picked after a move, nudges it and deletes it', () => {
  renderDoc('[C]abc');
  fireEvent.click(screen.getByRole('button', { name: 'Chord C' }));
  fireEvent.click(screen.getByRole('button', { name: 'Move chord right' }));
  expect(text()).toBe('a[C]bc');
  expect(screen.getByRole('button', { name: 'Chord C' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Move chord left' }));
  expect(text()).toBe('[C]abc');
  fireEvent.click(screen.getByRole('button', { name: 'Delete chord' }));
  expect(text()).toBe('abc');
  expect(screen.queryByRole('button', { name: 'Delete chord' })).not.toBeInTheDocument();
});

it('undoes one move at a time', () => {
  const { container } = renderDoc('[C]abc d');
  fireEvent.click(screen.getByRole('button', { name: 'Chord C' }));
  fireEvent.click(letter(container, 7));
  fireEvent.click(screen.getByRole('button', { name: 'Move chord right' }));
  expect(text()).toBe('abc d[C]');
  act(() => { undo(view); });
  expect(text()).toBe('abc [C]d');
});

it('adds a chord where a letter is tapped with nothing picked', () => {
  const { container } = renderDoc('[G]grace');
  fireEvent.click(letter(container, 5));
  fireEvent.change(screen.getByRole('textbox', { name: 'Chord name' }), { target: { value: 'A / Db' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add chord' }));
  expect(text()).toBe('[G]gr[A/C#]ace');
});

it('shows directives as plain lines that cannot be tapped', () => {
  const { container } = renderDoc('{title: Song}\n[C]a');
  expect(screen.getByText('{title: Song}')).toBeInTheDocument();
  expect(letter(container, 0)).toBeNull();
});
