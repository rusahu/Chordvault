import { useCallback, useEffect, useRef, useState } from 'react';
import { checkPersistentStorage, requestPersistentStorage } from '../lib/persistentStorage';

export function usePersistentStorage(enabled: boolean) {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const latest = useRef(0);
  const asking = useRef(false);
  // Requests outrank silent checks: a check never overwrites a newer request, and is skipped while one awaits the user.
  useEffect(() => {
    if (!enabled || asking.current) return;
    const call = latest.current;
    void checkPersistentStorage().then(result => { if (call === latest.current) setPersisted(result); });
  }, [enabled]);
  const request = useCallback(async () => {
    const call = ++latest.current;
    asking.current = true;
    const result = await requestPersistentStorage();
    if (call === latest.current) {
      asking.current = false;
      setPersisted(result);
    }
    return result;
  }, []);
  return { persisted: enabled ? persisted : null, request };
}
