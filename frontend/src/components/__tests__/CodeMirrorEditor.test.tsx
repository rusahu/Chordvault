import { act, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { EditorView } from '@codemirror/view';
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
