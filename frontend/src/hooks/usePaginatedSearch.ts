import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import type { LibraryPage, LibraryQuery } from '../types/offline';
import { searchPage, useSearchSessionValue } from './useSearchSessionValue';

export interface PaginatedSearchOptions<T, K extends string> {
  pageKey: string;
  listKey: K;
  filters: LibraryQuery;
  fetchPage: (query: LibraryQuery) => Promise<LibraryPage<T, K>>;
  persist: (filters: LibraryQuery) => void;
  enabled?: boolean;
}

/** List state shared by the search views. A new `fetchPage` reloads with the latest filters; typing never does. */
export function usePaginatedSearch<T, K extends string>({ pageKey, listKey, filters, fetchPage, persist, enabled = true }: PaginatedSearchOptions<T, K>) {
  const [savedPage, savePage] = useSearchSessionValue(pageKey, '1');
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(() => searchPage(savedPage));
  const [totalPages, setTotalPages] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const active = useRef(false);
  const latestRequest = useRef(0);
  const latestPersist = useRef(persist);

  useEffect(() => { latestPersist.current = persist; });
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const load = useCallback(async (next: LibraryQuery, targetPage = 1) => {
    const request = ++latestRequest.current;
    const isCurrent = () => active.current && request === latestRequest.current;
    setLoadError('');
    try {
      const data = await fetchPage({ ...next, page: targetPage });
      if (!isCurrent()) return;
      const lists: Record<K, T[]> = data;
      setItems(lists[listKey]);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setLoaded(true);
      latestPersist.current(next);
      savePage(String(data.page));
    } catch (e) {
      if (isCurrent()) { setLoadError((e as Error).message); setItems([]); }
    }
  }, [fetchPage, listKey, savePage]);

  const loadCurrent = useEffectEvent((run: typeof load, on: boolean) => {
    if (on) void run(filters, page);
    else setLoaded(true);
  });
  useEffect(() => { loadCurrent(load, enabled); }, [load, enabled]);

  return { items, page, totalPages, loaded, loadError, load };
}
