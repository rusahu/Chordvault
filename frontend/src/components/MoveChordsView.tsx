import { useMemo, useState, type MouseEvent } from 'react';
import { Box, Group, ScrollArea, Text, TextInput } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import type { TransactionSpec } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { chordLayout, lineWords, type LayoutLine } from '../lib/chordLayout';
import { chordAt, type ChordToken } from '../lib/chordTokens';
import { deleteChordToken, insertChordAt, moveChordBy, moveChordTo, renameChord } from '../lib/chordCommands';
import { suggestChords } from '../lib/chordSuggestions';
import { useI18n } from '../context/I18nContext';
import { ChordKey } from './ChordKey';

interface MoveChordsViewProps {
  view: EditorView;
  /** The editor text, as the editor last reported it. */
  content: string;
}

const sameChord = (a: ChordToken, b: ChordToken) => a.from === b.from && a.to === b.to && a.name === b.name;

/** One tappable position per character; the line end gets a blank one so a chord can go last. */
function Letters({ text, from, target }: { text: string; from: number; target: number | null }) {
  let pos = from;
  return [...text].map((ch) => {
    const at = pos;
    pos += ch.length;
    return <span key={at} data-pos={at} className={at === target ? 'move-target' : undefined}>{ch}</span>;
  });
}

/**
 * Touch-first chord placement: the song as chords over lyrics, with no text box (so no on-screen keyboard).
 * Tap a chord to pick it up and a letter to drop it there; tap a letter with nothing picked to add a chord.
 * Every change goes through the editor view, so the text stays the one source and Undo covers it.
 */
export function MoveChordsView({ view, content }: MoveChordsViewProps) {
  const { t, tReplace } = useI18n();
  const layout = useMemo(() => chordLayout(content), [content]);
  const [picked, setPicked] = useState<ChordToken | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [name, setName] = useState('');

  const suggestions = useMemo(() => suggestChords(content), [content]);
  const chords = layout.flatMap((line) => (line.kind === 'lyrics' ? line.segments.flatMap((s) => (s.chord ? [s.chord] : [])) : []));
  const current = picked && chords.find((c) => sameChord(c, picked));

  // Positions come from `content`; never apply them to an editor that has moved on since.
  const inSync = () => view.state.doc.toString() === content;

  const apply = (spec: TransactionSpec | null, keepPicked = true) => {
    if (!spec || !inSync()) return;
    view.dispatch(spec);
    setPicked(keepPicked ? chordAt(view.state, view.state.selection.main.head) : null);
  };

  const onSheetClick = (event: MouseEvent) => {
    const el = (event.target as Element).closest<HTMLElement>('[data-pos]');
    if (!el) return;
    const pos = Number(el.dataset.pos);
    if (!inSync()) return;
    if (current) apply(moveChordTo(view.state, current, pos));
    else { setTarget(pos); setName(''); }
  };

  const add = (chordName = name) => {
    if (target === null || !chordName.trim()) return;
    apply(insertChordAt(target, chordName.trim()), false);
    setTarget(null);
  };

  const chips = (use: (chordName: string) => void) => suggestions.map((s) => (
    <ChordKey key={s} chord label={tReplace('moveChords.use', { name: s })} onPress={() => use(s)}>{s}</ChordKey>
  ));

  const line = (l: LayoutLine) => l.kind === 'other'
    ? <div key={l.from} className="move-line move-other">{l.text}</div>
    : (
      <div key={l.from} className="move-line">
        {lineWords(l.segments).map((word) => (
          <span key={word[0].from} className="move-word">
            {word.map((s) => (
              <span key={s.from} className="move-seg">
                <span className="move-chord-row">
                  {s.chord && (
                    <button type="button" className="move-chord" aria-pressed={!!current && sameChord(current, s.chord)}
                      aria-label={tReplace('moveChords.chord', { name: s.chord.name })}
                      onClick={() => { setTarget(null); setPicked(current && sameChord(current, s.chord!) ? null : s.chord); }}>
                      {s.chord.name}
                    </button>
                  )}
                </span>
                <span className="move-lyric"><Letters text={s.text} from={s.from} target={target} /></span>
              </span>
            ))}
          </span>
        ))}
        <span className="move-seg">
          <span className="move-chord-row" />
          <span className="move-lyric"><span data-pos={l.to} className={l.to === target ? 'move-target' : undefined}>{'\u00a0'}</span></span>
        </span>
      </div>
    );

  return (
    <Box className="move-chords">
      <ScrollArea type="never" className="chord-bar">
        <Group gap={6} wrap="nowrap" p={6} mih={56}>
          {current ? <>
            <ChordKey chord label={t('chordBar.moveLeft')} onPress={() => apply(moveChordBy(view.state, current, -1))}>‹ {current.name}</ChordKey>
            <ChordKey chord label={t('chordBar.moveRight')} onPress={() => apply(moveChordBy(view.state, current, 1))}>{current.name} ›</ChordKey>
            <ChordKey chord label={t('chordBar.delete')} onPress={() => apply(deleteChordToken(current), false)}><IconX size={20} aria-hidden /></ChordKey>
            <ChordKey label={t('moveChords.done')} onPress={() => setPicked(null)}><IconCheck size={20} aria-hidden /></ChordKey>
            {chips((chordName) => apply(renameChord(current, chordName)))}
          </> : target !== null ? <>
            <ChordKey label={t('songEdit.cancel')} onPress={() => setTarget(null)}><IconX size={20} aria-hidden /></ChordKey>
            {chips(add)}
            {/* No autofocus: a chip covers most chords without opening the on-screen keyboard. */}
            <TextInput aria-label={t('moveChords.chordName')} placeholder={t('moveChords.chordName')} value={name} w={110} style={{ flexShrink: 0 }}
              onChange={(e) => setName(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
            <ChordKey chord label={t('moveChords.add')} onPress={() => add()}><IconCheck size={20} aria-hidden /></ChordKey>
          </> : (
            <Text size="sm" c="dimmed" px={4}>{t('moveChords.hint')}</Text>
          )}
        </Group>
      </ScrollArea>
      <div className="move-sheet" onClick={onSheetClick}>
        {layout.map(line)}
      </div>
    </Box>
  );
}
