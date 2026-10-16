import type { KeyboardEvent } from 'react';

/** Props that make a card act as a button: focusable, Enter and Space open it, keys pressed in its own controls do not. */
export const cardButtonProps = (activate: () => void) => ({
  role: 'button' as const,
  tabIndex: 0,
  onClick: activate,
  onKeyDown: (event: KeyboardEvent) => {
    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      activate();
    }
  },
});
