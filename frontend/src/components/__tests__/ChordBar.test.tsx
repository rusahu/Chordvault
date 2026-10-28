import { act, fireEvent, render, screen } from '@testing-library/react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { history } from '@codemirror/commands';
import { ChordBar } from '../ChordBar';
import { CodeMirrorEditor } from '../CodeMirrorEditor';
import { chordAt } from '../../lib/chordTokens';

vi.mock('../../context/I18nContext', () => import('../../test/i18nMock'));

let coarse = true;
const original = window.matchMedia;
beforeEach(() => {
  coarse = true;
  window.matchMedia = vi.fn((media: string) => ({
    matches: media === '(pointer: coarse)' && coarse, media, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => { window.matchMedia = original; });

const views: EditorView[] = [];
afterEach(() => views.splice(0).forEach((view) => view.destroy()));

function bar(doc: string, cursor: number) {
  const view = new EditorView({ state: EditorState.create({ doc, selection: { anchor: cursor }, extensions: [history()] }) });
  views.push(view);
  const utils = render(<ChordBar view={view} chord={chordAt(view.state, cursor)} />);
  return { view, ...utils };
}

const text = (view: EditorView) => view.state.doc.toString();
const ALWAYS = ['Chord brackets', 'Sharp', 'Flat', 'Slash', 'Minor', 'Cursor left', 'Cursor right'];
const IN_CHORD = ['Move chord left', 'Move chord right', 'Change chord', 'Delete chord'];

it('always shows the typing keys, and the chord keys only in a chord', () => {
  bar('[C]Amazing', 6);
  for (const name of ALWAYS) expect(screen.getByRole('button', { name })).toBeInTheDocument();
  for (const name of IN_CHORD) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
});

it('moves the chord the cursor is in', () => {
  const { view } = bar('[C]Amazing', 1);
  for (const name of IN_CHORD) expect(screen.getByRole('button', { name })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Move chord right' }));
  expect(text(view)).toBe('A[C]mazing');
});

it('deletes the chord the cursor is in', () => {
  const { view } = bar('a[D/F#]b', 3);
  fireEvent.click(screen.getByRole('button', { name: 'Delete chord' }));
  expect(text(view)).toBe('ab');
});

it('moves only the cursor with the cursor keys', () => {
  const { view } = bar('abc', 2);
  fireEvent.click(screen.getByRole('button', { name: 'Cursor right' }));
  expect(view.state.selection.main.head).toBe(3);
  fireEvent.click(screen.getByRole('button', { name: 'Cursor left' }));
  expect(view.state.selection.main.head).toBe(2);
  expect(text(view)).toBe('abc');
});

it.each([['Chord brackets', '[]', 1], ['Sharp', '#', 1], ['Flat', 'b', 1], ['Slash', '/', 1], ['Minor', 'm', 1]])('%s types %s at the cursor', (name, typed, cursor) => {
  const { view } = bar('', 0);
  fireEvent.click(screen.getByRole('button', { name }));
  expect(text(view)).toBe(typed);
  expect(view.state.selection.main.head).toBe(cursor);
});

it('keeps focus in the editor when a key is pressed', () => {
  bar('[C]a', 1);
  for (const button of screen.getAllByRole('button')) {
    for (const type of ['pointerdown', 'mousedown'] as const) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      button.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
  }
});

it('is not shown without a touch screen', () => {
  coarse = false;
  bar('[C]a', 1);
  expect(screen.queryByRole('button', { name: 'Sharp' })).not.toBeInTheDocument();
});

it('appears in the editor and follows the cursor into a chord', () => {
  const { container } = render(<CodeMirrorEditor value="Amazing [C]grace" onChange={vi.fn()} />);
  const view = EditorView.findFromDOM(container.querySelector('.cm-editor')!)!;
  expect(screen.getByRole('button', { name: 'Sharp' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Move chord right' })).not.toBeInTheDocument();
  act(() => view.dispatch({ selection: { anchor: 9 } }));
  fireEvent.click(screen.getByRole('button', { name: 'Move chord right' }));
  expect(view.state.doc.toString()).toBe('Amazing g[C]race');
});

it('puts the chord keys first, where a phone shows them without scrolling', () => {
  bar('[C]a', 1);
  expect(screen.getAllByRole('button').slice(0, IN_CHORD.length).map((b) => b.getAttribute('aria-label'))).toEqual(IN_CHORD);
});
