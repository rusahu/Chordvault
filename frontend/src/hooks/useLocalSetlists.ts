import { useState, useCallback } from 'react';
import type { LocalSetlist, LocalSetlistEntry } from '../types';
import { getLocalSetlists, saveLocalSetlists } from '../lib/storage';
import { MAX_LOCAL_SETLISTS, MAX_LOCAL_ENTRIES } from '../lib/constants';
import { useWriteLock } from './useWriteLock';

export function useLocalSetlists() {
  const isWriteLocked = useWriteLock();
  const [setlists, setSetlists] = useState<LocalSetlist[]>(() => getLocalSetlists());

  const write = useCallback((all: LocalSetlist[]) => {
    saveLocalSetlists(all);
    setSetlists(all);
  }, []);

  /** Applies `change` to one stored setlist and saves it; a `false` from `change` writes nothing. */
  const mutate = useCallback((id: string, change: (sl: LocalSetlist) => boolean | void) => {
    if (isWriteLocked()) return false;
    const all = getLocalSetlists();
    const sl = all.find((s) => s.id === id);
    if (!sl || change(sl) === false) return false;
    write([...all]);
    return true;
  }, [isWriteLocked, write]);

  const create = useCallback((name: string): LocalSetlist | null => {
    if (isWriteLocked()) return null;
    const all = getLocalSetlists();
    if (all.length >= MAX_LOCAL_SETLISTS) return null;
    const sl: LocalSetlist = { id: 'local_' + Date.now(), name, entries: [] };
    write([...all, sl]);
    return sl;
  }, [isWriteLocked, write]);

  const remove = useCallback((id: string) => {
    if (!isWriteLocked()) write(getLocalSetlists().filter((s) => s.id !== id));
  }, [isWriteLocked, write]);

  const getOne = useCallback((id: string): LocalSetlist | undefined => getLocalSetlists().find((s) => s.id === id), []);

  const rename = useCallback((id: string, name: string) => mutate(id, (sl) => { sl.name = name; }), [mutate]);

  const addEntry = useCallback((id: string, entry: LocalSetlistEntry) => mutate(id, (sl) => {
    if (sl.entries.length >= MAX_LOCAL_ENTRIES) return false;
    sl.entries.push(entry);
  }), [mutate]);

  const removeEntry = useCallback((id: string, idx: number) => mutate(id, (sl) => { sl.entries.splice(idx, 1); }), [mutate]);

  const updateEntry = useCallback((id: string, idx: number, updates: Partial<LocalSetlistEntry>) => mutate(id, (sl) => {
    if (!sl.entries[idx]) return false;
    Object.assign(sl.entries[idx], updates);
  }), [mutate]);

  /**
   * Reorders a local setlist by permuting the STORED records.
   *
   * Takes positions rather than records on purpose: rebuilding entries from
   * what a view holds drops every field that view doesn't carry — a
   * pre-1.23.0 `transpose` today, anything added later tomorrow. An order that
   * isn't a permutation of the stored entries is ignored rather than written,
   * so a stale mapping can never corrupt storage.
   *
   * Returns false when nothing was written, so the caller can tell the user and
   * resync instead of leaving the view showing an order storage never took.
   */
  const reorderEntries = useCallback((id: string, order: number[]) => mutate(id, (sl) => {
    const isPermutation =
      order.length === sl.entries.length &&
      new Set(order).size === order.length &&
      order.every((i) => i >= 0 && i < sl.entries.length);
    if (!isPermutation) return false;
    sl.entries = order.map((i) => sl.entries[i]);
  }), [mutate]);

  return { setlists, create, remove, rename, getOne, addEntry, removeEntry, updateEntry, reorderEntries };
}
