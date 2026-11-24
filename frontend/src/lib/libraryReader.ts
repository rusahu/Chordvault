import { ApiError, isServerUnreachable } from './api';

/** `local` (the device copy) wins when it has the item; otherwise the server, falling back to `saved` when unreachable. */
export async function readLibraryResource<T>(source: { online: boolean; local?: () => Promise<T> }, network: () => Promise<T>, saved: () => Promise<T>, invalidate: () => Promise<void>): Promise<T> {
  if (source.local) {
    try { return await source.local(); } catch { /* not on this device: ask the server */ }
  }
  if (!source.online) return saved();
  try { return await network(); }
  catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) await invalidate();
    if (!isServerUnreachable(error)) throw error;
    return saved();
  }
}
