import { useSessionStorage } from '@mantine/hooks';
import { useState } from 'react';
import { searchKey } from '../lib/storage';
import type { DateRange } from '../components/DateRangeFilter';
import type { LibraryQuery } from '../types/offline';

export function useSearchSessionValue(key: string, defaultValue = '') {
  return useSessionStorage<string>({
    key,
    defaultValue,
    getInitialValueInEffect: false,
    sync: false,
    serialize: value => value,
    deserialize: value => value ?? defaultValue,
  });
}

/** A view's working value seeded from session storage; the third item saves it after a successful search. */
export function useSessionField(key: string, defaultValue = '') {
  const [saved, save] = useSearchSessionValue(key, defaultValue);
  const [value, setValue] = useState(saved);
  return [value, setValue, save] as const;
}

export function useSessionToggle(key: string) {
  const [saved, save] = useSearchSessionValue(key, 'false');
  const on = saved === 'true';
  return [on, () => save(String(!on))] as const;
}

export function searchPage(value: string): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

/** The query and date filters of a setlist list, kept for the session. `search` feeds usePaginatedSearch. */
export function useSetlistSearchFilters(view: 'setlists' | 'publicsetlists') {
  const [query, setQuery, saveQuery] = useSessionField(searchKey(view, 'query'));
  const [dateFrom, setDateFrom, saveDateFrom] = useSessionField(searchKey(view, 'date_from'));
  const [dateTo, setDateTo, saveDateTo] = useSessionField(searchKey(view, 'date_to'));
  const [showDates, toggleDates] = useSessionToggle(searchKey(view, 'show_dates'));
  const setDates = (range: DateRange) => { setDateFrom(range.dateFrom); setDateTo(range.dateTo); };
  const persist = ({ q = '', dateFrom = '', dateTo = '' }: LibraryQuery) => { saveQuery(q); saveDateFrom(dateFrom); saveDateTo(dateTo); };
  return {
    query, setQuery, dateFrom, dateTo, setDates, showDates, toggleDates,
    search: { pageKey: searchKey(view, 'page'), filters: { q: query, dateFrom, dateTo }, persist, setQuery },
  };
}
