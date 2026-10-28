import { EditorState } from '@codemirror/state';
import { chordAt, chordTokens, cleanChordName } from '../chordTokens';

const at = (doc: string, pos: number) => chordAt(EditorState.create({ doc }), pos);

describe('chordTokens', () => {
  it('finds each chord with its range and name', () => {
    expect(chordTokens('[G]Amazing [D/F#]grace')).toEqual([
      { from: 0, to: 3, name: 'G' },
      { from: 11, to: 17, name: 'D/F#' },
    ]);
  });

  it('adds the offset and ignores an unclosed bracket', () => {
    expect(chordTokens('a[Am b [C]', 10)).toEqual([{ from: 17, to: 20, name: 'C' }]);
  });
});

describe('chordAt', () => {
  const doc = 'x\n[G]Amazing [D/F#]grace';

  it.each([[2, 'on ['], [3, 'inside'], [5, 'right after ]']])('finds the chord at %i (%s)', (pos) => {
    expect(at(doc, pos)).toEqual({ from: 2, to: 5, name: 'G' });
  });

  it('prefers the chord that starts at the cursor over the one that ends there', () => {
    expect(at('[G][D]', 3)).toEqual({ from: 3, to: 6, name: 'D' });
  });

  it('returns null in lyrics and in an unclosed bracket', () => {
    expect(at(doc, 8)).toBeNull();
    expect(at('[Am b', 2)).toBeNull();
  });
});

describe('cleanChordName', () => {
  it('closes slash spaces and uses the preferred spelling', () => {
    expect(cleanChordName('A / Db')).toBe('A/C#');
    expect(cleanChordName('A#m7')).toBe('Bbm7');
  });
});
