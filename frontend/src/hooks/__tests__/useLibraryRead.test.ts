import 'fake-indexeddb/auto';
import { renderHook } from '@testing-library/react';
import { useLibraryRead } from '../useLibraryRead';
import { ApiError } from '../../lib/api';
import { offlineLibrary } from '../../lib/offlineLibrary';

const { call, auth } = vi.hoisted(() => ({ call: vi.fn(), auth: { user: null as { id: number; token: string } | null } }));
vi.mock('../useApi', () => ({ useApi: () => call }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
const offline = vi.hoisted(() => ({ saveWaiting: vi.fn(() => false), reportSource: vi.fn() }));
const context = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('../../context/OfflineContext', () => ({ useOffline: () => context.value ?? offline }));

const sunday = { id: 5, name: 'Sunday', entries: [] };
beforeEach(() => {
  call.mockReset(); auth.user = { id: 1, token: 't' };
  offline.saveWaiting.mockReturnValue(false); offline.reportSource.mockClear(); context.value = null;
  localStorage.setItem('cv_user', JSON.stringify(auth.user));
});
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

it.each([403, 404])('falls back to the public setlist when the own read answers %i', async (status) => {
  call.mockImplementation((_method: string, path: string) => path === '/api/setlists/5' ? Promise.reject(new ApiError('No', status)) : Promise.resolve(sunday));
  const { result } = renderHook(() => useLibraryRead());
  await expect(result.current.getSetlistForViewer(5)).resolves.toBe(sunday);
  expect(call).toHaveBeenLastCalledWith('GET', '/api/setlists/public/5');
});

it('rethrows other refusals without trying the public copy', async () => {
  call.mockRejectedValue(new ApiError('Bad request', 400));
  const { result } = renderHook(() => useLibraryRead());
  await expect(result.current.getSetlistForViewer(5)).rejects.toThrow('Bad request');
  expect(call).toHaveBeenCalledTimes(1);
});

it('reads only the public copy when signed out', async () => {
  auth.user = null;
  call.mockResolvedValue(sunday);
  const { result } = renderHook(() => useLibraryRead());
  await expect(result.current.getSetlistForViewer(5)).resolves.toBe(sunday);
  expect(call).toHaveBeenCalledExactlyOnceWith('GET', '/api/setlists/public/5');
});

const amazing = { id: 3, title: 'Amazing Grace', content: '[G]Amazing' };
const downloaded = () => vi.spyOn(offlineLibrary, 'getSong').mockResolvedValue(amazing as never);

it('opens a downloaded song before offline state loads', async () => {
  downloaded();
  const { result } = renderHook(() => useLibraryRead());
  await expect(result.current.getSong(3)).resolves.toBe(amazing);
  expect(call).not.toHaveBeenCalled();
  expect(offline.reportSource).not.toHaveBeenCalled();
});

it('reads from the server right after a save in the same tick', async () => {
  downloaded();
  call.mockResolvedValue({ ...amazing, title: 'Saved' });
  const { result } = renderHook(() => useLibraryRead());
  const { getSong } = result.current;
  offline.saveWaiting.mockReturnValue(true);
  await expect(getSong(3)).resolves.toMatchObject({ title: 'Saved' });
  expect(call).toHaveBeenCalledExactlyOnceWith('GET', '/api/songs/3');
});

it('does not fall back to the old copy while a save is waiting', async () => {
  downloaded();
  offline.saveWaiting.mockReturnValue(true);
  call.mockRejectedValue(new TypeError('Failed to fetch'));
  const { result } = renderHook(() => useLibraryRead());
  await expect(result.current.getSong(3)).rejects.toThrow();
  expect(offline.reportSource).not.toHaveBeenCalledWith(true);
});

it('asks the server for songs that are not downloaded', async () => {
  vi.spyOn(offlineLibrary, 'getSong').mockRejectedValue(new Error('not downloaded'));
  call.mockResolvedValue(amazing);
  const { result } = renderHook(() => useLibraryRead());
  await expect(result.current.getSong(3)).resolves.toBe(amazing);
  expect(call).toHaveBeenCalledOnce();
});

it("does not serve another account's download", async () => {
  downloaded();
  localStorage.setItem('cv_user', JSON.stringify({ id: 2, token: 'x' }));
  call.mockResolvedValue({ ...amazing, title: 'Server' });
  const { result } = renderHook(() => useLibraryRead());
  await expect(result.current.getSong(3)).resolves.toMatchObject({ title: 'Server' });
});

it('loads the setlist editor from the server', async () => {
  vi.spyOn(offlineLibrary, 'getSetlist').mockResolvedValue(sunday as never);
  call.mockResolvedValue({ ...sunday, name: 'Fresh' });
  const { result } = renderHook(() => useLibraryRead());
  await expect(result.current.getSetlistForViewer(5, { fresh: true })).resolves.toMatchObject({ name: 'Fresh' });
  await expect(result.current.getSetlistForViewer(5)).resolves.toBe(sunday);
  expect(call).toHaveBeenCalledOnce();
});

it('keeps readers stable when offline state changes', () => {
  const { result, rerender } = renderHook(() => useLibraryRead());
  const first = result.current;
  offline.saveWaiting.mockReturnValue(true);
  context.value = { ...offline, usingDownload: true, readOnly: true, state: { revision: '"r2"' } };
  rerender();
  for (const key of Object.keys(first) as (keyof typeof first)[]) expect(result.current[key]).toBe(first[key]);
});
