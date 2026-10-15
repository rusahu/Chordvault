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
import { useSetlistSearchFilters } from '../hooks/useSearchSessionValue';
import { LoadErrorAlert } from '../components/LoadErrorAlert';
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
  const { query, setQuery, dateFrom, dateTo, setDates, showDates, toggleDates, search: searchOptions } = useSetlistSearchFilters('publicsetlists');
  const fetchPublicSetlists = useCallback((filters: LibraryQuery) =>
    apiCall<LibraryPage<SetlistListItem, 'setlists'>>('GET', `/api/setlists/public${libraryQueryString(filters)}`), [apiCall]);
  const { items: setlists, page, totalPages, loaded, loadError, search, refine, clear, goToPage } = usePaginatedSearch({
    ...searchOptions, listKey: 'setlists', fetchPage: fetchPublicSetlists,
  });
  const changeDates = (range: DateRange) => { setDates(range); refine(range); };

  const showSearch = !!loadError || !!query || !!dateFrom || !!dateTo || !loaded || setlists.length > 0 || page > 1;

  if (readOnly) return <Alert>Other people’s setlists are available online. Open My Setlists to use your download.<Button mt="sm" display="block" onClick={() => navigate('setlists')}>My Setlists</Button></Alert>;

  return (
    <>
      <LoadErrorAlert message={loadError} />
      <Group justify="space-between" mb="lg">
        <PageTitle className="view-title">{t('setlist.browseSetlists')}</PageTitle>
      </Group>
      <SetlistTabs value="public" navigate={navigate} />
      {showSearch && (
        <>
          <SearchRow>
            <SearchField label={t('setlist.searchPlaceholder')} value={query} onChange={setQuery} onSearch={search} onClear={clear} />
            <Button variant="default" size="sm" onClick={search}>{t('songs.search')}</Button>
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
          <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
        </>
      )}
    </>
  );
}
