import { renderHook } from '@testing-library/react';
import { useWriteLock } from '../useWriteLock';

const { offline } = vi.hoisted(() => ({ offline: { readOnly: false } }));
vi.mock('../../context/OfflineContext', () => ({ useOffline: () => offline }));
afterEach(() => { offline.readOnly = false; vi.restoreAllMocks(); });

it('stays stable and follows read-only mode', () => {
  const hook = renderHook(() => useWriteLock());
  const isWriteLocked = hook.result.current;
  expect(isWriteLocked()).toBe(false);
  offline.readOnly = true;
  hook.rerender();
  expect(hook.result.current).toBe(isWriteLocked);
  expect(isWriteLocked()).toBe(true);
});

it('locks as soon as the browser reports offline, before any rerender', () => {
  const hook = renderHook(() => useWriteLock());
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  expect(hook.result.current()).toBe(true);
});
