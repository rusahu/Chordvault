import { renderHook, waitFor } from '@testing-library/react';
import { useTagList } from '../useTagList';
import { DEFAULT_TAGS } from '../../lib/constants';

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('../useApi', () => ({ useApi: () => api }));
beforeEach(() => api.mockReset());

it('uses the server list once it loads', async () => {
  api.mockResolvedValue({ tags: ['advent', 'worship'] });
  const { result } = renderHook(() => useTagList());
  expect(result.current).toEqual(DEFAULT_TAGS);
  await waitFor(() => expect(result.current).toEqual(['advent', 'worship']));
  expect(api).toHaveBeenCalledWith('GET', '/api/tags');
});

it('keeps the defaults when the request fails or returns no list', async () => {
  api.mockRejectedValueOnce(new Error('offline'));
  const failed = renderHook(() => useTagList());
  await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
  expect(failed.result.current).toEqual(DEFAULT_TAGS);
  api.mockResolvedValueOnce({});
  const empty = renderHook(() => useTagList());
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  expect(empty.result.current).toEqual(DEFAULT_TAGS);
});
