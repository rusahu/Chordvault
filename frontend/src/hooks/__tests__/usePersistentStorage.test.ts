import { act, renderHook, waitFor } from '@testing-library/react';
import { usePersistentStorage } from '../usePersistentStorage';
import { checkPersistentStorage, requestPersistentStorage } from '../../lib/persistentStorage';

vi.mock('../../lib/persistentStorage', () => ({ checkPersistentStorage: vi.fn(), requestPersistentStorage: vi.fn() }));
const check = vi.mocked(checkPersistentStorage);
const request = vi.mocked(requestPersistentStorage);

beforeEach(() => { check.mockReset(); request.mockReset(); });

describe('usePersistentStorage', () => {
  it('does nothing while offline mode is off', () => {
    const { result } = renderHook(() => usePersistentStorage(false));
    expect(result.current.persisted).toBeNull();
    expect(check).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('checks silently when enabled and never prompts by itself', async () => {
    check.mockResolvedValue(false);
    const { result } = renderHook(() => usePersistentStorage(true));
    await waitFor(() => expect(result.current.persisted).toBe(false));
    expect(request).not.toHaveBeenCalled();
  });

  it('reports null while disabled, even after a refusal', async () => {
    check.mockResolvedValue(false);
    const { result, rerender } = renderHook(({ on }) => usePersistentStorage(on), { initialProps: { on: true } });
    await waitFor(() => expect(result.current.persisted).toBe(false));
    rerender({ on: false });
    expect(result.current.persisted).toBeNull();
  });

  it('updates after a tap-driven request', async () => {
    check.mockResolvedValue(false);
    request.mockResolvedValue(true);
    const { result } = renderHook(() => usePersistentStorage(true));
    await waitFor(() => expect(result.current.persisted).toBe(false));
    await act(async () => { await result.current.request(); });
    expect(result.current.persisted).toBe(true);
  });

  it('lets a newer request win over a slower launch check', async () => {
    let finishCheck!: (value: boolean) => void;
    check.mockReturnValue(new Promise(resolve => { finishCheck = resolve; }));
    request.mockResolvedValue(true);
    const { result } = renderHook(() => usePersistentStorage(true));
    await act(async () => { await result.current.request(); });
    await act(async () => { finishCheck(false); });
    expect(result.current.persisted).toBe(true);
  });
});
