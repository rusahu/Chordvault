import { Alert, Tabs, Button, TextInput, ActionIcon, SimpleGrid, Group } from '@mantine/core';
import { useOffline } from '../context/OfflineContext';
import { SearchField } from '../components/SearchField';
import { SearchRow } from '../components/SearchRow';
import { IconCalendar, IconSearch } from '@tabler/icons-react';
import { useState, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../context/I18nContext';
import { SetlistCard } from '../components/SetlistCard';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import type { SetlistListItem } from '../types';
import { useSearchSessionValue } from '../hooks/useSearchSessionValue';
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
  const [savedQuery, saveQuery] = useSearchSessionValue('cv_publicsetlists_query');
  const [query, setQuery] = useState(savedQuery);
  const [savedDateFrom, saveDateFrom] = useSearchSessionValue('cv_publicsetlists_date_from');
  const [dateFrom, setDateFrom] = useState(savedDateFrom);
  const [savedDateTo, saveDateTo] = useSearchSessionValue('cv_publicsetlists_date_to');
  const [dateTo, setDateTo] = useState(savedDateTo);
  const [savedShowDates, saveShowDates] = useSearchSessionValue('cv_publicsetlists_show_dates', 'false');
  const showDates = savedShowDates === 'true';
  const fetchPublicSetlists = useCallback((filters: LibraryQuery) =>
    apiCall<LibraryPage<SetlistListItem, 'setlists'>>('GET', `/api/setlists/public${libraryQueryString(filters)}`), [apiCall]);
  const { items: setlists, page, totalPages, loaded, loadError, load } = usePaginatedSearch({
    pageKey: 'cv_publicsetlists_page', listKey: 'setlists', fetchPage: fetchPublicSetlists,
    filters: { q: query, dateFrom, dateTo },
    persist: ({ q = '', dateFrom = '', dateTo = '' }) => { saveQuery(q); saveDateFrom(dateFrom); saveDateTo(dateTo); },
  });

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
      <Tabs variant="pills" value="public" onChange={(tab) => navigate(tab === 'public' ? 'public-setlists' : 'setlists')} className="setlist-tabs">
        <Tabs.List grow><Tabs.Tab value="mine">My Setlists</Tabs.Tab><Tabs.Tab value="public">Public Setlists</Tabs.Tab></Tabs.List>
      </Tabs>
      {showSearch && (
        <>
          <SearchRow>
            <SearchField label={t('setlist.searchPlaceholder')} value={query} onChange={setQuery} onSearch={handleSearch} onClear={handleClear} />
            <Button variant="default" size="sm" onClick={handleSearch}>{t('songs.search')}</Button>
            <ActionIcon
              size="input-sm"
              variant={showDates ? 'filled' : 'default'}
              aria-label="Filter by date"
              aria-pressed={showDates}
              title="Filter by date"
              onClick={() => {
                const next = !showDates;
                saveShowDates(String(next));
              }}
            >
              <IconCalendar size={18} aria-hidden />
            </ActionIcon>
          </SearchRow>
          {showDates && (
            <SearchRow mt={-10}>
              <TextInput label={<>From</>} type="date" flex={1} miw={0} value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); load({ q: query, dateFrom: e.target.value, dateTo }); }} />
              <TextInput label={<>To</>} type="date" flex={1} miw={0} value={dateTo} onChange={(e) => { setDateTo(e.target.value); load({ q: query, dateFrom, dateTo: e.target.value }); }} />
            </SearchRow>
          )}
        </>
      )}
      {!loadError && loaded && setlists.length === 0 ? (
        <EmptyState icon={<IconSearch size={56} aria-hidden />} text={t('setlist.noPublicSetlists')} />
      ) : (
        <>
          <SimpleGrid className="song-grid" minColWidth="min(100%, 320px)" autoFlow="auto-fill" spacing={12}>
            {setlists.map((sl) => (
              <SetlistCard
                key={sl.id}
                setlist={sl}
                onClick={() => navigate('setlist-edit', { id: String(sl.id) })}
                showUsername
              />
            ))}
          </SimpleGrid>
          <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}
    </>
  );
}
