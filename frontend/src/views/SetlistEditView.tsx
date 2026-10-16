import { useLibraryRead } from '../hooks/useLibraryRead';
import { useOffline } from '../context/OfflineContext';
import { useWriteLock } from '../hooks/useWriteLock';
import { IconMusic } from '@tabler/icons-react';
import { BackButton } from '../components/BackButton';
import { Switch, Button, TextInput, Group, Box, Text } from '@mantine/core';
import { useCopyNotification } from '../hooks/useCopyNotification';
import { useForm } from '@mantine/form';
import { useState, useEffect, useCallback } from 'react';
import { confirmAction, notifyError } from '../lib/errors';
import { stepKey } from '../lib/keys';
import { entryStartKey } from '../lib/setlistKeys';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { showStatusNotification as toast } from '../lib/notifications';
import { useSetlistStore } from '../hooks/useSetlistStore';
import { formatLocalEntry, localSetlistToSetlist } from '../lib/setlists';
import { SongPicker } from '../components/SongPicker';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { SetlistEntryCard } from '../components/SetlistEntryCard';
import type { Setlist, SongListItem } from '../types';
import { useDragReorder } from '../hooks/useDragReorder';
import { songEditFromSetlist } from '../lib/songEditRoute';
import { isLocalSetlistId, setlistHash, setlistPlayParams } from '../lib/routes';
import { VISIBILITY, MAX_SETLIST_NAME_LENGTH } from '../lib/constants';

