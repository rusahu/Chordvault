import { act, renderHook, waitFor } from '@testing-library/react';
import { usePaginatedSearch, type PaginatedSearchOptions } from '../usePaginatedSearch';
import type { LibraryPage } from '../../types/offline';

type Options = PaginatedSearchOptions<string, 'songs'>;
const pageKey = 'cv_test_page';
const result = (songs: string[], page = 1, totalPages = 1): LibraryPage<string, 'songs'> =>
  ({ songs, page, totalPages, total: songs.length, limit: 20 });
const options = (overrides: Partial<Options> = {}): Options =>
  ({ pageKey, listKey: 'songs', filters: { q: 'grace' }, fetchPage: vi.fn(async () => result(['a'])), persist: vi.fn(), ...overrides });

beforeEach(() => sessionStorage.clear());

it('restores the stored page, loads the current filters and saves the server page', async () => {
  sessionStorage.setItem(pageKey, '3');
  const opts = options({ fetchPage: vi.fn(async () => result(['a'], 2, 5)) });
  const hook = renderHook(() => usePaginatedSearch(opts));
  await waitFor(() => expect(hook.result.current.loaded).toBe(true));
  expect(opts.fetchPage).toHaveBeenCalledWith({ q: 'grace', page: 3 });
  expect(hook.result.current).toMatchObject({ items: ['a'], page: 2, totalPages: 5, loadError: '' });
  expect(opts.persist).toHaveBeenCalledWith({ q: 'grace' });
  expect(sessionStorage.getItem(pageKey)).toBe('2');
});

it('reports a failed load, clears the list and keeps the saved filters', async () => {
  const fetchPage = vi.fn<Options['fetchPage']>().mockResolvedValueOnce(result(['a'])).mockRejectedValueOnce(new Error('Search failed'));
  const opts = options({ fetchPage });
  const hook = renderHook(() => usePaginatedSearch(opts));
  await waitFor(() => expect(hook.result.current.items).toEqual(['a']));
  await act(() => hook.result.current.load({ q: 'other' }));
  expect(hook.result.current.loadError).toBe('Search failed');
  expect(hook.result.current.items).toEqual([]);
  expect(opts.persist).toHaveBeenCalledOnce();
});

it('marks a disabled search loaded without fetching', async () => {
  const opts = options({ enabled: false });
  const hook = renderHook(() => usePaginatedSearch(opts));
  await waitFor(() => expect(hook.result.current.loaded).toBe(true));
  expect(opts.fetchPage).not.toHaveBeenCalled();
});

it('does not reload while filters change, but reloads with the latest filters when the reader changes', async () => {
  const first = vi.fn(async () => result(['a']));
  const second = vi.fn(async () => result(['b']));
  const persist = vi.fn();
  const hook = renderHook(
    ({ fetchPage, q }: { fetchPage: Options['fetchPage']; q: string }) =>
      usePaginatedSearch({ pageKey, listKey: 'songs', filters: { q }, fetchPage, persist: f => persist(f) }),
    { initialProps: { fetchPage: first, q: 'one' } },
  );
  await waitFor(() => expect(hook.result.current.items).toEqual(['a']));
  hook.rerender({ fetchPage: first, q: 'two' });
  hook.rerender({ fetchPage: first, q: 'three' });
  expect(first).toHaveBeenCalledOnce();
  hook.rerender({ fetchPage: second, q: 'three' });
  await waitFor(() => expect(hook.result.current.items).toEqual(['b']));
  expect(second).toHaveBeenCalledExactlyOnceWith({ q: 'three', page: 1 });
});

it('ignores a response that arrives after unmount', async () => {
  sessionStorage.setItem(pageKey, '1');
  let resolve!: (value: LibraryPage<string, 'songs'>) => void;
  const opts = options({ fetchPage: vi.fn(() => new Promise<LibraryPage<string, 'songs'>>(r => { resolve = r; })) });
  const hook = renderHook(() => usePaginatedSearch(opts));
  await waitFor(() => expect(opts.fetchPage).toHaveBeenCalled());
  hook.unmount();
  await act(async () => resolve(result(['late'], 4)));
  expect(opts.persist).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(pageKey)).toBe('1');
});

it('keeps the latest request when an earlier one finishes last', async () => {
  let resolveSlow!: (page: LibraryPage<string, 'songs'>) => void;
  const fetchPage = vi.fn<Options['fetchPage']>()
    .mockResolvedValueOnce(result(['initial']))
    .mockImplementationOnce(() => new Promise(resolve => { resolveSlow = resolve; }))
    .mockResolvedValueOnce(result(['kids or christmas']));
  const opts = options({ fetchPage });
  const hook = renderHook(() => usePaginatedSearch(opts));
  await waitFor(() => expect(hook.result.current.items).toEqual(['initial']));
  let slow!: Promise<void>;
  act(() => { slow = hook.result.current.load({ tags: ['kids'] }); });
  await act(() => hook.result.current.load({ tags: ['kids', 'christmas'] }));
  await act(async () => { resolveSlow(result(['kids only'])); await slow; });
  expect(hook.result.current.items).toEqual(['kids or christmas']);
  expect(opts.persist).toHaveBeenLastCalledWith({ tags: ['kids', 'christmas'] });
});
