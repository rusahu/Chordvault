import { act, renderHook } from '@testing-library/react';
import { useSetlistStore } from '../useSetlistStore';
import type { SetlistEntry } from '../../types';

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('../useApi', () => ({ useApi: () => api }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

const KEY = 'cv_local_setlists';
const song = { id: 9, title: 'Picked', artist: null };
const stored = () => JSON.parse(localStorage.getItem(KEY)!);
beforeEach(() => { localStorage.clear(); api.mockReset().mockResolvedValue({ id: 7 }); });

it('creates cloud setlists through the API and returns the new id', async () => {
  const { result } = renderHook(() => useSetlistStore(false));
  await expect(result.current.create('Easter')).resolves.toBe('7');
  expect(api).toHaveBeenCalledWith('POST', '/api/setlists', { name: 'Easter' });
});

it('sends a key pick to a cloud setlist only when one is given', async () => {
  const { result } = renderHook(() => useSetlistStore(false));
  await result.current.addSong('1', song);
  await result.current.addSong('1', song, { targetKey: 'D', nashville: true });
  expect(api.mock.calls).toEqual([
    ['POST', '/api/setlists/1/songs', { song_id: 9 }],
    ['POST', '/api/setlists/1/songs', { song_id: 9, target_key: 'D', nashville: true }],
  ]);
});

it('stores local entries with the pick and Nashville as 1 or 0', async () => {
  const { result } = renderHook(() => useSetlistStore(true));
  let id = '';
  await act(async () => { id = await result.current.create('Mine'); });
  await act(() => result.current.addSong(id, song, { targetKey: 'D', nashville: true }));
  await act(() => result.current.addSong(id, song));
  expect(stored()[0].entries).toEqual([
    { song_id: 9, title: 'Picked', artist: '', target_key: 'D', nashville: 1 },
    { song_id: 9, title: 'Picked', artist: '', target_key: null, nashville: 0 },
  ]);
  expect(api).not.toHaveBeenCalled();
});

it('rejects with the messages the views show', async () => {
  localStorage.setItem(KEY, JSON.stringify(Array.from({ length: 50 }, (_, i) => ({ id: `local_${i}`, name: `${i}`, entries: [] }))));
  const { result } = renderHook(() => useSetlistStore(true));
  await expect(result.current.create('One more')).rejects.toThrow('Max 50 setlists');
  await expect(result.current.addSong('missing', song)).rejects.toThrow('Failed to add song');
  await expect(result.current.reorder('local_0', [{} as SetlistEntry], [])).rejects.toThrow('setlist.reorderFailed');
});

it('reorders cloud entries by id and local entries by stored position', async () => {
  const a = { entry_id: 'local_0' } as SetlistEntry;
  const b = { entry_id: 'local_1' } as SetlistEntry;
  localStorage.setItem(KEY, JSON.stringify([{ id: 'local_1', name: 'L', entries: [
    { song_id: 1, title: 'A', artist: '', nashville: 0, transpose: 2 }, { song_id: 2, title: 'B', artist: '', nashville: 0 },
  ] }]));
  const local = renderHook(() => useSetlistStore(true)).result;
  await act(() => local.current.reorder('local_1', [b, a], [a, b]));
  expect(stored()[0].entries.map((e: { title: string }) => e.title)).toEqual(['B', 'A']);
  expect(stored()[0].entries[1].transpose).toBe(2);
  const cloud = renderHook(() => useSetlistStore(false)).result;
  await cloud.current.reorder('3', [b, a], [a, b]);
  expect(api).toHaveBeenCalledWith('PUT', '/api/setlists/3/reorder', { entry_ids: ['local_1', 'local_0'] });
});

it('writes edits, metadata and deletes to the right side', async () => {
  localStorage.setItem(KEY, JSON.stringify([{ id: 'local_1', name: 'L', entries: [{ song_id: 1, title: 'A', artist: '', nashville: 0 }] }]));
  const local = renderHook(() => useSetlistStore(true)).result;
  await act(() => local.current.setEntryKey('local_1', 'local_0', 0, 'E'));
  await act(() => local.current.saveMeta('local_1', { name: 'Renamed', visibility: 'public', event_date: '2026-01-01' }));
  expect(stored()[0]).toMatchObject({ name: 'Renamed', entries: [{ target_key: 'E' }] });
  await act(() => local.current.removeEntry('local_1', 'local_0', 0));
  await act(() => local.current.remove('local_1'));
  expect(stored()).toEqual([]);
  const cloud = renderHook(() => useSetlistStore(false)).result;
  await cloud.current.setEntryKey('3', 11, 0, 'E');
  await cloud.current.saveMeta('3', { name: 'N', visibility: 'private', event_date: '' });
  await cloud.current.removeEntry('3', 11, 0);
  await cloud.current.remove('3');
  expect(api.mock.calls).toEqual([
    ['PUT', '/api/setlists/3/entries/11', { target_key: 'E' }],
    ['PUT', '/api/setlists/3', { name: 'N', visibility: 'private', event_date: '' }],
    ['DELETE', '/api/setlists/3/entries/11'],
    ['DELETE', '/api/setlists/3'],
  ]);
  expect(local.current.setlists).toEqual([]);
});
