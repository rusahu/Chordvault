import { renderHook } from '@testing-library/react';
import { useReloadOnUpdate } from '../useReloadOnUpdate';

function stubServiceWorker(controller: object | null, active: object | null = controller) {
  const sw = Object.assign(new EventTarget(), { controller, getRegistration: () => Promise.resolve(active ? { active } : undefined) });
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { serviceWorker: sw }));
  return sw;
}

async function mount() {
  const hook = renderHook(() => useReloadOnUpdate());
  await Promise.resolve();
  return hook;
}

describe('useReloadOnUpdate', () => {
  const reload = vi.fn();

  beforeEach(() => {
    reload.mockClear();
    vi.stubGlobal('location', { ...location, reload });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('reloads when a new version takes over a tab that ran the old one', async () => {
    const sw = stubServiceWorker({});
    await mount();
    sw.dispatchEvent(new Event('controllerchange'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads a force-reloaded tab, which starts uncontrolled while an old version is installed', async () => {
    const sw = stubServiceWorker(null, {});
    await mount();
    sw.dispatchEvent(new Event('controllerchange'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('skips the first install taking control, but reloads for the next version', async () => {
    const sw = stubServiceWorker(null, null);
    await mount();
    sw.dispatchEvent(new Event('controllerchange'));
    expect(reload).not.toHaveBeenCalled();
    sw.dispatchEvent(new Event('controllerchange'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('stops listening once unmounted', async () => {
    const sw = stubServiceWorker({});
    (await mount()).unmount();
    sw.dispatchEvent(new Event('controllerchange'));
    expect(reload).not.toHaveBeenCalled();
  });
});
