import { useCallback } from 'react';
import { useBusyAction } from './useBusyAction';
import { notifyError } from '../lib/errors';
import { showStatusNotification as toast } from '../lib/notifications';

/** One PDF export at a time; reports characters the bundled fonts could not draw. */
export function usePdfExport() {
  const { run } = useBusyAction();
  return useCallback((label: string, build: () => Promise<string[]>) => run(async () => {
    const missing = await build();
    if (missing.length) toast(`${label}, but these characters may be missing: ${missing.slice(0, 8).join(' ')}`, 'error');
    else toast(label, 'success');
  }, (e) => notifyError(e, 'PDF export failed')), [run]);
}
