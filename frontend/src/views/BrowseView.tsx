import { Alert, ActionIcon, Button, NativeSelect, SimpleGrid, Box, Title, Text, Group } from '@mantine/core';
import { useLibraryRead } from '../hooks/useLibraryRead';
import { useOffline } from '../context/OfflineContext';
import { SearchField } from '../components/SearchField';
import { SearchRow } from '../components/SearchRow';
import { IconAdjustmentsHorizontal, IconPlus, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { SongCard } from '../components/SongCard';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import { LANGUAGES } from '../lib/languages';
import { useSearchSessionValue } from '../hooks/useSearchSessionValue';
import { usePaginatedSearch } from '../hooks/usePaginatedSearch';
import { TagFilter } from '../components/TagFilter';
import { splitTags } from '../lib/tagName';

interface BrowseViewProps {
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function BrowseView({ navigate }: BrowseViewProps) {
  const { querySongs } = useLibraryRead();
  const { readOnly } = useOffline();
  const { user } = useAuth();
  const { t } = useI18n();
  const [savedQuery, saveQuery] = useSearchSessionValue('cv_browse_query');
  const [query, setQuery] = useState(savedQuery);
  const [savedLangFilter, saveLangFilter] = useSearchSessionValue('cv_browse_lang');
  const [langFilter, setLangFilter] = useState(savedLangFilter);
  const [savedTagFilter, saveTagFilter] = useSearchSessionValue('cv_browse_tags');
  const [tagFilter, setTagFilter] = useState(() => splitTags(savedTagFilter));
  const filters = { q: query, language: langFilter, tags: tagFilter };
  const hasFilters = Boolean(langFilter || tagFilter.length);
  const [savedShowFilters, saveShowFilters] = useSearchSessionValue('cv_browse_show_filters', 'false');
  const showFilters = savedShowFilters === 'true';
  const { items: songs, page, totalPages, loaded, loadError, load } = usePaginatedSearch({
    pageKey: 'cv_browse_page', listKey: 'songs', fetchPage: querySongs,
    filters,
    persist: ({ q = '', language = '', tags = [] }) => { saveQuery(q); saveLangFilter(language); saveTagFilter(tags.join(',')); },
  });

  const handleClear = () => {
    setQuery('');
    load({ ...filters, q: '' });
  };

  const doSearch = () => load(filters);

  const handlePageChange = (newPage: number) => {
    load(filters, newPage);
    window.scrollTo(0, 0);
  };

  const showHero = !user && !query && !hasFilters && !loadError && loaded && songs.length === 0 && page === 1;

  return (
    <>
      {loadError && <Alert color="red" mb="sm" role="alert">{loadError}</Alert>}
      {showHero ? (
        <Box ta="center" px="md" pt={48} pb={36} mb="xs">
          <Title order={1} size={42} c="var(--cv-brand)" mb="xs">&#9833; ChordVault</Title>
          <Text size="lg" mb={6}>{t('hero.tagline')}</Text>
          <Text size="sm" c="dimmed" maw={360} mx="auto">{t('hero.cta')}</Text>
          <Group mt="md" gap="sm" justify="center">
            <Button className="btn" onClick={() => navigate('auth')}>{t('auth.signIn')}</Button>
            <Button variant="default" className="btn btn-ghost" onClick={() => navigate('about')}>Learn more</Button>
          </Group>
        </Box>
      ) : (
        <>
          <SearchRow>
            <SearchField label={t('songs.searchPlaceholder')} value={query} onChange={setQuery} onSearch={doSearch} onClear={handleClear} />
            <Button variant="default" size="sm" onClick={doSearch}>{t('songs.search')}</Button>
            <ActionIcon
              size="input-sm"
              variant={showFilters || hasFilters ? 'filled' : 'default'}
              aria-label="Filters"
              aria-pressed={showFilters}
              title="Filters"
              onClick={() => {
                const next = !showFilters;
                saveShowFilters(String(next));
              }}
            >
              <IconAdjustmentsHorizontal size={18} aria-hidden />
            </ActionIcon>
            {user && (
              <Button size="sm" w={{ base: '100%', xs: 'auto' }} leftSection={<IconPlus size={16} aria-hidden />} disabled={readOnly} onClick={() => navigate('song-edit')}>New Song</Button>
            )}
          </SearchRow>
          {showFilters && (
            <div className="search-filters">
              <NativeSelect
                className="language-filter"
                aria-label={t('songs.language')}
                value={langFilter}
                onChange={(e) => { setLangFilter(e.target.value); load({ ...filters, language: e.target.value }); }}
              >
                <option value="">All languages</option>
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </NativeSelect>
              <TagFilter value={tagFilter} onChange={next => { setTagFilter(next); load({ ...filters, tags: next }); }} />
            </div>
          )}
          <SimpleGrid className="song-grid" minColWidth="min(100%, 320px)" autoFlow="auto-fill" spacing={12}>
            {!loadError && loaded && songs.length === 0 ? (
              <EmptyState icon={<IconSearch size={56} aria-hidden />} text={t('songs.noPublicSongs')} />
            ) : (
              songs.map((s) => (
                <SongCard
                  key={s.id}
                  song={s}
                  isOwner={user?.username === s.username}
                  onClick={() => navigate('song-view', { id: String(s.id) })}
                  onEdit={readOnly ? undefined : () => navigate('song-edit', { id: String(s.id) })}
                />
              ))
            )}
          </SimpleGrid>
          <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}
    </>
  );
}
