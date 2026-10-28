import { useOffline, useOfflineActivity } from '../context/OfflineContext';
import { Button, Group, Title, Text, Paper } from '@mantine/core';
import { BackButton } from '../components/BackButton';
import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { showStatusNotification as toast } from '../lib/notifications';
import { notifyError } from '../lib/errors';
import { CodeMirrorEditor } from '../components/CodeMirrorEditor';
import { requirePreparedSong } from '../lib/songSubmit';
import type { Song } from '../types';
import type { Navigate } from '../lib/routes';

interface CorrectionViewProps {
  songId: number;
  navigate: Navigate;
}

export function CorrectionView({ songId, navigate }: CorrectionViewProps) {
  const apiCall = useApi();
  const { readOnly } = useOffline();
  useOfflineActivity(true);
  const [content, setContent] = useState('');

  useEffect(() => {
    apiCall<Song>('GET', `/api/songs/${songId}`)
      .then((s) => setContent(s.content))
      .catch((e) => { notifyError(e); navigate('browse', {}, { leave: true }); });
  }, [songId, apiCall, navigate]);

  const submit = async () => {
    if (readOnly) return;
    try {
      const prepared = requirePreparedSong(content, { requireLanguage: false });
      await apiCall('POST', `/api/songs/${songId}/correction`, { content: prepared.content });
      toast('Correction submitted for review', 'success');
      navigate('song-view', { id: String(songId) }, { leave: true });
    } catch (e) { notifyError(e); }
  };

  return (
    <>
      <Group mb="lg">
        <BackButton onClick={() => navigate('song-view', { id: String(songId) }, { leave: true })}>Cancel</BackButton>
        <Title order={2} size="h3" flex="1 1 160px">Submit Correction</Title>
        <Button size="xs" disabled={readOnly} onClick={submit}>Submit</Button>
      </Group>
      <Text size="sm" c="dimmed" mb="sm">
        Edit the chords below. Your correction will be reviewed by the song owner before being applied.
      </Text>
      <Paper withBorder radius="md" mb="sm" style={{ overflow: 'clip' }}>
          <CodeMirrorEditor
            value={content}
            onChange={setContent}
            placeholder="Corrected chord sheet..."
          />
      </Paper>
    </>
  );
}
