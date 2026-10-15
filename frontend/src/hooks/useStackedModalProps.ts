import { useModals } from '@mantine/modals';

/** Props for a Modal that may sit under a @mantine/modals confirm; `locked` keeps it open while it works. */
export function useStackedModalProps({ locked = false } = {}) {
  const stacked = useModals().modals.length > 0;
  return { trapFocus: !stacked, closeOnEscape: !locked && !stacked, closeOnClickOutside: !locked && !stacked };
}
