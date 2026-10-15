import { showStatusNotification } from './notifications';

export function errorMessage(error: unknown, fallback = ''): string {
  const message = (error as { message?: unknown } | null | undefined)?.message;
  return (typeof message === 'string' && message) || fallback;
}

export const notifyError = (error: unknown, fallback?: string) => showStatusNotification(errorMessage(error, fallback), 'error');
