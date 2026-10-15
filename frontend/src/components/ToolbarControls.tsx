import { ActionIcon, Button, Indicator, Popover, Text, VisuallyHidden, type MantineSize } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconArrowsMaximize, IconChevronDown, IconLayoutColumns } from '@tabler/icons-react';
import { useEffect, type ReactNode } from 'react';
import { KeyPicker } from './KeyPicker';

export type ControlSize = Extract<MantineSize, 'md' | 'lg'>;

/** A small dot marking a setting changed for this song only. */
function OverrideDot({ on, children, ...rest }: { on?: boolean; children: ReactNode; role?: string; 'aria-label'?: string }) {
  return (
    <Indicator inline disabled={!on} size={7} offset={5} withBorder data-overridden={on || undefined} {...rest}>
      {children}
    </Indicator>
  );
}

/** Joined buttons, named for assistive tech, with the override dot. */
function ControlGroup({ label, overridden, children }: { label: string; overridden?: boolean; children: ReactNode }) {
  return (
    <OverrideDot on={overridden} role="group" aria-label={label}>
      <Button.Group>{children}</Button.Group>
    </OverrideDot>
  );
}

interface KeyGroupProps {
  currentKey: string;
  onPickKey: (key: string) => void;
  isModified?: boolean;
  onSaveOnline?: () => void;
  onSaveLocal?: () => void;
  renderKey?: number | string;
  nashville?: boolean;
  nashvilleDisabled?: boolean;
  onNashvilleChange?: (checked: boolean) => void;
  numOverridden?: boolean;
  size?: ControlSize;
  dense?: boolean;
  /** Show only the key letter; "Key" stays in the accessible name. */
  keyOnly?: boolean;
}

export function KeyGroup({ currentKey, onPickKey, isModified, onSaveOnline, onSaveLocal, renderKey, nashville, nashvilleDisabled, onNashvilleChange, numOverridden, size = 'md', dense, keyOnly }: KeyGroupProps) {
  const [opened, { toggle, close }] = useDisclosure(false);
  useEffect(close, [renderKey, close]);
  const closeAfter = (fn?: () => void) => fn && (() => { fn(); close(); });

  return (
    <ControlGroup label="Key and notation" overridden={numOverridden}>
      <Popover opened={opened} onChange={(o) => { if (!o) close(); }} trapFocus returnFocus width="min(90vw, 440px)">
        <Popover.Target>
          <Button size={size} px={dense ? 'xs' : undefined} data-testid="key-display" opacity={nashville ? 0.5 : undefined} onClick={toggle}
            rightSection={<IconChevronDown size={16} aria-hidden />}>
            <span>{keyOnly ? <VisuallyHidden>Key </VisuallyHidden> : 'Key '}<Text span inherit fw={600} c="var(--cv-chord)" ff="var(--font-chord)">{currentKey || '?'}</Text></span>
          </Button>
        </Popover.Target>
        <Popover.Dropdown>
          <KeyPicker currentKey={currentKey} onPickKey={onPickKey} visible={opened} isModified={isModified}
            onSaveOnline={closeAfter(onSaveOnline)} onSaveLocal={closeAfter(onSaveLocal)} />
        </Popover.Dropdown>
      </Popover>
      {onNashvilleChange && (
        <Button size={size} px={dense ? 'xs' : undefined} variant={nashville ? 'filled' : undefined} aria-label="Number notation" aria-pressed={!!nashville}
          disabled={nashvilleDisabled} onClick={() => onNashvilleChange(!nashville)}>
          123
        </Button>
      )}
    </ControlGroup>
  );
}

export function TextSizeGroup({ onFontChange, overridden, size = 'md', dense }: { onFontChange: (delta: number) => void; overridden?: boolean; size?: ControlSize; dense?: boolean }) {
  return (
    <ControlGroup label="Text size" overridden={overridden}>
      <Button size={size} px={dense ? 'xs' : undefined} aria-label="Decrease font size" onClick={() => onFontChange(-1)}>A&#8722;</Button>
      <Button size={size} px={dense ? 'xs' : undefined} aria-label="Increase font size" onClick={() => onFontChange(1)}>A+</Button>
    </ControlGroup>
  );
}

export function FitButton({ onAutoFit, size = 'md', dense, iconOnly }: { onAutoFit: () => void; size?: ControlSize; dense?: boolean; iconOnly?: boolean }) {
  if (iconOnly) {
    return (
      <ActionIcon size={`input-${size}`} variant="light" aria-label="Fit" title="Auto-fit for this screen (one-time)" onClick={onAutoFit}>
        <IconArrowsMaximize size={20} aria-hidden />
      </ActionIcon>
    );
  }
  return (
    <Button size={size} px={dense ? 'xs' : undefined} onClick={onAutoFit} title="Auto-fit for this screen (one-time)" leftSection={dense ? undefined : <IconArrowsMaximize size={18} aria-hidden />}>
      Fit
    </Button>
  );
}

export function ColumnsToggle({ twoCol, onTwoColToggle, overridden, size = 'md' }: { twoCol: boolean; onTwoColToggle: () => void; overridden?: boolean; size?: ControlSize }) {
  return (
    <OverrideDot on={overridden}>
      <ActionIcon size={`input-${size}`} variant={twoCol ? 'filled' : 'light'} aria-label="Multi-column layout" aria-pressed={twoCol}
        onClick={onTwoColToggle} title={twoCol ? 'Single column' : 'Multi-column'}>
        <IconLayoutColumns size={20} aria-hidden />
      </ActionIcon>
    </OverrideDot>
  );
}
