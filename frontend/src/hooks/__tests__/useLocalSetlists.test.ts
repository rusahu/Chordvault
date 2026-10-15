import { act, renderHook } from '@testing-library/react';
import { useLocalSetlists } from '../useLocalSetlists';
import { MAX_LOCAL_ENTRIES, MAX_LOCAL_SETLISTS } from '../../lib/constants';

const KEY = 'cv_local_setlists';
const stored = () => JSON.parse(localStorage.getItem(KEY) || '[]');
const entry = (song_id: number) => ({ song_id, title: `S${song_id}`, artist: '', target_key: null, nashville: 0 });
const seed = (entries = [entry(1), entry(2), entry(3)]) => localStorage.setItem(KEY, JSON.stringify([{ id: 'local_1', name: 'SL', entries }]));

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it('exposes only the operations the app uses', () => {
  const { result } = renderHook(() => useLocalSetlists());
  expect(Object.keys(result.current).sort()).toEqual(['addEntry', 'create', 'getOne', 'remove', 'removeEntry', 'rename', 'reorderEntries', 'setlists', 'updateEntry']);
});

it('creates up to the limit, then refuses (characterization)', () => {
  localStorage.setItem(KEY, JSON.stringify(Array.from({ length: MAX_LOCAL_SETLISTS - 1 }, (_, i) => ({ id: `local_${i}`, name: `${i}`, entries: [] }))));
  const { result } = renderHook(() => useLocalSetlists());
  let made: unknown;
  act(() => { made = result.current.create('Last'); });
  expect(made).toMatchObject({ id: expect.stringMatching(/^local_\d+$/), name: 'Last', entries: [] });
  expect(result.current.setlists).toHaveLength(MAX_LOCAL_SETLISTS);
  act(() => { made = result.current.create('Too many'); });
  expect(made).toBeNull();
  expect(stored()).toHaveLength(MAX_LOCAL_SETLISTS);
});

it('edits one setlist in storage and state (characterization)', () => {
  seed();
  const { result } = renderHook(() => useLocalSetlists());
  act(() => { result.current.rename('local_1', 'Renamed'); });
  act(() => { expect(result.current.addEntry('local_1', entry(4))).toBe(true); });
  act(() => { result.current.removeEntry('local_1', 0); });
  act(() => { result.current.updateEntry('local_1', 0, { target_key: 'D' }); });
  act(() => { expect(result.current.reorderEntries('local_1', [2, 1, 0])).toBe(true); });
  const expected = [{ id: 'local_1', name: 'Renamed', entries: [entry(4), entry(3), { ...entry(2), target_key: 'D' }] }];
  expect(stored()).toEqual(expected);
  expect(result.current.setlists).toEqual(expected);
});

it('refuses edits it cannot apply without writing (characterization)', () => {
  seed(Array.from({ length: MAX_LOCAL_ENTRIES }, (_, i) => entry(i)));
  const before = localStorage.getItem(KEY);
  const { result } = renderHook(() => useLocalSetlists());
  act(() => {
    expect(result.current.addEntry('local_1', entry(999))).toBe(false);
    expect(result.current.addEntry('missing', entry(1))).toBe(false);
    expect(result.current.reorderEntries('local_1', [0, 0])).toBe(false);
    result.current.updateEntry('local_1', MAX_LOCAL_ENTRIES, { target_key: 'D' });
    result.current.rename('missing', 'X');
  });
  expect(localStorage.getItem(KEY)).toBe(before);
});

it('removes a setlist and reads one back (characterization)', () => {
  seed();
  const { result } = renderHook(() => useLocalSetlists());
  expect(result.current.getOne('local_1')?.name).toBe('SL');
  act(() => result.current.remove('local_1'));
  expect(stored()).toEqual([]);
  expect(result.current.getOne('local_1')).toBeUndefined();
});
