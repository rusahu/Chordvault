import { useEffect, useRef } from 'react';

/** True while mounted. Check it after an await before touching state. */
export function useActiveRef() {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  return active;
}
