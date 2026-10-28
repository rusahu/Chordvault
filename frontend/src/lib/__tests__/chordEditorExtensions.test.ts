import { chordKeymap } from '../chordEditorExtensions';

it('moves chords with Alt+Arrow, but not with the Mac word-jump keys', () => {
  const bindings = chordKeymap.map((b) => [b.key, b.mac]);
  expect(bindings).toEqual([['Alt-ArrowLeft', 'Ctrl-Alt-ArrowLeft'], ['Alt-ArrowRight', 'Ctrl-Alt-ArrowRight']]);
});
