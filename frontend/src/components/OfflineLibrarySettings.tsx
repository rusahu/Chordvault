import { Alert, Button, Group, Loader, Stack, Switch, Text } from '@mantine/core';
import { SettingsSection } from './SettingsSection';
import { useOffline } from '../context/OfflineContext';
import { useI18n } from '../context/I18nContext';

export function OfflineLibrarySettings() {
  const offline = useOffline();
  const { t } = useI18n();
  const { state, busy, enabled, error, shellError, shellReady, persisted } = offline;
  return <SettingsSection title={t('offline.title', 'Offline library')}>
    <Stack gap="sm" mt={8}>
      <Switch label={t('offline.enable', 'Keep my library offline')} checked={enabled}
        onChange={event => { void (event.currentTarget.checked ? offline.enable() : offline.disable()); }} />
      <Text size="sm" c="dimmed">{t('offline.description', 'Download public songs, your private songs and your saved setlists for viewing. Stored on this device. Removed when you sign out.')}</Text>
      {busy && <Group gap="xs" role="status"><Loader size="xs" /><Text size="sm">{t('offline.downloading', 'Downloading library...')}</Text></Group>}
      {enabled && state?.revision && shellReady && <Text size="sm" role="status">
        {state.songCount} {t('offline.songs', 'songs')} · {state.setlistCount} {t('offline.setlists', 'setlists')} · {t('offline.updated', 'Last downloaded')} {new Date(state.downloadedAt!).toLocaleString()}
      </Text>}
      {enabled && !shellReady && !busy && <Text size="sm" role="status">{t('offline.preparing', 'Preparing the app and fonts for offline use...')}</Text>}
      {shellError && <Alert color="red" role="alert">{shellError}</Alert>}
      {enabled && !state?.revision && shellReady && !busy && <Text size="sm">{t('offline.noDownload', 'No completed download on this device. Connect and refresh your library.')}</Text>}
      {error && <Alert color="red" role="alert">{error}{state?.revision ? ` ${t('offline.previous', 'Your previous download is still available.')}` : ''}</Alert>}
      {enabled && persisted === false && <Alert color="yellow">
        {t('offline.notPersisted', 'Your browser may clear offline songs when storage is low. Adding ChordVault to your home screen helps keep them.')}
        <Button size="xs" variant="default" mt="xs" display="block" onClick={() => { void offline.requestPersistence(); }}>{t('offline.retryPersist', 'Try again')}</Button>
      </Alert>}
      {enabled && <Button variant="default" disabled={busy || !offline.online} onClick={() => { void offline.refresh(true); }}>{t('offline.refresh', 'Refresh now')}</Button>}
    </Stack>
  </SettingsSection>;
}
