import { act, renderHook } from '@testing-library/react';
import { useWakeLock } from '../useWakeLock';

const flush = () => act(async () => {});
const setVisibility = (state: 'visible' | 'hidden') => act(() => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
const makeSentinel = () => ({ release: vi.fn().mockResolvedValue(undefined) });
let request: ReturnType<typeof vi.fn>;

beforeEach(() => {
  request = vi.fn(() => Promise.resolve(makeSentinel()));
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});
afterEach(() => { delete (navigator as { wakeLock?: unknown }).wakeLock; });

describe('useWakeLock', () => {
  it('requests a screen lock while active', async () => {
    const { result } = renderHook(() => useWakeLock(true));
    await flush();
    expect(result.current.supported).toBe(true);
    expect(request).toHaveBeenCalledWith('screen');
  });

  it('does not request while inactive', async () => {
    renderHook(() => useWakeLock(false));
    await flush();
    expect(request).not.toHaveBeenCalled();
  });

  it('releases when deactivated and on unmount', async () => {
    const first = makeSentinel();
    const second = makeSentinel();
    request.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const { rerender, unmount } = renderHook(({ on }) => useWakeLock(on), { initialProps: { on: true } });
    await flush();
    rerender({ on: false });
    expect(first.release).toHaveBeenCalled();
    rerender({ on: true });
    await flush();
    unmount();
    expect(second.release).toHaveBeenCalled();
  });

  it('requests again when the page becomes visible', async () => {
    renderHook(() => useWakeLock(true));
    await flush();
    setVisibility('hidden');
    setVisibility('visible');
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('releases a lock that arrives after deactivation', async () => {
    const late = makeSentinel();
    let resolve!: (sentinel: typeof late) => void;
    request.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const { rerender } = renderHook(({ on }) => useWakeLock(on), { initialProps: { on: true } });
    rerender({ on: false });
    resolve(late);
    await flush();
    expect(late.release).toHaveBeenCalled();
  });

  it('ignores a refused request', async () => {
    request.mockRejectedValueOnce(new Error('battery saver'));
    renderHook(() => useWakeLock(true));
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('reports unsupported without the API', async () => {
    delete (navigator as { wakeLock?: unknown }).wakeLock;
    const { result } = renderHook(() => useWakeLock(true));
    await flush();
    expect(result.current.supported).toBe(false);
  });
});
