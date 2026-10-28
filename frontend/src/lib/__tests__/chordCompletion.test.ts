import { EditorState } from '@codemirror/state';
import { CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { chordCompletionSource } from '../chordCompletion';

function complete(doc: string, explicit = false) {
  const pos = doc.indexOf('|');
  const state = EditorState.create({ doc: doc.replace('|', '') });
  return chordCompletionSource(new CompletionContext(state, pos, explicit)) as CompletionResult | null;
}

const labels = (result: CompletionResult | null) => {
  const sorted = [...result!.options].sort((a, b) => (b.boost ?? 0) - (a.boost ?? 0));
  return sorted.map((o) => o.label);
};

it('offers song chords then key chords inside an empty chord', () => {
  const result = complete('{key: G}\n[D]a [|]b');
  expect(labels(result)).toEqual(['D', 'G', 'Am', 'Bm', 'C', 'Em', 'F#dim']);
  expect([result!.from, result!.to]).toEqual([15, 15]);
});

it('replaces the whole name when the cursor is in the middle of it', () => {
  const result = complete('{key: G}\n[A|m7]b');
  expect([result!.from, result!.to]).toEqual([10, 13]);
});

it('works in a chord that is not closed yet', () => {
  const result = complete('{key: G}\n[A|');
  expect([result!.from, result!.to]).toEqual([10, 11]);
});

it('offers nothing in lyrics', () => {
  expect(complete('{key: G}\n[G]Ama|zing')).toBeNull();
});

it('shows every option, unfiltered, when asked for explicitly (Change)', () => {
  expect(complete('{key: G}\n[E|m]a', true)!.filter).toBe(false);
  expect(complete('{key: G}\n[E|m]a')!.filter).not.toBe(false);
});

it('does not throw on chords over lyrics with no key', () => {
  expect(() => complete('G   D\nAmazing [|]')).not.toThrow();
});
