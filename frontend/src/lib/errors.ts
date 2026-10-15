import type { ReactNode } from 'react';
import { modals } from '@mantine/modals';
import { showStatusNotification } from './notifications';

export function errorMessage(error: unknown, fallback = ''): string {
  const message = (error as { message?: unknown } | null | undefined)?.message;
  return (typeof message === 'string' && message) || fallback;
}

export const notifyError = (error: unknown, fallback?: string) => showStatusNotification(errorMessage(error, fallback), 'error');

/** Asks first, then runs; a failed run shows as an error notification. */
export const confirmAction = (message: ReactNode, run: () => unknown) => modals.openConfirmModal({
  children: message,
  onConfirm: () => Promise.resolve().then(run).catch((error) => notifyError(error)),
});
