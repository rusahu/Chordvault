import { getStoredUser } from '../lib/storage';
import { useMemo } from 'react';
import { useApi } from './useApi';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { offlineLibrary } from '../lib/offlineLibrary';
import { readLibraryResource } from '../lib/libraryReader';
import type { Song, SongVersion, Setlist, SongListItem, SetlistListItem } from '../types';
import type { LibraryPage, LibraryQuery } from '../types/offline';
import { libraryQueryString } from '../lib/libraryQuery';
import { ApiError } from '../lib/api';

export function useLibraryRead() {
  const call = useApi();
  const { user } = useAuth();
  const accountId = user?.id;
  const { reportSource, saveWaiting } = useOffline();
  return useMemo(() => {
    /** This account's downloaded copy; refused when another account is signed in on this device. */
    async function deviceCopy<T>(cached: (account: number) => Promise<T>) {
      const signedIn = () => !!accountId && getStoredUser()?.id === accountId;
      if (!signedIn()) throw new Error('Sign in and download your library before going offline.');
      const result = await cached(accountId!);
      if (!signedIn()) throw new Error('Sign in and download your library before going offline.');
      return result;
    }
    async function read<T>(path: string, cached: (account: number) => Promise<T>, exists?: (account: number) => Promise<unknown>, fresh = false) {
      // The download answers first unless a save has not synced into it yet.
      const local = accountId && !fresh && !saveWaiting() ? () => deviceCopy(cached) : undefined;
      return readLibraryResource({ online: navigator.onLine !== false, local },
        async () => { const result = await call<T>('GET', path); reportSource(false); return result; },
        async () => { const result = await deviceCopy(cached); reportSource(true); return result; },
        async () => {
          if (accountId && exists && await exists(accountId).catch(() => null)) await offlineLibrary.invalidate(accountId);
        });
    }
    /** A single item: when the server no longer has it, drop a cached copy that still does. */
    const readItem = <T>(path: string, cached: (account: number) => Promise<T>, fresh = false) => read(path, cached, cached, fresh);
    const getSetlist = (id: number, publicOnly: boolean, fresh: boolean) =>
      readItem<Setlist>(`/api/setlists/${publicOnly ? 'public/' : ''}${id}`, account => offlineLibrary.getSetlist(account, id), fresh);
    /** The viewer's own copy when signed in, else (or when it is not theirs) the public one. `fresh` skips the download (editors). */
    const getSetlistForViewer = async (id: number, { fresh = false } = {}) => {
      if (!accountId) return getSetlist(id, true, fresh);
      try {
        return await getSetlist(id, false, fresh);
      } catch (error) {
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return getSetlist(id, true, fresh);
        throw error;
      }
    };
    return {
      getSong: (id: number) => readItem<Song>(`/api/songs/${id}`, account => offlineLibrary.getSong(account, id)),
      getVersions: (id: number) => read<SongVersion[]>(`/api/songs/${id}/versions`, account => offlineLibrary.getVersions(account, id), account => offlineLibrary.getSong(account, id)),
      getSetlistForViewer,
      querySongs: (query: LibraryQuery) => read<LibraryPage<SongListItem, 'songs'>>(`/api/songs${query.own ? '' : '/public'}${libraryQueryString(query)}`, account => offlineLibrary.querySongs(account, query)),
      querySetlists: (query: LibraryQuery) => read<LibraryPage<SetlistListItem, 'setlists'>>(`/api/setlists${libraryQueryString(query)}`, account => offlineLibrary.querySetlists(account, query)),
    };
  }, [call, accountId, reportSource, saveWaiting]);
}
