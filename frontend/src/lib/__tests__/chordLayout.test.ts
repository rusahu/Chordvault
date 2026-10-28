import { chordLayout, lineWords } from '../chordLayout';

const segs = (text: string, line = 0) => {
  const l = chordLayout(text)[line];
  if (l.kind !== 'lyrics') throw new Error('not a lyrics line');
  return l.segments.map((s) => [s.chord?.name ?? null, s.text, s.from]);
};

it('pairs each chord with the lyrics after it, with document offsets', () => {
  expect(segs('[G]Amazing [D/F#]grace')).toEqual([['G', 'Amazing ', 3], ['D/F#', 'grace', 17]]);
});

it('keeps lyrics before the first chord, including mid-word chords', () => {
  expect(segs('som[E]ething')).toEqual([[null, 'som', 0], ['E', 'ething', 6]]);
});

it('marks directives, comments and blank lines as other, with offsets that continue', () => {
  const layout = chordLayout('{start_of_chorus}\n# note\n\n[C]a');
  expect(layout.slice(0, 3).map((l) => [l.kind, l.from])).toEqual([['other', 0], ['other', 18], ['other', 25]]);
  expect(layout[3]).toMatchObject({ kind: 'lyrics', from: 26, to: 30 });
});

it('keeps both chords on a chord-only line', () => {
  expect(segs('[G] [D]')).toEqual([['G', ' ', 3], ['D', '', 7]]);
});

it('counts Chinese characters one position each', () => {
  expect(segs('[C]奇異[G]恩典')).toEqual([['C', '奇異', 3], ['G', '恩典', 8]]);
});

describe('lineWords', () => {
  const words = (text: string) => {
    const l = chordLayout(text)[0];
    if (l.kind !== 'lyrics') throw new Error('not a lyrics line');
    return lineWords(l.segments).map((w) => w.map((p) => `${p.chord ? `[${p.chord.name}]` : ''}${p.text}@${p.from}`).join('|'));
  };

  it('keeps a word whole across a mid-word chord, so it cannot wrap apart', () => {
    expect(words('the som[E]ething line')).toEqual(['the@0', ' @3', 'som@4|[E]ething@10', ' @16', 'line@17']);
  });

  it('lets each Chinese character wrap on its own', () => {
    expect(words('[C]奇異[G]恩')).toEqual(['[C]奇@3', '異@4', '[G]恩@8']);
  });

  it('keeps chords on a chord-only line', () => {
    expect(words('[G] [D]')).toEqual(['[G] @3', '[D]@7']);
  });
});
