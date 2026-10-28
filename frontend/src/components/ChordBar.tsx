import type { ReactNode, SyntheticEvent } from 'react';
import { Button, Group, ScrollArea } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react';
import type { Command, EditorView } from '@codemirror/view';
import { cursorCharLeft, cursorCharRight } from '@codemirror/commands';
import { deleteChord, insertText, moveChord } from '../lib/chordCommands';
import type { ChordToken } from '../lib/chordTokens';
import { useI18n } from '../context/I18nContext';

interface ChordBarProps {
  view: EditorView;
  chord: ChordToken | null;
}

// Tapping a key must not take focus from the editor, or the on-screen keyboard closes.
const keepFocus = (event: SyntheticEvent) => event.preventDefault();

/** Touch-screen keys for chords: what phone keyboards bury on the symbols layer, plus cursor and chord nudges. */
export function ChordBar({ view, chord }: ChordBarProps) {
  const { t } = useI18n();
  const touch = useMediaQuery('(pointer: coarse)', false, { getInitialValueInEffect: false });
  if (!touch) return null;

  const key = (label: string, command: Command, children: ReactNode, chordKey = false) => (
    <Button key={label} h={44} miw={44} px={10} style={{ flexShrink: 0 }} variant={chordKey ? 'light' : 'default'} color={chordKey ? 'var(--chord)' : undefined} ff="var(--font-mono)"
      aria-label={label} title={label} onPointerDown={keepFocus} onMouseDown={keepFocus} onClick={() => command(view)}>
      {children}
    </Button>
  );

  return (
    <ScrollArea type="never" className="chord-bar">
      {/* Chord keys come first: on a phone the bar is wider than the screen and they matter most. */}
      <Group gap={6} wrap="nowrap" p={6}>
        {chord && <>
          {key(t('chordBar.moveLeft'), moveChord(-1), <>‹ {chord.name}</>, true)}
          {key(t('chordBar.moveRight'), moveChord(1), <>{chord.name} ›</>, true)}
          {key(t('chordBar.delete'), deleteChord, <IconX size={20} aria-hidden />, true)}
        </>}
        {key(t('chordBar.brackets'), insertText('[]', 1), '[ ]')}
        {key(t('chordBar.sharp'), insertText('#'), '#')}
        {key(t('chordBar.flat'), insertText('b'), 'b')}
        {key(t('chordBar.slash'), insertText('/'), '/')}
        {key(t('chordBar.minor'), insertText('m'), 'm')}
        {key(t('chordBar.cursorLeft'), cursorCharLeft, <IconChevronLeft size={20} aria-hidden />)}
        {key(t('chordBar.cursorRight'), cursorCharRight, <IconChevronRight size={20} aria-hidden />)}
      </Group>
    </ScrollArea>
  );
}
