import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { errorMessage } from '../lib/errors';
import { useActiveRef } from './useActiveRef';
import type { LibraryPage, LibraryQuery } from '../types/offline';
import { searchPage, useSearchSessionValue } from './useSearchSessionValue';

export interface PaginatedSearchOptions<T, K extends string> {
  pageKey: string;
  listKey: K;
  filters: LibraryQuery;
  fetchPage: (query: LibraryQuery) => Promise<LibraryPage<T, K>>;
  persist: (filters: LibraryQuery) => void;
  setQuery?: (query: string) => void;
  enabled?: boolean;
}

/** List state shared by the search views. A new `fetchPage` reloads with the latest filters; typing never does. */
export function usePaginatedSearch<T, K extends string>({ pageKey, listKey, filters, fetchPage, persist, setQuery, enabled = true }: PaginatedSearchOptions<T, K>) {
  const [savedPage, savePage] = useSearchSessionValue(pageKey, '1');
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(() => searchPage(savedPage));
  const [totalPages, setTotalPages] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const active = useActiveRef();
  const latestRequest = useRef(0);
  const latestPersist = useRef(persist);

  useEffect(() => { latestPersist.current = persist; });

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
      if (isCurrent()) { setLoadError(errorMessage(e)); setItems([]); }
    }
  }, [active, fetchPage, listKey, savePage]);

  const loadCurrent = useEffectEvent((run: typeof load, on: boolean) => {
    if (on) void run(filters, page);
    else setLoaded(true);
  });
  useEffect(() => { loadCurrent(load, enabled); }, [load, enabled]);

  // A disabled search (e.g. the local setlists tab) only remembers the filters.
  const apply = (next: LibraryQuery) => {
    if (enabled) void load(next);
    else latestPersist.current(next);
  };
  const search = () => apply(filters);
  const refine = (patch: LibraryQuery) => apply({ ...filters, ...patch });
  const clear = () => { setQuery?.(''); refine({ q: '' }); };
  const goToPage = (target: number) => {
    if (!enabled) return;
    void load(filters, target);
    window.scrollTo(0, 0);
  };

  return { items, page, totalPages, loaded, loadError, search, refine, clear, goToPage };
}
