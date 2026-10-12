import { useEffect } from 'react';
import { useDocumentVisibility } from '@mantine/hooks';

export function useWakeLock(active: boolean) {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  const visibility = useDocumentVisibility();
  useEffect(() => {
    if (!supported || !active || visibility !== 'visible') return;
    let wanted = true;
    let sentinel: WakeLockSentinel | null = null;
    navigator.wakeLock.request('screen')
      .then(lock => { if (wanted) sentinel = lock; else void lock.release(); })
      .catch(() => {});
    return () => {
      wanted = false;
      void sentinel?.release().catch(() => {});
    };
  }, [supported, active, visibility]);
  return { supported };
}
