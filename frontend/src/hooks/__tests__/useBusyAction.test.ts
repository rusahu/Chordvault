import { act, renderHook } from '@testing-library/react';
import { useBusyAction } from '../useBusyAction';
import { showStatusNotification } from '../../lib/notifications';

vi.mock('../../lib/notifications', () => ({ showStatusNotification: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

it('ignores a second run while the first is pending and frees itself after', async () => {
  const { result } = renderHook(() => useBusyAction());
  let finish!: () => void;
  const first = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const second = vi.fn(async () => {});
  let started!: Promise<boolean>;
  act(() => { started = result.current.run(first); });
  expect(result.current.busy).toBe(true);
  await act(async () => { expect(await result.current.run(second)).toBe(false); });
  expect(second).not.toHaveBeenCalled();
  await act(async () => { finish(); expect(await started).toBe(true); });
  expect(result.current.busy).toBe(false);
  await act(async () => { expect(await result.current.run(second)).toBe(true); });
  expect(second).toHaveBeenCalledOnce();
});

it('reports a failure once through the default handler and returns false', async () => {
  const { result } = renderHook(() => useBusyAction());
  await act(async () => { expect(await result.current.run(async () => { throw new Error('Write failed'); })).toBe(false); });
  expect(showStatusNotification).toHaveBeenCalledExactlyOnceWith('Write failed', 'error');
  expect(result.current.busy).toBe(false);
});

it('hands a failure to a custom handler instead', async () => {
  const onError = vi.fn();
  const { result } = renderHook(() => useBusyAction());
  await act(async () => { await result.current.run(async () => { throw new Error('No'); }, onError); });
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'No' }));
  expect(showStatusNotification).not.toHaveBeenCalled();
});
