import type { ReactNode } from 'react';
import { Group, ScrollArea, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconArrowsExchange, IconChevronLeft, IconChevronRight, IconSearch, IconX } from '@tabler/icons-react';
import type { Command, EditorView } from '@codemirror/view';
import { cursorCharLeft, cursorCharRight } from '@codemirror/commands';
import { openSearchPanel } from '@codemirror/search';
import { deleteChord, insertText, moveChord } from '../lib/chordCommands';
import { startChordChange } from '../lib/chordCompletion';
import type { ChordToken } from '../lib/chordTokens';
import { useI18n } from '../context/I18nContext';
import { ChordKey } from './ChordKey';
import { useHeightVar } from '../hooks/useHeightVar';

interface ChordBarProps {
  view: EditorView;
  chord: ChordToken | null;
  /** What is wrong at the cursor, if anything. */
  problem?: string | null;
}

/** Touch-screen keys for chords: what phone keyboards bury on the symbols layer, plus cursor and chord nudges. */
export function ChordBar({ view, chord, problem }: ChordBarProps) {
  const { t } = useI18n();
  const touch = useMediaQuery('(pointer: coarse)', false, { getInitialValueInEffect: false });
  // CodeMirror's find panel sticks below this bar.
  const ref = useHeightVar<HTMLDivElement>('--chord-bar-h');
  if (!touch) return null;

  const key = (label: string, command: Command, children: ReactNode, chordKey = false) =>
    <ChordKey key={label} label={label} chord={chordKey} onPress={() => command(view)}>{children}</ChordKey>;

  return (
    <ScrollArea ref={ref} type="never" className="chord-bar">
      {/* Chord keys come first: on a phone the bar is wider than the screen and they matter most. */}
      <Group gap={6} wrap="nowrap" p={6}>
        {chord && <>
          {key(t('chordBar.moveLeft'), moveChord(-1), <>‹ {chord.name}</>, true)}
          {key(t('chordBar.moveRight'), moveChord(1), <>{chord.name} ›</>, true)}
          {key(t('chordBar.change'), startChordChange, <IconArrowsExchange size={20} aria-hidden />, true)}
          {key(t('chordBar.delete'), deleteChord, <IconX size={20} aria-hidden />, true)}
        </>}
        {key(t('chordBar.brackets'), insertText('[]', 1), '[ ]')}
        {key(t('chordBar.sharp'), insertText('#'), '#')}
        {key(t('chordBar.flat'), insertText('b'), 'b')}
        {key(t('chordBar.slash'), insertText('/'), '/')}
        {key(t('chordBar.minor'), insertText('m'), 'm')}
        {key(t('chordBar.cursorLeft'), cursorCharLeft, <IconChevronLeft size={20} aria-hidden />)}
        {key(t('chordBar.cursorRight'), cursorCharRight, <IconChevronRight size={20} aria-hidden />)}
        {key(t('chordBar.search'), openSearchPanel, <IconSearch size={20} aria-hidden />)}
      </Group>
      {problem && <Text size="sm" c="var(--chord)" px={10} pb={6}>{problem}</Text>}
    </ScrollArea>
  );
}
