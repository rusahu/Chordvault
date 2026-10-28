import { chordProblems } from '../chordProblems';

const found = (text: string) => chordProblems(text).map((p) => [p.code, text.slice(p.from, p.to), p.name ?? null]);

it('reports positions after an emoji correctly', () => {
  expect(found('{title: x}\n😀 [Am b')).toEqual([['unclosed', '[Am b', null]]);
});

it('flags an unclosed bracket', () => {
  expect(found('{title: x}\n[Am lyric')).toEqual([['unclosed', '[Am lyric', null]]);
});

it('keeps flagging the rest of the song after a typo', () => {
  expect(found('{title: x}\n[G]a\n[Am b\n[Xq7]c')).toEqual([['unclosed', '[Am b', null], ['unknown', '[Xq7]', 'Xq7']]);
});

it.each(['[N.C.]', '[NC]', '[x]', '[%]', '[*Riff]', '[|]', '[Bbmaj]', '[Hm]', '[A / C#]', '[Chorus]', '[Verse 1]', '[]', '[F#m7b5]', '[G/B]'])('accepts %s', (chord) => {
  expect(found(`{title: x}\n${chord}la`)).toEqual([]);
});

it('flags a section start whose end does not match, and the stray end', () => {
  expect(found('{start_of_chrous}\n[G]a\n{end_of_chorus}')).toEqual([
    ['unmatchedStart', '{start_of_chrous}', 'chrous'],
    ['unmatchedEnd', '{end_of_chorus}', 'chorus'],
  ]);
});

it('pairs short forms and labelled sections', () => {
  expect(found('{soc}\n[G]a\n{eoc}\n{start_of_verse: Verse 1}\n[C]b\n{end_of_verse}')).toEqual([]);
  expect(found('{soc}\n[G]a')).toEqual([['unmatchedStart', '{soc}', 'chorus']]);
});

it('says nothing about chords-over-lyrics or Ultimate Guitar text', () => {
  expect(chordProblems('G       D\nAmazing grace\n[Am')).toEqual([]);
  expect(chordProblems('[Verse]\nG     D\nAmazing grace')).toEqual([]);
});

it('says nothing about a clean song', () => {
  expect(chordProblems('{title: x}\n{start_of_chorus}\n[G]Amazing [D/F#]grace\n{end_of_chorus}')).toEqual([]);
});
