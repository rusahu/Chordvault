import { Alert, Button, Group } from '@mantine/core';
import { useOffline } from '../context/OfflineContext';
import { SearchField } from '../components/SearchField';
import { SearchRow } from '../components/SearchRow';
import { IconCalendar, IconSearch } from '@tabler/icons-react';
import { useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../context/I18nContext';
import { SetlistCard } from '../components/SetlistCard';
import { EmptyState } from '../components/EmptyState';
import { CardGrid } from '../components/CardGrid';
import { Pagination } from '../components/Pagination';
import type { SetlistListItem } from '../types';
import { useSessionField, useSessionToggle } from '../hooks/useSearchSessionValue';
import { searchKey } from '../lib/storage';
import { FilterToggle } from '../components/FilterToggle';
import { DateRangeFilter, type DateRange } from '../components/DateRangeFilter';
import { SetlistTabs } from '../components/SetlistTabs';
import { usePaginatedSearch } from '../hooks/usePaginatedSearch';
import { libraryQueryString } from '../lib/libraryQuery';
import type { LibraryPage, LibraryQuery } from '../types/offline';
import { PageTitle } from '../components/PageTitle';

interface PublicSetlistsViewProps {
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function PublicSetlistsView({ navigate }: PublicSetlistsViewProps) {
  const { readOnly } = useOffline();
  const apiCall = useApi();
  const { t } = useI18n();
  const [query, setQuery, saveQuery] = useSessionField(searchKey('publicsetlists', 'query'));
  const [dateFrom, setDateFrom, saveDateFrom] = useSessionField(searchKey('publicsetlists', 'date_from'));
  const [dateTo, setDateTo, saveDateTo] = useSessionField(searchKey('publicsetlists', 'date_to'));
  const [showDates, toggleDates] = useSessionToggle(searchKey('publicsetlists', 'show_dates'));
  const fetchPublicSetlists = useCallback((filters: LibraryQuery) =>
    apiCall<LibraryPage<SetlistListItem, 'setlists'>>('GET', `/api/setlists/public${libraryQueryString(filters)}`), [apiCall]);
  const { items: setlists, page, totalPages, loaded, loadError, load } = usePaginatedSearch({
    pageKey: searchKey('publicsetlists', 'page'), listKey: 'setlists', fetchPage: fetchPublicSetlists,
    filters: { q: query, dateFrom, dateTo },
    persist: ({ q = '', dateFrom = '', dateTo = '' }) => { saveQuery(q); saveDateFrom(dateFrom); saveDateTo(dateTo); },
  });

  const changeDates = (range: DateRange) => {
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
    load({ q: query, ...range });
  };

  const handleClear = () => {
    setQuery('');
    load({ q: '', dateFrom, dateTo });
  };

  const handleSearch = () => load({ q: query, dateFrom, dateTo });

  const handlePageChange = (newPage: number) => {
    load({ q: query, dateFrom, dateTo }, newPage);
    window.scrollTo(0, 0);
  };

  const showSearch = !!loadError || !!query || !!dateFrom || !!dateTo || !loaded || setlists.length > 0 || page > 1;

  if (readOnly) return <Alert>Other people’s setlists are available online. Open My Setlists to use your download.<Button mt="sm" display="block" onClick={() => navigate('setlists')}>My Setlists</Button></Alert>;

  return (
    <>
      {loadError && <Alert color="red" mb="sm" role="alert">{loadError}</Alert>}
      <Group justify="space-between" mb="lg">
        <PageTitle className="view-title">{t('setlist.browseSetlists')}</PageTitle>
      </Group>
      <SetlistTabs value="public" navigate={navigate} />
      {showSearch && (
        <>
          <SearchRow>
            <SearchField label={t('setlist.searchPlaceholder')} value={query} onChange={setQuery} onSearch={handleSearch} onClear={handleClear} />
            <Button variant="default" size="sm" onClick={handleSearch}>{t('songs.search')}</Button>
            <FilterToggle label="Filter by date" icon={<IconCalendar size={18} aria-hidden />} pressed={showDates} onToggle={toggleDates} />
          </SearchRow>
          {showDates && <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={changeDates} />}
        </>
      )}
      {!loadError && loaded && setlists.length === 0 ? (
        <EmptyState icon={<IconSearch size={56} aria-hidden />} text={t('setlist.noPublicSetlists')} />
      ) : (
        <>
          <CardGrid>
            {setlists.map((sl) => (
              <SetlistCard
                key={sl.id}
                setlist={sl}
                onClick={() => navigate('setlist-edit', { id: String(sl.id) })}
                showUsername
              />
            ))}
          </CardGrid>
          <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}
    </>
  );
}
