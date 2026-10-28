import type { ReactNode, SyntheticEvent } from 'react';
import { Button } from '@mantine/core';

interface ChordKeyProps {
  label: string;
  onPress: () => void;
  children: ReactNode;
  /** Styled as a chord (amber) rather than a plain key. */
  chord?: boolean;
  pressed?: boolean;
}

// Pressing a key must not take focus from the editor, or the on-screen keyboard closes.
const keepFocus = (event: SyntheticEvent) => event.preventDefault();

/** A 44px touch key for the chord bars. */
export function ChordKey({ label, onPress, children, chord = false, pressed }: ChordKeyProps) {
  return (
    <Button h={44} miw={44} px={10} style={{ flexShrink: 0 }} variant={chord ? 'light' : 'default'} color={chord ? 'var(--chord)' : undefined} ff="var(--font-mono)"
      aria-label={label} aria-pressed={pressed} title={label} onPointerDown={keepFocus} onMouseDown={keepFocus} onClick={onPress}>
      {children}
    </Button>
  );
}
