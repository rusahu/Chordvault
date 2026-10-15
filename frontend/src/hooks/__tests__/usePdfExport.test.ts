import { act, renderHook } from '@testing-library/react';
import { usePdfExport } from '../usePdfExport';
import { showStatusNotification } from '../../lib/notifications';

vi.mock('../../lib/notifications', () => ({ showStatusNotification: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

it('reports success, up to eight missing characters, and failures', async () => {
  const { result } = renderHook(() => usePdfExport());
  await act(() => result.current('PDF exported', async () => []));
  expect(showStatusNotification).toHaveBeenLastCalledWith('PDF exported', 'success');
  await act(() => result.current('Setlist PDF exported', async () => ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']));
  expect(showStatusNotification).toHaveBeenLastCalledWith('Setlist PDF exported, but these characters may be missing: a b c d e f g h', 'error');
  await act(() => result.current('PDF exported', async () => { throw new Error(''); }));
  expect(showStatusNotification).toHaveBeenLastCalledWith('PDF export failed', 'error');
  await act(() => result.current('PDF exported', async () => { throw new Error('Could not load the font needed for this song'); }));
  expect(showStatusNotification).toHaveBeenLastCalledWith('Could not load the font needed for this song', 'error');
});

it('ignores a second export while one is running', async () => {
  const { result } = renderHook(() => usePdfExport());
  let finish!: (missing: string[]) => void;
  const second = vi.fn(async () => []);
  let first!: Promise<boolean>;
  act(() => { first = result.current('PDF exported', () => new Promise<string[]>(resolve => { finish = resolve; })); });
  await act(() => result.current('PDF exported', second));
  expect(second).not.toHaveBeenCalled();
  await act(async () => { finish([]); await first; });
  expect(showStatusNotification).toHaveBeenCalledExactlyOnceWith('PDF exported', 'success');
});
