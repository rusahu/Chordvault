import { renderHook } from '@testing-library/react';
import { useActiveRef } from '../useActiveRef';

it('is true while mounted and false after unmount', () => {
  const { result, unmount } = renderHook(() => useActiveRef());
  const active = result.current;
  expect(active.current).toBe(true);
  unmount();
  expect(active.current).toBe(false);
});
