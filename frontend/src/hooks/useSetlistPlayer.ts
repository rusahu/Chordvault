import { useLibraryRead } from './useLibraryRead';
import { useOffline, useOfflineActivity } from '../context/OfflineContext';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWindowEvent } from '@mantine/hooks';
import { useApi } from './useApi';
import { useAuth } from '../context/AuthContext';
import { showStatusNotification as toast } from '../lib/notifications';
import { errorMessage, notifyError } from '../lib/errors';
import { getSetlistOverrides, saveSetlistOverride, migrateOverride } from '../lib/storage';
import { enrichLocalSetlistSongs, localSetlistToSetlist } from '../lib/setlists';
import { entryContent } from '../lib/setlistKeys';
import { setlistPlayHash, parsePlayHash, replaceHash } from '../lib/routes';
import type { Setlist, SetlistEntry } from '../types';

interface UseSetlistPlayerOptions {
  setlistId: number | string;
  isLocal?: boolean;
  initialIndex?: number;
  navigate: (view: string, params?: Record<string, string>) => void;
  onNavigate?: () => void;
}

/**
 * Merges the browser's stored overrides onto freshly loaded entries.
 *
 * A stored override wins even when its target_key is null: null means "play as
 * written", which is a choice the user saved, so it must not fall back to the
 * server's pinned key. An override holding no key decision at all (only layout
 * fields) leaves the entry's own key alone. Legacy records are converted to a
 * target key and written back.
 */
function applyStoredOverrides(setlistId: number | string, entries: SetlistEntry[]) {
  const overrides = getSetlistOverrides(setlistId);
  const targetKeys: Record<string, string | null> = {};
  const merged = entries.map((en) => {
    const raw = overrides[String(en.entry_id)];
    const ov = raw ? migrateOverride(raw, entryContent(en)) : undefined;
    if (raw && raw.transpose !== undefined) {
      saveSetlistOverride(setlistId, en.entry_id, ov!);
    }
    const storedKey = raw && ('target_key' in raw || 'transpose' in raw);
    const targetKey = (storedKey ? ov!.target_key : en.target_key) ?? null;
    targetKeys[String(en.entry_id)] = targetKey;
    return { ...en, target_key: targetKey, nashville: 0 };
  });
  return { entries: merged, targetKeys };
}

export function useSetlistPlayer({
  setlistId,
  isLocal,
  initialIndex,
  navigate,
  onNavigate,
}: UseSetlistPlayerOptions) {
  const apiCall = useApi();
  const { getSong, getSetlistForViewer } = useLibraryRead();
  const { readOnly } = useOffline();
  useOfflineActivity(true);
  const { user } = useAuth();

  const [loadError, setLoadError] = useState('');
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [index, setIndex] = useState(initialIndex || 0);

  const [savedTargetKeys, setSavedTargetKeys] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (isLocal) {
      // Load the local setlist from storage and fetch song contents
      import('../lib/storage').then(({ getLocalSetlists }) => {
        const sl = getLocalSetlists().find((s) => s.id === setlistId);
        if (!sl) {
          toast('Local setlist not found', 'error');
          navigate('setlists');
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
            navigate('setlists');
          });
      });
      return;
    }

    const loadSetlist = async () => {
      try {
        const sl = await getSetlistForViewer(Number(setlistId));

        // Merge local overrides
        const merged = applyStoredOverrides(sl.id, sl.entries);
        sl.entries = merged.entries;

        setSetlist(sl);
        setSavedTargetKeys(merged.targetKeys);
      } catch (e) {
        setLoadError(errorMessage(e));
      }
    };

    loadSetlist();
  }, [setlistId, getSong, getSetlistForViewer, isLocal, navigate]);

  const entry: SetlistEntry | null = setlist?.entries[index] || null;
  const total = setlist?.entries.length || 0;

  const isModified = useMemo(() => {
    if (!entry) return false;
    return entry.target_key !== (savedTargetKeys[String(entry.entry_id)] ?? null);
  }, [entry, savedTargetKeys]);

  /**
   * Saves the current key setting to the server (only for owners).
   */
  const saveOnline = useCallback(async (silent = false) => {
    if (readOnly || !setlist || !entry || !user || setlist.user_id !== user.id) return;
    try {
      await apiCall('PUT', `/api/setlists/${setlist.id}/entries/${entry.entry_id}`, {
        target_key: entry.target_key,
      });
      setSavedTargetKeys(prev => ({
        ...prev,
        [String(entry.entry_id)]: entry.target_key
      }));
      if (!silent) toast('Key saved to cloud', 'success');
    } catch (e) {
      if (!silent) notifyError(e);
    }
  }, [setlist, entry, apiCall, user, readOnly]);

  /**
   * Saves the current key setting locally in the browser.
   */
  const saveLocal = useCallback((silent = false) => {
    if (readOnly || !setlist || !entry) return;
    saveSetlistOverride(setlist.id, entry.entry_id, {
      target_key: entry.target_key,
    });
    setSavedTargetKeys(prev => ({
      ...prev,
      [String(entry.entry_id)]: entry.target_key
    }));
    if (!silent) toast('Key saved locally', 'success');
  }, [setlist, entry, readOnly]);

  const goTo = useCallback((newIdx: number) => {
    if (!setlist) return;

    if (newIdx < 0 || newIdx >= setlist.entries.length) {
      // Revert URL to current valid index
      if (!setlist.isLocal) replaceHash(setlistPlayHash(setlistId, index));
      return;
    }

    setIndex(newIdx);
    onNavigate?.();

    if (!setlist.isLocal) replaceHash(setlistPlayHash(setlistId, newIdx));

    // Scroll after React re-renders the new song content
    // We use a small timeout to ensure the DOM has actually updated and stabilized
    setTimeout(() => {
      window.scrollTo(0, 0);
      const output = document.querySelector('.chord-sheet-wrap');
      if (output) output.scrollTo(0, 0);
    }, 40);
  }, [setlist, onNavigate, setlistId, index]);

  useWindowEvent('hashchange', () => {
    const play = parsePlayHash(location.hash);
    if (play && play.id === String(setlistId) && play.index !== index) goTo(play.index);
  });

  const prev = useCallback(() => goTo(index - 1), [goTo, index]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);

  const updateEntry = useCallback((updates: Partial<SetlistEntry>) => {
    setSetlist((prev) => {
      if (!prev) return null;
      const newEntries = [...prev.entries];
      newEntries[index] = { ...newEntries[index], ...updates };
      return { ...prev, entries: newEntries };
    });
  }, [index]);

  const exit = useCallback(() => {
    if (setlist) { navigate('setlist-edit', { id: String(setlist.id) }); }
  }, [setlist, navigate]);

  return { loadError, setlist, entry, index, total, goTo, prev, next, exit, updateEntry, isModified, saveOnline, saveLocal };
}
