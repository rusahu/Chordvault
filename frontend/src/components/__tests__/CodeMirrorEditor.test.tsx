import { act, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { EditorView, runScopeHandlers } from '@codemirror/view';
import { undo, redo } from '@codemirror/commands';
import { CodeMirrorEditor } from '../CodeMirrorEditor';

function editor(container: HTMLElement) {
  return EditorView.findFromDOM(container.querySelector('.cm-editor')!)!;
}

const Scheme = ({ dark, children }: { dark: boolean; children: ReactNode }) =>
  <MantineProvider forceColorScheme={dark ? 'dark' : 'light'} env="test">{children}</MantineProvider>;

it.each([false, true])('preserves edits, selection and undo when the color scheme changes from dark=%s', (dark) => {
  const original = '[C]Amazing grace 奇異恩典';
  const changed = `${original}\n[G]How sweet the sound`;
  const onChange = vi.fn();
  const { container, rerender } = render(<Scheme dark={dark}><CodeMirrorEditor value={original} onChange={onChange} /></Scheme>);
  const view = editor(container);
  expect(view.state.facet(EditorView.darkTheme)).toBe(dark);
  act(() => view.dispatch({ changes: { from: original.length, insert: changed.slice(original.length) }, selection: { anchor: 3, head: 10 } }));
  rerender(<Scheme dark={!dark}><CodeMirrorEditor value={changed} onChange={onChange} /></Scheme>);
  const current = editor(container);
  expect(current.state.facet(EditorView.darkTheme)).toBe(!dark);
  expect(current.state.doc.toString()).toBe(changed);
  expect(current.state.selection.main.anchor).toBe(3);
  expect(current.state.selection.main.head).toBe(10);
  expect(current).toBe(view);
  act(() => { expect(undo(current)).toBe(true); });
  expect(current.state.doc.toString()).toBe(original);
  act(() => { expect(redo(current)).toBe(true); });
  expect(current.state.doc.toString()).toBe(changed);
});

it('uses the latest callback and accepts external content without recreating the editor', () => {
  const oldChange = vi.fn();
  const newChange = vi.fn();
  const { container, rerender } = render(<CodeMirrorEditor value="[C]Grace" onChange={oldChange} />);
  const view = editor(container);
  rerender(<CodeMirrorEditor value="[D]恩典" onChange={newChange} />);
  expect(editor(container)).toBe(view);
  expect(view.state.doc.toString()).toBe('[D]恩典');
  act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: '!' } }));
  expect(newChange).toHaveBeenLastCalledWith('[D]恩典!');
  expect(oldChange).not.toHaveBeenCalled();
});

it('names the text box and focuses it when asked', () => {
  render(<CodeMirrorEditor value="[C]a" onChange={vi.fn()} ariaLabel="Setlist chord sheet" autoFocus />);
  const box = screen.getByRole('textbox', { name: 'Setlist chord sheet' });
  expect(box).toHaveClass('cm-content');
  expect(document.activeElement).toBe(box);
});

it('hands its view out after mount and takes it back on unmount', () => {
  const onViewReady = vi.fn();
  const { container, unmount } = render(<CodeMirrorEditor value="[C]a" onChange={vi.fn()} onViewReady={onViewReady} />);
  expect(onViewReady).toHaveBeenLastCalledWith(editor(container));
  unmount();
  expect(onViewReady).toHaveBeenLastCalledWith(null);
});

function typeAt(view: EditorView, pos: number, text: string) {
  act(() => {
    view.dispatch({ selection: { anchor: pos } });
    const insert = () => view.state.update({ changes: { from: pos, insert: text }, selection: { anchor: pos + text.length }, userEvent: 'input.type' });
    if (!view.state.facet(EditorView.inputHandler).some((handler) => handler(view, pos, pos, text, insert))) view.dispatch(insert());
  });
}

const cursorOf = (view: EditorView) => view.state.selection.main.head;

it.each([['before a word', 'Amazing'], ['before Chinese', '奇異恩典'], ['at the end', '']])('typing [ %s adds ] with the cursor between', (_, text) => {
  const { container } = render(<CodeMirrorEditor value={text} onChange={vi.fn()} />);
  const view = editor(container);
  typeAt(view, 0, '[');
  expect(view.state.doc.toString()).toBe(`[]${text}`);
  expect(cursorOf(view)).toBe(1);
});

it('typing ] in front of ] steps over it', () => {
  const { container } = render(<CodeMirrorEditor value="[Am]x" onChange={vi.fn()} />);
  const view = editor(container);
  typeAt(view, 3, ']');
  expect(view.state.doc.toString()).toBe('[Am]x');
  expect(cursorOf(view)).toBe(4);
});

it('Backspace between [ and ] removes both', () => {
  const { container } = render(<CodeMirrorEditor value="a[]b" onChange={vi.fn()} />);
  const view = editor(container);
  act(() => { view.dispatch({ selection: { anchor: 2 } }); });
  act(() => { runScopeHandlers(view, new KeyboardEvent('keydown', { key: 'Backspace' }), 'editor'); });
  expect(view.state.doc.toString()).toBe('ab');
});

it('leaves ( and quotes alone', () => {
  const { container } = render(<CodeMirrorEditor value="" onChange={vi.fn()} />);
  const view = editor(container);
  typeAt(view, 0, '(');
  typeAt(view, 1, '"');
  expect(view.state.doc.toString()).toBe('("');
});
