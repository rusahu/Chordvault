import { Button, TextInput, Group, Text } from '@mantine/core';
import { useLibraryRead } from '../hooks/useLibraryRead';
import { useOffline } from '../context/OfflineContext';
import { SearchField } from '../components/SearchField';
import { SearchRow } from '../components/SearchRow';
import { IconCalendar, IconPlus, IconMusic } from '@tabler/icons-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { showStatusNotification as toast } from '../lib/notifications';
import { notifyError } from '../lib/errors';
import { useSetlistStore } from '../hooks/useSetlistStore';
import { SetlistCard } from '../components/SetlistCard';
import { EmptyState } from '../components/EmptyState';
import { CardGrid } from '../components/CardGrid';
import { Pagination } from '../components/Pagination';
import { useSetlistSearchFilters } from '../hooks/useSearchSessionValue';
import { LoadErrorAlert } from '../components/LoadErrorAlert';
import { FilterToggle } from '../components/FilterToggle';
import { DateRangeFilter, type DateRange } from '../components/DateRangeFilter';
import { SetlistTabs } from '../components/SetlistTabs';
import { usePaginatedSearch } from '../hooks/usePaginatedSearch';
import { PageTitle } from '../components/PageTitle';
import { setlistPlayParams, type Navigate } from '../lib/routes';
import { MAX_SETLIST_NAME_LENGTH } from '../lib/constants';
import { localSetlistToListItem } from '../lib/setlists';

interface SetlistsViewProps {
  navigate: Navigate;
}

export function SetlistsView({ navigate }: SetlistsViewProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { readOnly } = useOffline();
  const { querySetlists } = useLibraryRead();
  const activeTab = user ? 'cloud' : 'local';
  const store = useSetlistStore(activeTab === 'local');

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const { query, setQuery, dateFrom, dateTo, setDates, showDates, toggleDates, search: searchOptions } = useSetlistSearchFilters('setlists');
  const nameRef = useRef<HTMLInputElement>(null);
  const { items: setlists, page, totalPages, loaded, loadError, search, refine, clear, goToPage } = usePaginatedSearch({
    ...searchOptions, listKey: 'setlists', fetchPage: querySetlists, enabled: activeTab === 'cloud',
  });

  useEffect(() => { if (showNew && nameRef.current) nameRef.current.focus(); }, [showNew]);

  const create = async () => {
    if (readOnly) return;
    if (!newName.trim()) { toast(t('setlist.nameRequired'), 'error'); return; }
    if (newName.length > MAX_SETLIST_NAME_LENGTH) { toast('Name too long', 'error'); return; }
    try {
      const id = await store.create(newName.trim());
      toast(t('setlist.created'), 'success');
      navigate('setlist-edit', { id });
    } catch (e) { notifyError(e); }
  };

  const changeDates = (range: DateRange) => { setDates(range); refine(range); };

  const localSetlistsToRender = query.trim()
    ? store.setlists.filter(sl => sl.name.toLowerCase().includes(query.toLowerCase()))
    : store.setlists;

  return (
    <>
      <LoadErrorAlert message={loadError} />
      <Group justify="space-between" mb="lg">
        <PageTitle className="view-title">{t('setlist.title')}</PageTitle>
        <Button disabled={readOnly} size="xs" leftSection={<IconPlus size={14} aria-hidden />} onClick={() => setShowNew(true)}>{t('setlist.newSetlist')}</Button>
      </Group>
      <SetlistTabs value="mine" navigate={navigate} />
      {!user && (
        <Text fz={13} c="dimmed" mb={16}>
          These setlists are saved in your browser. Sign in to create server-synced setlists.
        </Text>
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
          <Button size="xs" onClick={create}>{t('setlist.create')}</Button>
          <Button variant="default" size="xs" onClick={() => setShowNew(false)}>{t('songEdit.cancel')}</Button>
        </SearchRow>
      )}
      <SearchRow>
        <SearchField label={t('setlist.searchPlaceholder')} value={query} onSearch={search} onClear={clear}
          onChange={(val) => {
            setQuery(val);
            if (activeTab === 'local') refine({ q: val });
          }} />
        <Button variant="default" size="sm" onClick={search}>{t('songs.search')}</Button>
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
                  setlist={localSetlistToListItem(sl)}
                  onClick={() => navigate('setlist-edit', { id: sl.id })}
                  onPlay={() => navigate('setlist-play', setlistPlayParams(sl.id))}
                />
              ))
            )
          )
        )}
      </CardGrid>
      {activeTab === 'cloud' && (
        <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
      )}
    </>
  );
}
