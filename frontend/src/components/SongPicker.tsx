import { Badge, Flex, Modal, Button, NativeSelect, TextInput, Group, Text } from '@mantine/core';
import { EmptyState } from './EmptyState';
import { ListCard } from './ListCard';
import { CardGrid } from './CardGrid';
import { SearchRow } from './SearchRow';
import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../context/I18nContext';
import { useStackedModalProps } from '../hooks/useStackedModalProps';
import type { SongListItem, SongVersion } from '../types';
import { versionLabel } from '../lib/format';

interface SongPickerProps {
  opened: boolean;
  onPick: (song: SongListItem) => void;
  onClose: () => void;
}

export function SongPicker({ opened, onPick, onClose }: SongPickerProps) {
  const stacked = useStackedModalProps();
  const { t } = useI18n();
  return (
    <Modal opened={opened} onClose={onClose} title={t('setlist.pickSong')} {...stacked}>
      {opened && <SongPickerContent onPick={onPick} />}
    </Modal>
  );
}

function SongPickerContent({ onPick }: Pick<SongPickerProps, 'onPick'>) {
  const api = useApi();
  const { t, tReplace } = useI18n();
  const [songs, setSongs] = useState<SongListItem[]>([]);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [versions, setVersions] = useState<SongVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const load = useCallback(async (q = '') => {
    try {
      const data = await api<SongListItem[]>('GET', '/api/songs/public' + (q ? `?q=${encodeURIComponent(q)}` : ''));
      setSongs(data);
      setExpandedId(null);
    } catch { /* ignore */ }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const handleCardClick = async (s: SongListItem) => {
    if (s.version_count && s.version_count > 1) {
      if (expandedId === s.id) {
        setExpandedId(null);
      } else {
        setExpandedId(s.id);
        setLoadingVersions(true);
        try {
          const v = await api<SongVersion[]>('GET', `/api/songs/${s.id}/versions`);
          setVersions(v);
        } catch { /* ignore */ } finally {
          setLoadingVersions(false);
        }
      }
    } else {
      onPick(s);
    }
  };

  return (
    <>


        <SearchRow mb={8}>
          <TextInput aria-label={t('songs.searchPlaceholder')}
            flex={3}
            miw={0}
            type="search"
            placeholder={t('songs.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(search); }}
            data-autofocus
          />
          <Button variant="default" size="xs" onClick={() => load(search)}>{t('songs.search')}</Button>
        </SearchRow>
        <CardGrid>
          {songs.length === 0 ? (
            <EmptyState text={t('songs.noPublicSongs')} />
          ) : songs.map((s) => (
            <div key={s.id} className="song-picker-item" style={{ display: 'contents' }}>
              <ListCard
                title={s.title}
                meta={<>
                  {s.artist || ''}
                  {(s.version_count ?? 0) > 1 && (
                    <Badge variant="filled" ml={8}>{tReplace('songs.versionCount', { count: s.version_count ?? 0 })}</Badge>
                  )}
                </>}
                onClick={() => { void handleCardClick(s); }}
                style={expandedId === s.id ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' } : undefined}
              />
              {expandedId === s.id && (
                <Flex className="song-card version-list-card" align="center" justify="space-between" wrap="wrap" gap={12} px={16} py={12} mt={-12} bg="var(--bg-alt)" bdrs="0 0 14px 14px" style={{ gridColumn: '1 / -1' }}>
                  {loadingVersions ? (
                    <Text p={8} fz={13} c="dimmed">Loading versions...</Text>
                  ) : (
                    <>
                      <Group gap="xs" wrap="nowrap" maw="100%">
                        <Text component="label" htmlFor={`picker-version-${s.id}`} size="xs" c="dimmed" fw={600}>Version</Text>
                        <NativeSelect
                          id={`picker-version-${s.id}`} size="xs" miw={0}
                          onChange={(e) => {
                            const vId = parseInt(e.target.value);
                            const v = versions.find(ver => ver.id === vId);
                            if (v) onPick({ ...s, id: v.id, username: v.username });
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>Select...</option>
                          {versions.map((v, idx) => (
                            <option key={v.id} value={v.id}>
                              {versionLabel(v, idx)}
                            </option>
                          ))}
                        </NativeSelect>
                      </Group>
                      <Text fz={12} c="dimmed" fw={500}>
                        {versions.length} {t('setlist.versions').toLowerCase()}
                      </Text>
                    </>
                  )}
                </Flex>
              )}
            </div>
          ))}
        </CardGrid>

    </>
  );
}
