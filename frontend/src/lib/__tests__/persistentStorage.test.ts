import { checkPersistentStorage, requestPersistentStorage } from '../persistentStorage';

const original = Object.getOwnPropertyDescriptor(navigator, 'storage');
const setStorage = (value: unknown) => Object.defineProperty(navigator, 'storage', { value, configurable: true });

afterEach(() => {
  if (original) Object.defineProperty(navigator, 'storage', original);
  else delete (navigator as { storage?: unknown }).storage;
});

describe('checkPersistentStorage', () => {
  it('returns null when the browser has no persist API', async () => {
    setStorage(undefined);
    await expect(checkPersistentStorage()).resolves.toBeNull();
  });

  it('reports the current state without asking', async () => {
    const persist = vi.fn();
    setStorage({ persisted: vi.fn().mockResolvedValue(false), persist });
    await expect(checkPersistentStorage()).resolves.toBe(false);
    expect(persist).not.toHaveBeenCalled();
  });

  it('treats errors as not protected', async () => {
    setStorage({ persisted: vi.fn().mockRejectedValue(new Error('denied')), persist: vi.fn() });
    await expect(checkPersistentStorage()).resolves.toBe(false);
  });
});

describe('requestPersistentStorage', () => {
  it('returns null when the browser has no persist API', async () => {
    setStorage(undefined);
    await expect(requestPersistentStorage()).resolves.toBeNull();
  });

  it('returns true without asking when already persisted', async () => {
    const persist = vi.fn();
    setStorage({ persisted: vi.fn().mockResolvedValue(true), persist });
    await expect(requestPersistentStorage()).resolves.toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('returns the browser answer when it has to ask', async () => {
    setStorage({ persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockResolvedValue(true) });
    await expect(requestPersistentStorage()).resolves.toBe(true);
    setStorage({ persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockResolvedValue(false) });
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('treats errors as refused', async () => {
    setStorage({ persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockRejectedValue(new Error('denied')) });
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });
});
