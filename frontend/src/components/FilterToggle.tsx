import { ActionIcon } from '@mantine/core';
import type { ReactNode } from 'react';

interface FilterToggleProps {
  label: string;
  icon: ReactNode;
  pressed: boolean;
  active?: boolean;
  onToggle: () => void;
}

export function FilterToggle({ label, icon, pressed, active = pressed, onToggle }: FilterToggleProps) {
  return (
    <ActionIcon size="input-sm" variant={active ? 'filled' : 'default'} aria-label={label} aria-pressed={pressed} title={label} onClick={onToggle}>
      {icon}
    </ActionIcon>
  );
}
