import { useLibraryRead } from '../hooks/useLibraryRead';
import { useOffline } from '../context/OfflineContext';
import { useDisclosure } from '@mantine/hooks';
import { Alert, Badge, Paper, Button, NativeSelect, Group, Box, Text, Divider, ScrollArea } from '@mantine/core';
import { SectionTitle } from '../components/SectionTitle';
import { IconBrandYoutube, IconLock, IconPencil, IconPlus } from '@tabler/icons-react';
import { BackButton } from '../components/BackButton';
import { useState, useEffect, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { showStatusNotification as toast } from '../lib/notifications';
import { useChordRenderer } from '../hooks/useChordRenderer';
import { useFontScale } from '../hooks/useFontScale';
import { useTwoCol } from '../hooks/useTwoCol';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { ChordSheet } from '../components/ChordSheet';
import { Toolbar } from '../components/Toolbar';
import { Loading } from '../components/Loading';
import { AddToSetlistModal } from '../components/AddToSetlistModal';
import { renderChordPro, autoFit } from '../lib/chords';
import { LanguageBadge } from '../components/LanguageBadge';
import type { Song, SongVersion, Correction } from '../types';
import { TagBadges } from '../components/TagBadges';
import { PageTitle } from '../components/PageTitle';
import { VISIBILITY } from '../lib/constants';
import { formatDbDate, versionLabel } from '../lib/format';
import { errorMessage, confirmAction } from '../lib/errors';
import { usePdfExport } from '../hooks/usePdfExport';
import type { Navigate } from '../lib/routes';

interface SongViewProps {
  songId: number;
  navigate: Navigate;
}

export function SongView({ songId, navigate }: SongViewProps) {
  const apiCall = useApi();
  const { getSong, getVersions } = useLibraryRead();
  const { readOnly } = useOffline();
  const { user } = useAuth();
  const { t, tReplace } = useI18n();
  const [loadError, setLoadError] = useState('');
  const [song, setSong] = useState<Song | null>(null);
  const [versions, setVersions] = useState<SongVersion[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [addToSetlistOpen, addToSetlist] = useDisclosure(false);

  useEffect(() => {
    setSong(null);
    setLoadError('');
    getSong(songId)
      .then(setSong)
      .catch((e) => setLoadError(errorMessage(e)));
  }, [songId, getSong, user]);

  useEffect(() => {
    if (!song) return;
    getVersions(songId)
      .then((v) => { if (v.length > 1) setVersions(v); })
      .catch(() => {});
    if (user && user.username === song.username) {
      apiCall<Correction[]>('GET', `/api/songs/${songId}/corrections`)
        .then(setCorrections)
        .catch(() => {});
    }
  }, [song, songId, getVersions, apiCall, user]);

  const content = song?.content || '';
  const chord = useChordRenderer(content);
  const { setTargetKey: resetChordKey, setNashville: resetChordNashville } = chord;
  const fontScale = useFontScale();
  const twoColState = useTwoCol();

  const handleAutoFit = () => {
    const result = autoFit();
    fontScale.setFontSizeTo(result.fontSize);
    twoColState.setTwoColTo(result.twoCol);
    window.scrollTo(0, 0);
  };

  // Reset key/nashville when navigating to a different song
  useEffect(() => {
    resetChordKey(null);
    resetChordNashville(false);
  }, [songId, resetChordKey, resetChordNashville]);

  const shortcuts = useMemo(() => ({
    'ArrowUp': (e: KeyboardEvent) => { e.preventDefault(); chord.stepCurrentKey(1); },
    'ArrowDown': (e: KeyboardEvent) => { e.preventDefault(); chord.stepCurrentKey(-1); },
    '+': (e: KeyboardEvent) => { e.preventDefault(); chord.stepCurrentKey(1); },
    '-': (e: KeyboardEvent) => { e.preventDefault(); chord.stepCurrentKey(-1); },
    '0': () => chord.resetKey(),
    'n': () => chord.toggleNashville(!chord.nashville),
    'N': () => chord.toggleNashville(!chord.nashville),
  }), [chord]);

  useKeyboardShortcuts(shortcuts, !!song);

  const isOwner = user && song && user.username === song.username;

  const exportPdf = usePdfExport();
  const handleExportPdf = () => {
    if (!song) return;
    void exportPdf('PDF exported', async () => (await import('../lib/pdf-export')).exportSongPdf(song, {
      transpose: chord.transpose, nashville: chord.nashville, fontSize: fontScale.fontSize,
    }));
  };



  const approveCorrection = (id: number) => confirmAction('Apply this correction? The original song content will be updated.', async () => {
    await apiCall('PUT', `/api/corrections/${id}/approve`);
    toast('Correction approved', 'success');
    setSong(null);
    setSong(await getSong(songId));
  });

  const rejectCorrection = (id: number) => confirmAction('Reject and delete this correction?', async () => {
    await apiCall('DELETE', `/api/corrections/${id}`);
    toast('Correction rejected', 'success');
    setCorrections((prev) => prev.filter((c) => c.id !== id));
  });

  if (loadError) return <Alert title="Song unavailable" color="red">{loadError}<Button mt="sm" display="block" onClick={() => navigate('browse')}>Back to songs</Button></Alert>;
  if (!song) return <Loading />;

  return (
    <div lang={song.language || undefined}>
      <Box mb="lg">
        <Group justify="space-between" mb="md">
          <BackButton onClick={() => navigate(user ? 'my-songs' : 'browse')}>{t('songView.back')}</BackButton>
          <Group gap="xs">
            {isOwner && (
              <Button disabled={readOnly} variant="default" size="xs" leftSection={<IconPencil size={14} aria-hidden />} onClick={() => navigate('song-edit', { id: String(song.id) })}>
                {t('songView.edit')}
              </Button>
            )}
            {user && !isOwner && song.visibility !== VISIBILITY.PRIVATE && (
              <>
                <Button disabled={readOnly} variant="default" size="xs" leftSection={<IconPlus size={14} aria-hidden />} onClick={() => navigate('song-edit', { id: String(song.id) })}>
                  {t('songEdit.createVersion')}
                </Button>
                <Button variant="default" size="xs" disabled={readOnly} leftSection={<IconPencil size={14} aria-hidden />} onClick={() => navigate('correction', { id: String(song.id) })}>
                  Correction
                </Button>
              </>
            )}
            <Button variant="default" size="xs" disabled={readOnly} leftSection={<IconPlus size={14} aria-hidden />} onClick={addToSetlist.open}>
              {t('songView.addToSetlist')}
            </Button>
          </Group>
        </Group>
        <PageTitle order={1} className="song-view-title">{song.title}</PageTitle>
        {song.artist && <Text size="lg" c="dimmed" mt={4}>{song.artist}</Text>}
        <Group gap="xs" mt="xs">
          {!isOwner && song.username && <span className="song-view-by">@{song.username}</span>}
          {song.bpm && <Badge>{song.bpm} bpm</Badge>}
          {song.language && <LanguageBadge code={song.language} />}
          {isOwner && song.visibility === VISIBILITY.PRIVATE && <Badge leftSection={<IconLock size={14} aria-hidden />}>Private</Badge>}
          {versions.length > 1 && (
            <Group gap="xs" wrap="nowrap">
              <Text component="label" htmlFor="song-version" size="xs" c="dimmed" fw={600}>Version</Text>
              <NativeSelect
                id="song-version" size="xs"
                value={songId}
                onChange={(e) => navigate('song-view', { id: e.target.value })}
              >
                {versions.map((v, idx) => (
                  <option key={v.id} value={v.id}>
                    {versionLabel(v, idx)}
                  </option>
                ))}
              </NativeSelect>
            </Group>
          )}
        </Group>
      </Box>

      <Toolbar
        currentKey={chord.currentKey}
        nashville={chord.nashville}
        nashvilleDisabled={!chord.hasKey}
        onNashvilleChange={chord.toggleNashville}
        twoCol={twoColState.twoCol}
        onTwoColToggle={twoColState.toggleTwoCol}
        fontSize={fontScale.fontSize}
        onFontChange={fontScale.changeFontSize}
        onReset={() => {
          fontScale.resetFontSize();
          twoColState.setTwoColTo(false);
        }}
        onPickKey={chord.pickKey}
        onAutoFit={handleAutoFit}
        onExportPdf={handleExportPdf}
        renderKey={songId}
      />

      <ChordSheet
        html={chord.renderedHtml}
        twoCol={twoColState.twoCol}
        fontSize={fontScale.fontSize}
      />

      {(song.tags || song.youtube_url) && (
        <Group gap="xs" mt="xs">
          <TagBadges tags={song.tags} />
          {song.youtube_url && (
            <Button component="a" href={song.youtube_url} target="_blank" rel="noopener" variant="default" size="xs"
              leftSection={<IconBrandYoutube size={16} color="var(--mantine-color-red-6)" aria-hidden />}>YouTube</Button>
          )}
        </Group>
      )}

      {/* Corrections section */}
      {isOwner && corrections.length > 0 && (
        <Box mt={32}>
          <Divider mb={16} />
          <SectionTitle>{tReplace('admin.pendingCorrections', { count: corrections.length })}</SectionTitle>
          {corrections.map((c) => (
            <Paper withBorder key={c.id} className="correction-card" bg="var(--ui-card-bg)" radius={12} p={16} mb={12} shadow="sm">
              <Group justify="space-between" gap={8} mb={12} c="dimmed" fz={13}>
                <span>@{c.username} &middot; {formatDbDate(c.created_at)}</span>
                <Group gap={8}>
                  <Button size="xs" disabled={readOnly} onClick={() => approveCorrection(c.id)}>Approve</Button>
                  <Button color="red" size="xs" disabled={readOnly} onClick={() => rejectCorrection(c.id)}>Reject</Button>
                </Group>
              </Group>
              <Paper withBorder radius={8} bg="var(--bg)">
                <ScrollArea.Autosize mah={300}>
                  <Box p={12} dangerouslySetInnerHTML={{ __html: renderChordPro(c.content, 0, false) }} />
                </ScrollArea.Autosize>
              </Paper>
            </Paper>
          ))}
        </Box>
      )}

      <AddToSetlistModal
        isOpen={addToSetlistOpen}
        onClose={addToSetlist.close}
        songId={songId}
        songTitle={song?.title || ''}
        songArtist={song?.artist || ''}
        songVisibility={song?.visibility}
        targetKey={chord.targetKey}
        nashville={chord.nashville}
      />
    </div>
  );
}
