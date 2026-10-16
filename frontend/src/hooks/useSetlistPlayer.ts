import { useOfflineActivity } from '../context/OfflineContext';
import { useState, useCallback } from 'react';
import { useWindowEvent } from '@mantine/hooks';
import { useSetlistLoader } from './useSetlistLoader';
import { useEntryKeySave } from './useEntryKeySave';
import { setlistPlayHash, parsePlayHash, replaceHash } from '../lib/routes';
import type { SetlistEntry } from '../types';

interface UseSetlistPlayerOptions {
  setlistId: number | string;
  isLocal?: boolean;
  initialIndex?: number;
  navigate: (view: string, params?: Record<string, string>) => void;
  onNavigate?: () => void;
}

export function useSetlistPlayer({
  setlistId,
  isLocal,
  initialIndex,
  navigate,
  onNavigate,
}: UseSetlistPlayerOptions) {
  useOfflineActivity(true);
  const { setlist, setSetlist, loadError, savedTargetKeys, markSaved } = useSetlistLoader({ setlistId, isLocal, navigate });
  const [index, setIndex] = useState(initialIndex || 0);

  const entry: SetlistEntry | null = setlist?.entries[index] || null;
  const total = setlist?.entries.length || 0;
  const { isModified, saveOnline, saveLocal } = useEntryKeySave({ setlist, entry, savedTargetKeys, markSaved });

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
