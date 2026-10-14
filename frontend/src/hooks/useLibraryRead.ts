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

export function useLibraryRead() {
  const call = useApi();
  const { user } = useAuth();
  const accountId = user?.id;
  const { reportSource } = useOffline();
  return useMemo(() => {
    async function read<T>(path: string, cached: (account: number) => Promise<T>, exists?: (account: number) => Promise<unknown>) {
      return readLibraryResource(navigator.onLine !== false,
        async () => { const result = await call<T>('GET', path); reportSource(false); return result; },
        async () => {
          if (!accountId || getStoredUser()?.id !== accountId) throw new Error('Sign in and download your library before going offline.');
          const result = await cached(accountId);
          reportSource(true);
          return result;
        },
        async () => {
          if (accountId && exists && await exists(accountId).catch(() => null)) await offlineLibrary.invalidate(accountId);
        });
    }
    return {
      getSong: (id: number) => read<Song>(`/api/songs/${id}`, account => offlineLibrary.getSong(account, id), account => offlineLibrary.getSong(account, id)),
      getVersions: (id: number) => read<SongVersion[]>(`/api/songs/${id}/versions`, account => offlineLibrary.getVersions(account, id), account => offlineLibrary.getSong(account, id)),
      getSetlist: (id: number, publicOnly = false) => read<Setlist>(`/api/setlists/${publicOnly ? 'public/' : ''}${id}`, account => offlineLibrary.getSetlist(account, id), account => offlineLibrary.getSetlist(account, id)),
      querySongs: (query: LibraryQuery) => read<LibraryPage<SongListItem, 'songs'>>(`/api/songs${query.own ? '' : '/public'}${libraryQueryString(query)}`, account => offlineLibrary.querySongs(account, query)),
      querySetlists: (query: LibraryQuery) => read<LibraryPage<SetlistListItem, 'setlists'>>(`/api/setlists${libraryQueryString(query)}`, account => offlineLibrary.querySetlists(account, query)),
    };
  }, [call, accountId, reportSource]);
}
