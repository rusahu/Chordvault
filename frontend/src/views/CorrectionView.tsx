import { useOffline, useOfflineActivity } from '../context/OfflineContext';
import { Button, useComputedColorScheme, Group, Title, Text, Paper } from '@mantine/core';
import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { showStatusNotification as toast } from '../lib/notifications';
import { notifyError } from '../lib/errors';
import { CodeMirrorEditor } from '../components/CodeMirrorEditor';
import { useI18n } from '../context/I18nContext';
import { prepareSongForSave } from '../lib/songSubmit';
import type { Song } from '../types';

interface CorrectionViewProps {
  songId: number;
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function CorrectionView({ songId, navigate }: CorrectionViewProps) {
  const apiCall = useApi();
  const { t } = useI18n();
  const { readOnly } = useOffline();
  useOfflineActivity(true);
  const theme = useComputedColorScheme('dark');
  const [content, setContent] = useState('');

  useEffect(() => {
    apiCall<Song>('GET', `/api/songs/${songId}`)
      .then((s) => setContent(s.content))
      .catch((e) => { notifyError(e); navigate('browse'); });
  }, [songId, apiCall, navigate]);

  const submit = async () => {
    if (readOnly) return;
    const prepared = prepareSongForSave(content, t, { requireLanguage: false });
    if ('error' in prepared) { toast(prepared.error, 'error'); return; }
    try {
      await apiCall('POST', `/api/songs/${songId}/correction`, { content: prepared.content });
      toast('Correction submitted for review', 'success');
      navigate('song-view', { id: String(songId) });
    } catch (e) { notifyError(e); }
  };

  return (
    <>
      <Group mb="lg">
        <Button variant="default" size="xs" className="btn btn-ghost btn-sm" onClick={() => navigate('song-view', { id: String(songId) })}>&#8592; Cancel</Button>
        <Title order={2} size="h3" flex="1 1 160px">Submit Correction</Title>
        <Button size="xs" className="btn btn-sm" disabled={readOnly} onClick={submit}>Submit</Button>
      </Group>
      <Text size="sm" c="dimmed" mb="sm">
        Edit the chords below. Your correction will be reviewed by the song owner before being applied.
      </Text>
      <Paper withBorder radius="md" mb="sm" style={{ overflow: 'hidden' }}>
          <CodeMirrorEditor
            value={content}
            onChange={setContent}
            darkMode={theme === 'dark'}
            placeholder="Corrected chord sheet..."
          />
      </Paper>
    </>
  );
}
