import { act, renderHook } from '@testing-library/react';
import { useLocalSetlists } from '../useLocalSetlists';

const KEY = 'cv_local_setlists';
const entry = (song_id: number) => ({ song_id, title: `S${song_id}`, artist: '', target_key: null, nashville: 0 });

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

it('writes nothing to an existing setlist while locked (characterization)', () => {
  localStorage.setItem(KEY, JSON.stringify([{ id: 'local_1', name: 'SL', entries: [entry(1), entry(2), entry(3)] }]));
  const before = localStorage.getItem(KEY);
  const { result } = renderHook(() => useLocalSetlists());
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  act(() => {
    expect(result.current.addEntry('local_1', entry(4))).toBe(false);
    expect(result.current.reorderEntries('local_1', [2, 1, 0])).toBe(false);
    result.current.rename('local_1', 'X');
    result.current.removeEntry('local_1', 0);
    result.current.updateEntry('local_1', 0, { target_key: 'D' });
    result.current.remove('local_1');
  });
  expect(localStorage.getItem(KEY)).toBe(before);
});
