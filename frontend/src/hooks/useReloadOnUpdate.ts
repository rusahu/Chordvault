import { useEffect } from 'react';

// Every open tab gets controllerchange when a new version takes over, however
// late it registered. Only the first install taking control skips the reload;
// a force-reloaded tab starts uncontrolled but still had an old version.
export function useReloadOnUpdate() {
  useEffect(() => {
    const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
    if (!sw) return;
    let replacing = !!sw.controller;
    void sw.getRegistration().then(r => { if (r?.active) replacing = true; }).catch(() => {});
    const onChange = () => {
      if (replacing) location.reload();
      replacing = true;
    };
    sw.addEventListener('controllerchange', onChange);
    return () => sw.removeEventListener('controllerchange', onChange);
  }, []);
}
