import { describe, it, expect, vi } from 'vitest';
import { readLibraryResource } from '../libraryReader';
import { ApiError } from '../api';

describe('library read fallback', () => {
  it('uses the download immediately offline', async () => {
    const network = vi.fn();
    expect(await readLibraryResource({ online: false }, network, async () => 'saved', async () => {})).toBe('saved');
    expect(network).not.toHaveBeenCalled();
  });
  it('falls back on network/server failure, but never on permission denial', async () => {
    const saved = vi.fn(async () => 'saved');
    const invalidate = vi.fn(async () => {});
    expect(await readLibraryResource({ online: true }, async () => { throw new ApiError('down', 503); }, saved, invalidate)).toBe('saved');
    saved.mockClear();
    await expect(readLibraryResource({ online: true }, async () => { throw new ApiError('denied', 403); }, saved, invalidate)).rejects.toThrow('denied');
    expect(saved).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledOnce();
  });
  it('does not mask bad requests with old data', async () => {
    const saved = vi.fn();
    await expect(readLibraryResource({ online: true }, async () => { throw new ApiError('bad request', 400); }, saved, async () => {})).rejects.toThrow('bad request');
    expect(saved).not.toHaveBeenCalled();
  });
  it('reads the download first when one is available', async () => {
    const network = vi.fn();
    const saved = vi.fn();
    expect(await readLibraryResource({ online: true, local: async () => 'local' }, network, saved, async () => {})).toBe('local');
    expect(network).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
  });
  it('asks the server only after the device has no copy', async () => {
    const order: string[] = [];
    const result = await readLibraryResource({ online: true, local: async () => { order.push('local'); throw new Error('not downloaded'); } },
      async () => { order.push('network'); return 'net'; }, vi.fn(), async () => {});
    expect(result).toBe('net');
    expect(order).toEqual(['local', 'network']);
  });
});
