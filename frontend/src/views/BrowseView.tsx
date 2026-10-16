import { Button, NativeSelect, Box, Title, Text, Group, Flex } from '@mantine/core';
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
import { CardGrid } from '../components/CardGrid';
import { Pagination } from '../components/Pagination';
import { LANGUAGES } from '../lib/languages';
import { useSearchSessionValue, useSessionField, useSessionToggle } from '../hooks/useSearchSessionValue';
import { usePaginatedSearch } from '../hooks/usePaginatedSearch';
import { TagFilter } from '../components/TagFilter';
import { FilterToggle } from '../components/FilterToggle';
import { splitTags } from '../lib/tagName';
import { searchKey } from '../lib/storage';
import { LoadErrorAlert } from '../components/LoadErrorAlert';

interface BrowseViewProps {
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function BrowseView({ navigate }: BrowseViewProps) {
  const { querySongs } = useLibraryRead();
  const { readOnly } = useOffline();
  const { user } = useAuth();
  const { t } = useI18n();
  const [query, setQuery, saveQuery] = useSessionField(searchKey('browse', 'query'));
  const [langFilter, setLangFilter, saveLangFilter] = useSessionField(searchKey('browse', 'lang'));
  const [savedTagFilter, saveTagFilter] = useSearchSessionValue(searchKey('browse', 'tags'));
  const [tagFilter, setTagFilter] = useState(() => splitTags(savedTagFilter));
  const filters = { q: query, language: langFilter, tags: tagFilter };
  const hasFilters = Boolean(langFilter || tagFilter.length);
  const [showFilters, toggleFilters] = useSessionToggle(searchKey('browse', 'show_filters'));
  const { items: songs, page, totalPages, loaded, loadError, search, refine, clear, goToPage } = usePaginatedSearch({
    pageKey: searchKey('browse', 'page'), listKey: 'songs', fetchPage: querySongs,
    filters, setQuery,
    persist: ({ q = '', language = '', tags = [] }) => { saveQuery(q); saveLangFilter(language); saveTagFilter(tags.join(',')); },
  });

  const showHero = !user && !query && !hasFilters && !loadError && loaded && songs.length === 0 && page === 1;

  return (
    <>
      <LoadErrorAlert message={loadError} />
      {showHero ? (
        <Box ta="center" px="md" pt={48} pb={36} mb="xs">
          <Title order={1} size={42} c="var(--cv-brand)" mb="xs">&#9833; ChordVault</Title>
          <Text size="lg" mb={6}>{t('hero.tagline')}</Text>
          <Text size="sm" c="dimmed" maw={360} mx="auto">{t('hero.cta')}</Text>
          <Group mt="md" gap="sm" justify="center">
            <Button onClick={() => navigate('auth')}>{t('auth.signIn')}</Button>
            <Button variant="default" onClick={() => navigate('about')}>Learn more</Button>
          </Group>
        </Box>
      ) : (
        <>
          <SearchRow>
            <SearchField label={t('songs.searchPlaceholder')} value={query} onChange={setQuery} onSearch={search} onClear={clear} />
            <Button variant="default" size="sm" onClick={search}>{t('songs.search')}</Button>
            <FilterToggle label="Filters" icon={<IconAdjustmentsHorizontal size={18} aria-hidden />} pressed={showFilters} active={showFilters || hasFilters} onToggle={toggleFilters} />
            {user && (
              <Button size="sm" w={{ base: '100%', xs: 'auto' }} leftSection={<IconPlus size={16} aria-hidden />} disabled={readOnly} onClick={() => navigate('song-edit')}>{t('songs.newSong', 'New Song')}</Button>
            )}
          </SearchRow>
          {showFilters && (
            <Flex direction={{ base: 'column', xs: 'row' }} gap={{ base: 8, xs: 10 }} mt={{ base: 0, xs: -12 }} mb={16}>
              <NativeSelect
                maw={{ base: 'none', xs: 220 }}
                aria-label={t('songs.language')}
                value={langFilter}
                onChange={(e) => { setLangFilter(e.target.value); refine({ language: e.target.value }); }}
              >
                <option value="">All languages</option>
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </NativeSelect>
              <TagFilter value={tagFilter} onChange={next => { setTagFilter(next); refine({ tags: next }); }} />
            </Flex>
          )}
          <CardGrid>
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
          </CardGrid>
          <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
        </>
      )}
    </>
  );
}
