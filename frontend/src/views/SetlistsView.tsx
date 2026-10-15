import { Alert, Button, TextInput, Group } from '@mantine/core';
import { useLibraryRead } from '../hooks/useLibraryRead';
import { useOffline } from '../context/OfflineContext';
import { SearchField } from '../components/SearchField';
import { SearchRow } from '../components/SearchRow';
import { IconCalendar, IconPlus, IconMusic } from '@tabler/icons-react';
import { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { showStatusNotification as toast } from '../lib/notifications';
import { useLocalSetlists } from '../hooks/useLocalSetlists';
import { SetlistCard } from '../components/SetlistCard';
import { EmptyState } from '../components/EmptyState';
import { CardGrid } from '../components/CardGrid';
import { Pagination } from '../components/Pagination';
import { useSessionField, useSessionToggle } from '../hooks/useSearchSessionValue';
import { searchKey } from '../lib/storage';
import { FilterToggle } from '../components/FilterToggle';
import { DateRangeFilter, type DateRange } from '../components/DateRangeFilter';
import { SetlistTabs } from '../components/SetlistTabs';
import { usePaginatedSearch } from '../hooks/usePaginatedSearch';
import { PageTitle } from '../components/PageTitle';
import { setlistPlayParams } from '../lib/routes';
import { VISIBILITY, MAX_SETLIST_NAME_LENGTH, MAX_LOCAL_SETLISTS } from '../lib/constants';

interface SetlistsViewProps {
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function SetlistsView({ navigate }: SetlistsViewProps) {
  const apiCall = useApi();
  const { user } = useAuth();
  const { t } = useI18n();
  const { readOnly } = useOffline();
  const { querySetlists } = useLibraryRead();
  const ls = useLocalSetlists();

  const activeTab = user ? 'cloud' : 'local';

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [query, setQuery, saveQuery] = useSessionField(searchKey('setlists', 'query'));
  const [dateFrom, setDateFrom, saveDateFrom] = useSessionField(searchKey('setlists', 'date_from'));
  const [dateTo, setDateTo, saveDateTo] = useSessionField(searchKey('setlists', 'date_to'));
  const [showDates, toggleDates] = useSessionToggle(searchKey('setlists', 'show_dates'));
  const nameRef = useRef<HTMLInputElement>(null);
  const { items: setlists, page, totalPages, loaded, loadError, load } = usePaginatedSearch({
    pageKey: searchKey('setlists', 'page'), listKey: 'setlists', fetchPage: querySetlists,
    filters: { q: query, dateFrom, dateTo },
    persist: ({ q = '', dateFrom = '', dateTo = '' }) => { saveQuery(q); saveDateFrom(dateFrom); saveDateTo(dateTo); },
    enabled: activeTab === 'cloud',
  });

  useEffect(() => { if (showNew && nameRef.current) nameRef.current.focus(); }, [showNew]);

  const create = async () => {
    if (readOnly) return;
    if (!newName.trim()) { toast(t('setlist.nameRequired'), 'error'); return; }
    if (newName.length > MAX_SETLIST_NAME_LENGTH) { toast('Name too long', 'error'); return; }

    if (activeTab === 'local') {
      const sl = ls.create(newName.trim());
      if (!sl) { toast(`Max ${MAX_LOCAL_SETLISTS} setlists`, 'error'); return; }
      toast(t('setlist.created'), 'success');
      navigate('setlist-edit', { id: sl.id });
    } else {
      try {
        const result = await apiCall<{ id: number }>('POST', '/api/setlists', { name: newName.trim() });
        toast(t('setlist.created'), 'success');
        navigate('setlist-edit', { id: String(result.id) });
      } catch (e) { toast((e as Error).message, 'error'); }
    }
  };

  const handleClear = () => {
    setQuery('');
    if (activeTab === 'local') {
      saveQuery('');
    } else {
      load({ q: '', dateFrom, dateTo });
    }
  };

  const handleSearch = () => {
    if (activeTab === 'cloud') {
      load({ q: query, dateFrom, dateTo });
    }
  };

  const handlePageChange = (newPage: number) => {
    if (activeTab === 'cloud') {
      load({ q: query, dateFrom, dateTo }, newPage);
      window.scrollTo(0, 0);
    }
  };

  const changeDates = (range: DateRange) => {
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
    load({ q: query, ...range });
  };

  const localSetlistsToRender = query.trim()
    ? ls.setlists.filter(sl => sl.name.toLowerCase().includes(query.toLowerCase()))
    : ls.setlists;

  return (
    <>
      {loadError && <Alert color="red" mb="sm" role="alert">{loadError}</Alert>}
      <Group justify="space-between" mb="lg">
        <PageTitle className="view-title">{t('setlist.title')}</PageTitle>
        <Button disabled={readOnly} size="xs" className="btn btn-sm" leftSection={<IconPlus size={14} aria-hidden />} onClick={() => setShowNew(true)}>{t('setlist.newSetlist')}</Button>
      </Group>
      <SetlistTabs value="mine" navigate={navigate} />
      {!user && (
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
          These setlists are saved in your browser. Sign in to create server-synced setlists.
        </p>
      )}
      {showNew && (
        <SearchRow mb={16}>
          <TextInput aria-label={t('setlist.namePlaceholder')}
            flex={3}
            miw={0}
            ref={nameRef}
            type="text"
            placeholder={t('setlist.namePlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
          />
          <Button size="xs" className="btn btn-sm" onClick={create}>{t('setlist.create')}</Button>
          <Button variant="default" size="xs" className="btn btn-ghost btn-sm" onClick={() => setShowNew(false)}>{t('songEdit.cancel')}</Button>
        </SearchRow>
      )}
      <SearchRow>
        <SearchField label={t('setlist.searchPlaceholder')} value={query} onSearch={handleSearch} onClear={handleClear}
          onChange={(val) => {
            setQuery(val);
            if (activeTab === 'local') saveQuery(val);
          }} />
        <Button variant="default" size="sm" onClick={handleSearch}>{t('songs.search')}</Button>
        {activeTab === 'cloud' && (
          <FilterToggle label="Filter by date" icon={<IconCalendar size={18} aria-hidden />} pressed={showDates} onToggle={toggleDates} />
        )}
      </SearchRow>
      {activeTab === 'cloud' && showDates && <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={changeDates} />}
      <CardGrid>
        {!loadError && loaded && (
          activeTab === 'cloud' ? (
            setlists.length === 0 ? (
              <EmptyState icon={<IconMusic size={56} aria-hidden />} text={t('setlist.noSetlists')} />
            ) : (
              setlists.map((sl) => (
                <SetlistCard
                  key={sl.id}
                  setlist={sl}
                  onClick={() => navigate('setlist-edit', { id: String(sl.id) })}
                  onPlay={() => navigate('setlist-play', setlistPlayParams(sl.id))}
                />
              ))
            )
          ) : (
            localSetlistsToRender.length === 0 ? (
              <EmptyState icon={<IconMusic size={56} aria-hidden />} text={t('setlist.noSetlists')} />
            ) : (
              localSetlistsToRender.map((sl) => (
                <SetlistCard
                  key={sl.id}
                  setlist={{
                    id: sl.id,
                    name: sl.name,
                    visibility: VISIBILITY.PRIVATE,
                    song_count: sl.entries.length,
                    event_date: null,
                  }}
                  onClick={() => navigate('setlist-edit', { id: sl.id })}
                  onPlay={() => navigate('setlist-play', setlistPlayParams(sl.id))}
                />
              ))
            )
          )
        )}
      </CardGrid>
      {activeTab === 'cloud' && (
        <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
      )}
    </>
  );
}
