import { act, renderHook } from '@testing-library/react';
import { useLocalSetlists } from '../useLocalSetlists';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it('refuses local setlist writes while the browser is offline', () => {
  const { result } = renderHook(() => useLocalSetlists());
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  let created: unknown;
  act(() => { created = result.current.create('Sunday'); });
  expect(created).toBeNull();
  expect(result.current.setlists).toEqual([]);
});
