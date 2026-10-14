import { useCallback } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useWriteLock } from './useWriteLock';

export function useApi() {
  const { user, logout } = useAuth();
  const isWriteLocked = useWriteLock();

  const call = useCallback(<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> => {
    if (method !== 'GET' && isWriteLocked()) return Promise.reject(new Error('Connect to the server to make changes.'));
    return api<T>(method, path, body, user?.token).catch((err) => {
      if (user && err instanceof ApiError && err.status === 401) {
        logout();
      }
      throw err;
    });
  }, [user, logout, isWriteLocked]);

  return call;
}
