import { useCallback, useEffect, useState } from 'react';
import { useLibraryRead } from './useLibraryRead';
import { showStatusNotification as toast } from '../lib/notifications';
import { errorMessage, notifyError } from '../lib/errors';
import { getLocalSetlists } from '../lib/storage';
import { applyStoredOverrides, enrichLocalSetlistSongs, localSetlistToSetlist } from '../lib/setlists';
import type { Setlist } from '../types';
import type { Navigate } from '../lib/routes';

interface SetlistLoaderOptions {
  setlistId: number | string;
  isLocal?: boolean;
  navigate: Navigate;
}

/** Loads a local or online setlist with the browser's stored key overrides applied. */
export function useSetlistLoader({ setlistId, isLocal, navigate }: SetlistLoaderOptions) {
  const { getSong, getSetlistForViewer } = useLibraryRead();
  const [loadError, setLoadError] = useState('');
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [savedTargetKeys, setSavedTargetKeys] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (isLocal) {
      const sl = getLocalSetlists().find((s) => s.id === setlistId);
      if (!sl) {
        toast('Local setlist not found', 'error');
        navigate('setlists', {}, { leave: true });
        return;
      }
      enrichLocalSetlistSongs(sl.entries, getSong)
        .then((entries) => {
          const merged = applyStoredOverrides(sl.id, entries);
          setSetlist(localSetlistToSetlist(sl, merged.entries));
          setSavedTargetKeys(merged.targetKeys);
        })
        .catch((err) => {
          notifyError(err);
          navigate('setlists', {}, { leave: true });
        });
      return;
    }

    getSetlistForViewer(Number(setlistId))
      .then((sl) => {
        const merged = applyStoredOverrides(sl.id, sl.entries);
        setSetlist({ ...sl, entries: merged.entries });
        setSavedTargetKeys(merged.targetKeys);
      })
      .catch((e) => setLoadError(errorMessage(e)));
  }, [setlistId, getSong, getSetlistForViewer, isLocal, navigate]);

  const markSaved = useCallback((entryId: number | string, key: string | null) =>
    setSavedTargetKeys((prev) => ({ ...prev, [String(entryId)]: key })), []);

  return { setlist, setSetlist, loadError, savedTargetKeys, markSaved };
}
