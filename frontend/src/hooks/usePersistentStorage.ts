import { useCallback, useEffect, useRef, useState } from 'react';
import { checkPersistentStorage, requestPersistentStorage } from '../lib/persistentStorage';

export function usePersistentStorage(enabled: boolean) {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const latest = useRef(0);
  const track = useCallback(async (run: () => Promise<boolean | null>) => {
    const call = ++latest.current;
    const result = await run();
    if (call === latest.current) setPersisted(result);
    return result;
  }, []);
  useEffect(() => {
    if (enabled) void track(checkPersistentStorage);
  }, [enabled, track]);
  const request = useCallback(() => track(requestPersistentStorage), [track]);
  return { persisted: enabled ? persisted : null, request };
}
