import { useCallback, useMemo } from 'react';
import { useApi } from './useApi';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { showStatusNotification as toast } from '../lib/notifications';
import { notifyError } from '../lib/errors';
import { saveSetlistOverride } from '../lib/storage';
import type { Setlist, SetlistEntry } from '../types';

interface EntryKeySaveOptions {
  setlist: Setlist | null;
  entry: SetlistEntry | null;
  savedTargetKeys: Record<string, string | null>;
  markSaved: (entryId: number | string, key: string | null) => void;
}

/** Whether the entry's key differs from the saved one, and saving it to the cloud (owner) or this browser. */
export function useEntryKeySave({ setlist, entry, savedTargetKeys, markSaved }: EntryKeySaveOptions) {
  const apiCall = useApi();
  const { user } = useAuth();
  const { readOnly } = useOffline();

  const isModified = useMemo(() => !!entry && entry.target_key !== (savedTargetKeys[String(entry.entry_id)] ?? null), [entry, savedTargetKeys]);

  const saveOnline = useCallback(async (silent = false) => {
    if (readOnly || !setlist || !entry || !user || setlist.user_id !== user.id) return;
    try {
      await apiCall('PUT', `/api/setlists/${setlist.id}/entries/${entry.entry_id}`, { target_key: entry.target_key });
      markSaved(entry.entry_id, entry.target_key);
      if (!silent) toast('Key saved to cloud', 'success');
    } catch (e) {
      if (!silent) notifyError(e);
    }
  }, [setlist, entry, apiCall, user, readOnly, markSaved]);

  const saveLocal = useCallback((silent = false) => {
    if (readOnly || !setlist || !entry) return;
    saveSetlistOverride(setlist.id, entry.entry_id, { target_key: entry.target_key });
    markSaved(entry.entry_id, entry.target_key);
    if (!silent) toast('Key saved locally', 'success');
  }, [setlist, entry, readOnly, markSaved]);

  return { isModified, saveOnline, saveLocal };
}
