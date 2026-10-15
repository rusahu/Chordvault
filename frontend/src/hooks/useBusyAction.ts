import { useCallback, useRef, useState } from 'react';
import { notifyError } from '../lib/errors';

/** Runs one action at a time: a call while one is pending is ignored and returns false. */
export function useBusyAction() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (action: () => Promise<unknown>, onError: (error: unknown) => void = notifyError) => {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    try {
      await action();
      return true;
    } catch (error) {
      onError(error);
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, run };
}
