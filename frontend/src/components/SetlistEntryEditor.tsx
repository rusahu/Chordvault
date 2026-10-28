import { Button, Group, Paper, Stack } from '@mantine/core';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../context/I18nContext';
import { showStatusNotification as toast } from '../lib/notifications';
import { notifyError } from '../lib/errors';
import { createSongVersion } from '../lib/songSubmit';
import { entryContent } from '../lib/setlistKeys';
import type { SetlistEntry } from '../types';

interface SetlistEntryEditorProps {
  setlistId: number | string;
  entry: SetlistEntry;
  onSaved: (content: string) => void;
  onCancel: () => void;
}

/** Edits what one setlist entry plays: for this setlist only, or also as a new version of the song. */
export function SetlistEntryEditor({ setlistId, entry, onSaved, onCancel }: SetlistEntryEditorProps) {
  const apiCall = useApi();
  const { t } = useI18n();
  const [content, setContent] = useState(() => entryContent(entry));

  const saveOverride = (override: string) => apiCall('PUT', `/api/setlists/${setlistId}/entries/${entry.entry_id}`, { content_override: override });

  const saveToSetlist = async () => {
    try {
      await saveOverride(content);
      onSaved(content);
      toast(t('setlist.editSaved'), 'success');
    } catch (e) { notifyError(e); }
  };

  const saveAsVersion = async () => {
    try {
      const { content: saved } = await createSongVersion(apiCall, entry.song_id, content, { requireLanguage: false });
      await saveOverride(saved);
      onSaved(saved);
      toast(t('setlist.versionCreated'), 'success');
    } catch (e) { notifyError(e); }
  };

  return (
    <Stack gap="sm">
      <Paper withBorder radius="md" style={{ overflow: 'clip' }}>
        <CodeMirrorEditor value={content} onChange={setContent} ariaLabel="Setlist chord sheet" autoFocus />
      </Paper>
      <Group gap="xs">
        <Button size="xs" onClick={saveToSetlist}>{t('setlist.saveToSetlist')}</Button>
        <Button variant="default" size="xs" onClick={saveAsVersion}>{t('setlist.saveAsVersion')}</Button>
        <Button variant="default" size="xs" onClick={onCancel}>{t('songEdit.cancel')}</Button>
      </Group>
    </Stack>
  );
}
