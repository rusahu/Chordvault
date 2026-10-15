import { useMemo } from 'react';
import { useApi } from './useApi';
import { useLocalSetlists } from './useLocalSetlists';
import { useI18n } from '../context/I18nContext';
import { MAX_LOCAL_SETLISTS } from '../lib/constants';
import type { SetlistEntry } from '../types';

export interface SongRef { id: number; title: string; artist?: string | null }
export interface KeyPick { targetKey: string | null; nashville: boolean }
export interface SetlistMeta { name: string; visibility: string; event_date: string }

/** One write API for browser-local and server setlists. Local refusals reject with the message the views show. */
export function useSetlistStore(local: boolean) {
  const { setlists, getOne, create: createLocal, addEntry, removeEntry: removeLocalEntry, updateEntry, reorderEntries, rename, remove: removeLocal } = useLocalSetlists();
  const apiCall = useApi();
  const { t } = useI18n();

  const actions = useMemo(() => ({
    async create(name: string) {
      if (!local) return String((await apiCall<{ id: number }>('POST', '/api/setlists', { name })).id);
      const sl = createLocal(name);
      if (!sl) throw new Error(`Max ${MAX_LOCAL_SETLISTS} setlists`);
      return sl.id;
    },
    async addSong(setlistId: string, song: SongRef, pick?: KeyPick) {
      if (!local) {
        await apiCall('POST', `/api/setlists/${setlistId}/songs`, pick ? { song_id: song.id, target_key: pick.targetKey, nashville: pick.nashville } : { song_id: song.id });
        return;
      }
      const entry = { song_id: song.id, title: song.title, artist: song.artist || '', target_key: pick?.targetKey ?? null, nashville: pick?.nashville ? 1 : 0 };
      if (!addEntry(setlistId, entry)) throw new Error('Failed to add song');
    },
    async removeEntry(setlistId: string, entryId: number | string, idx: number) {
      if (local) removeLocalEntry(setlistId, idx);
      else await apiCall('DELETE', `/api/setlists/${setlistId}/entries/${entryId}`);
    },
    async setEntryKey(setlistId: string, entryId: number | string, idx: number, targetKey: string) {
      if (local) updateEntry(setlistId, idx, { target_key: targetKey });
      else await apiCall('PUT', `/api/setlists/${setlistId}/entries/${entryId}`, { target_key: targetKey });
    },
    async saveMeta(setlistId: string, meta: SetlistMeta) {
      if (local) rename(setlistId, meta.name);
      else await apiCall('PUT', `/api/setlists/${setlistId}`, meta);
    },
    async remove(setlistId: string) {
      if (local) removeLocal(setlistId);
      else await apiCall('DELETE', `/api/setlists/${setlistId}`);
    },
    /** Local entries move by their positions in `previous`, so stored fields the view never loads survive. */
    async reorder(setlistId: string, next: SetlistEntry[], previous: SetlistEntry[]) {
      if (!local) {
        await apiCall('PUT', `/api/setlists/${setlistId}/reorder`, { entry_ids: next.map((e) => e.entry_id) });
        return;
      }
      if (!reorderEntries(setlistId, next.map((e) => previous.indexOf(e)))) throw new Error(t('setlist.reorderFailed'));
    },
  }), [local, apiCall, t, createLocal, addEntry, removeLocalEntry, updateEntry, reorderEntries, rename, removeLocal]);

  return { setlists, getOne, ...actions };
}