interface SetlistEditViewProps {
  setlistId: number | string;
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function SetlistEditView({ setlistId, navigate }: SetlistEditViewProps) {
  const { getSetlistForViewer } = useLibraryRead();
  const { readOnly } = useOffline();
  const isWriteLocked = useWriteLock();
  const { user } = useAuth();
  const { t } = useI18n();
  const copyWithFeedback = useCopyNotification(t('setlist.linkCopied', 'Link copied to clipboard'));
  const isLocal = isLocalSetlistId(setlistId);
  const store = useSetlistStore(isLocal);
  const { getOne } = store;
  const id = String(setlistId);
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const metadata = useForm({ initialValues: { name: '', visibility: false, event_date: '' } });
  const { setValues: setMetadata } = metadata;

  const load = useCallback(async () => {
    if (isLocal) {
      const sl = getOne(String(setlistId));
      if (!sl) { navigate(user ? 'setlists' : 'public-setlists'); return; }
      setMetadata({ name: sl.name, visibility: false, event_date: '' });
      setSetlist(localSetlistToSetlist(sl, sl.entries.map(formatLocalEntry)));
      return;
    }

    try {
      const sl = await getSetlistForViewer(Number(setlistId));
      setMetadata({ name: sl.name, visibility: sl.visibility === VISIBILITY.PUBLIC, event_date: sl.event_date || '' });
      setSetlist(sl);
    } catch (e) {
      notifyError(e);
      navigate(user ? 'setlists' : 'public-setlists');
    }
  }, [getSetlistForViewer, navigate, setlistId, user, isLocal, getOne, setMetadata]);

  useEffect(() => { load(); }, [load]);

  const {
    items: reorderedEntries,
    dragProps,
    handleProps,
    draggedIdx,
  } = useDragReorder(
    setlist?.entries || [],
    async (newEntries) => {
      if (isWriteLocked() || !setlist) return;
      setSetlist((prev) => prev ? { ...prev, entries: newEntries } : null);
      try {
        await store.reorder(id, newEntries, setlist.entries);
      } catch (e) {
        notifyError(e);
        load();
      }
    }
  );

  const saveMeta = async (values = metadata.values) => {
    if (isWriteLocked() || !setlist) return;
    const name = values.name.trim();
    if (!name || (isLocal && name.length > MAX_SETLIST_NAME_LENGTH)) return;
    const meta = { name, visibility: values.visibility ? VISIBILITY.PUBLIC : VISIBILITY.PRIVATE, event_date: values.event_date };
    try {
      await store.saveMeta(id, meta);
      setSetlist((prev) => prev && (isLocal ? { ...prev, name } : { ...prev, ...meta }));
    } catch (e) { notifyError(e); }
  };

  const deleteSetlist = () => {
    if (isWriteLocked()) return;
    confirmAction(t('setlist.confirmDelete'), async () => {
      await store.remove(id);
      toast(t('setlist.deleted'), 'success');
      navigate(isLocal && !user ? 'public-setlists' : 'setlists');
    });
  };

  const removeEntry = async (entryId: number | string, idx: number) => {
    if (isWriteLocked()) return;
    try {
      await store.removeEntry(id, entryId, idx);
      setSetlist((prev) => prev && { ...prev, entries: prev.entries.filter((e, i) => (isLocal ? i !== idx : e.entry_id !== entryId)) });
      toast(t('setlist.songRemoved'), 'success');
    } catch (e) { notifyError(e); }
  };

  const addSong = async (song: SongListItem) => {
    if (isWriteLocked()) return;
    try {
      await store.addSong(id, song);
      toast(t('setlist.songAdded'), 'success');
      setPickerOpen(false);
      load();
    } catch (e) { notifyError(e); }
  };

  const handleStepEntryKey = async (entryId: number | string, idx: number, direction: 1 | -1) => {
    if (isWriteLocked() || !setlist) return;
    const current = entryStartKey(reorderedEntries[idx]);
    if (!current) return;
    const newKey = stepKey(current, direction);
    try {
      await store.setEntryKey(id, entryId, idx, newKey);
      setSetlist((prev) => prev && { ...prev, entries: prev.entries.map((e, i) => (i === idx ? { ...e, target_key: newKey } : e)) });
    } catch (e) { notifyError(e); }
  };

  const play = (idx: number) => {
    if (isLocal && !getOne(String(setlistId))?.entries.length) return;
    navigate('setlist-play', setlistPlayParams(setlistId, idx));
  };

  const editSong = (idx: number) => {
    navigate('song-edit', songEditFromSetlist(reorderedEntries[idx].song_id, 'setlist-edit', setlistId));
  };

  const copyShareLink = () => {
    const url = window.location.origin + window.location.pathname + setlistHash(setlistId);
    copyWithFeedback(url);
  };

  const isEditable = !readOnly && (isLocal || (setlist?.user_id != null && user != null && setlist.user_id === user.id));

  const canEditSongs = !!user && !readOnly;

  if (!setlist) return <Loading />;

  return (
    <>
      <Box mb="lg">
        <Group justify="space-between" mb="md">
          <BackButton onClick={() => navigate(isEditable ? 'setlists' : 'public-setlists')}>{t('songView.back')}</BackButton>
          <Group gap="xs">
            {setlist.entries.length > 0 && (
              <Button size="xs" onClick={() => play(0)}>{t('setlist.play')}</Button>
            )}
            {!isLocal && setlist.visibility === VISIBILITY.PUBLIC && (
              <Button variant="default" size="xs" onClick={copyShareLink}>{t('setlist.share')}</Button>
            )}
            {isEditable && <Button color="red" size="xs" onClick={deleteSetlist}>{t('admin.delete')}</Button>}
          </Group>
        </Group>
        <div className="setlist-name-row">
          {!isEditable ? (
            <div className="setlist-name-input" style={{ border: 'none', background: 'none', padding: 0 }}>{setlist.name}</div>
          ) : (
            <TextInput
              type="text"
              id="setlist-name-input"
              className="setlist-name-input"
              {...metadata.getInputProps('name')}
              onBlur={() => saveMeta()}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
          )}
        </div>
        <Group gap={16} mt={12} py={8}>
          {isLocal ? (
            <Text span fz={13} c="dimmed">Local Setlist (Saved in Browser)</Text>
          ) : !isEditable ? (
            <>
              {setlist.username && <Text span fz={13} c="dimmed">By @{setlist.username}</Text>}
              {setlist.event_date && <Text span fz={13} c="dimmed" ml={8}>{t('setlist.date')}: {setlist.event_date}</Text>}
            </>
          ) : (
            <>
              <Switch label={t('setlist.visibility')} id="setlist-visibility" checked={metadata.values.visibility} onChange={(event) => { metadata.setFieldValue('visibility', event.currentTarget.checked); void saveMeta({ ...metadata.values, visibility: event.currentTarget.checked }); }}  />
              <TextInput aria-label={t('setlist.date')} type="date" id="setlist-date" value={metadata.values.event_date} onChange={(event) => { metadata.setFieldValue('event_date', event.currentTarget.value); void saveMeta({ ...metadata.values, event_date: event.currentTarget.value }); }} />
            </>
          )}
        </Group>
      </Box>

      {setlist.entries.length === 0 ? (
        <EmptyState icon={<IconMusic size={56} aria-hidden />} text={t('setlist.noSongsYet')} />
      ) : (
        <div className="setlist-entries" id="setlist-entries">
          {reorderedEntries.map((entry, idx) => (
            <SetlistEntryCard
              key={entry.entry_id}
              entry={entry}
              idx={idx}
              isEditable={isEditable}
              isLocal={isLocal}
              onRemove={removeEntry}
              onStepKey={handleStepEntryKey}
              onClick={play}
              onEdit={canEditSongs && !entry.is_private_placeholder ? editSong : undefined}
              dragProps={isEditable ? dragProps(idx) : undefined}
              handleProps={isEditable ? handleProps(idx) : undefined}
              isDragging={draggedIdx === idx}
            />
          ))}
        </div>
      )}

      {isEditable && (
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <Button onClick={() => setPickerOpen(true)}>{t('setlist.addSongs')}</Button>
        </div>
      )}

      <SongPicker opened={pickerOpen} onPick={addSong} onClose={() => setPickerOpen(false)} />
    </>
  );
}
