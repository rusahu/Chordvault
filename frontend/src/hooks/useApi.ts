import { useCallback } from 'react';
import { api, ApiError, type ApiCaller } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useWriteLock } from './useWriteLock';
import { useOffline } from '../context/OfflineContext';

export function useApi() {
  const { user, logout } = useAuth();
  const isWriteLocked = useWriteLock();
  const { markLibraryChanged } = useOffline();

  const call: ApiCaller = useCallback(<T = unknown>(method: string, path: string, body?: unknown): Promise<T> => {
    if (method !== 'GET' && isWriteLocked()) return Promise.reject(new Error('Connect to the server to make changes.'));
    return api<T>(method, path, body, user?.token).then((result) => {
      if (method !== 'GET') markLibraryChanged();
      return result;
    }, (err) => {
      if (user && err instanceof ApiError && err.status === 401) {
        logout();
      }
      throw err;
    });
  }, [user, logout, isWriteLocked, markLibraryChanged]);

  return call;
}
