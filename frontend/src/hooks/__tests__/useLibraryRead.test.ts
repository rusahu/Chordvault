import 'fake-indexeddb/auto';
import { renderHook } from '@testing-library/react';
import { useLibraryRead } from '../useLibraryRead';
import { ApiError } from '../../lib/api';

const { call, auth } = vi.hoisted(() => ({ call: vi.fn(), auth: { user: null as { id: number; token: string } | null } }));
vi.mock('../useApi', () => ({ useApi: () => call }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));

const sunday = { id: 5, name: 'Sunday', entries: [] };
beforeEach(() => { call.mockReset(); auth.user = { id: 1, token: 't' }; });

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
