import { useCallback, useEffect, useRef } from 'react';
import { useOffline } from '../context/OfflineContext';

/** True when writes must be refused. Reads `navigator.onLine` at call time so handlers lock before React rerenders. */
export function useWriteLock() {
  const { readOnly } = useOffline();
  const locked = useRef(readOnly);
  useEffect(() => { locked.current = readOnly; }, [readOnly]);
  return useCallback(() => locked.current || navigator.onLine === false, []);
}
