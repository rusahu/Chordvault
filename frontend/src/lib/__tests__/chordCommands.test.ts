import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { history, undo } from '@codemirror/commands';
import { deleteChord, insertChordAt, moveChord, moveChordTo, renameChord } from '../chordCommands';
import { chordAt } from '../chordTokens';

const views: EditorView[] = [];
afterEach(() => views.splice(0).forEach((view) => view.destroy()));

function viewAt(doc: string, cursor: number) {
  const view = new EditorView({ state: EditorState.create({ doc, selection: { anchor: cursor }, extensions: [history()] }) });
  views.push(view);
  return view;
}

const text = (view: EditorView) => view.state.doc.toString();

describe('moveChord', () => {
  it.each([
    ['[C]Amazing', 1, 1, 'A[C]mazing'],
    ['奇[C]異', 2, 1, '奇異[C]'],
    ['[G][D]x', 1, 1, '[D][G]x'],
    ['[C]😀a', 1, 1, '😀[C]a'],
    ['ab[C]', 3, -1, 'a[C]b'],
    ['[D][G]x', 4, -1, '[G][D]x'],
  ])('%s moves to give the expected text', (doc, cursor, direction, expected) => {
    const view = viewAt(doc, cursor);
    expect(moveChord(direction as 1 | -1)(view)).toBe(true);
    expect(text(view)).toBe(expected);
  });

  it('keeps the cursor inside the moved chord', () => {
    const view = viewAt('[Am]xy', 2);
    moveChord(1)(view);
    expect(chordAt(view.state, view.state.selection.main.head)?.name).toBe('Am');
    expect(view.state.selection.main.head).toBe(3);
  });

  it('stops at the end of the line without crossing it', () => {
    const view = viewAt('a[C]\nb', 2);
    expect(moveChord(1)(view)).toBe(true);
    expect(text(view)).toBe('a[C]\nb');
    const start = viewAt('[C]a', 1);
    expect(moveChord(-1)(start)).toBe(true);
    expect(text(start)).toBe('[C]a');
  });

  it('does nothing outside a chord so the normal key action runs', () => {
    const view = viewAt('[C]Amazing', 6);
    expect(moveChord(1)(view)).toBe(false);
  });

  it('makes each quick move its own undo step', () => {
    const view = viewAt('[C]abc', 1);
    moveChord(1)(view);
    moveChord(1)(view);
    expect(text(view)).toBe('ab[C]c');
    undo(view);
    expect(text(view)).toBe('a[C]bc');
  });
});

describe('deleteChord', () => {
  it('removes the whole chord', () => {
    const view = viewAt('[G]a [D/F#]b', 7);
    expect(deleteChord(view)).toBe(true);
    expect(text(view)).toBe('[G]a b');
  });
});

describe('moveChordTo', () => {
  it('drops a chord before the given letter, later on its own line', () => {
    const state = EditorState.create({ doc: '[G]Amazing grace' });
    const token = chordAt(state, 1)!;
    expect(state.update(moveChordTo(state, token, 11)).state.doc.toString()).toBe('Amazing [G]grace');
  });

  it('moves a chord into the middle of a word', () => {
    const state = EditorState.create({ doc: 'som[E]ething' });
    const token = chordAt(state, 4)!;
    expect(state.update(moveChordTo(state, token, 9)).state.doc.toString()).toBe('someth[E]ing');
  });
});

describe('insertChordAt', () => {
  it('inserts a cleaned chord', () => {
    const state = EditorState.create({ doc: 'grace' });
    expect(state.update(insertChordAt(0, 'A / Db')).state.doc.toString()).toBe('[A/C#]grace');
  });
});

describe('renameChord', () => {
  it('swaps the name and leaves the cursor inside the chord', () => {
    const state = EditorState.create({ doc: 'a[D]b' });
    const next = state.update(renameChord(chordAt(state, 2)!, 'A / Db')).state;
    expect(next.doc.toString()).toBe('a[A/C#]b');
    expect(chordAt(next, next.selection.main.head)?.name).toBe('A/C#');
  });
});
