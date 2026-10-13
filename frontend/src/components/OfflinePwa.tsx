import { useI18n } from '../context/I18nContext';
import { useEffect, useState } from 'react';
import { Alert, Button, Group } from '@mantine/core';
import { useInterval } from '@mantine/hooks';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useOffline } from '../context/OfflineContext';
import { useReloadOnUpdate } from '../hooks/useReloadOnUpdate';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

function Registration() {
  const { t } = useI18n();
  const { setShellReady, setShellError, activity } = useOffline();
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisteredSW: (_url, r) => {
      setRegistration(r);
      void navigator.serviceWorker.ready.then(async () => {
        const assets = [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')].map(script => script.src);
        const available = assets.length > 0 && (await Promise.all(assets.map(url => caches.match(url)))).every(Boolean);
        setShellReady(available);
        setShellError(available ? '' : 'This app version is not downloaded. Reconnect and reopen ChordVault before using it offline.');
      }).catch(error => setShellError(`Offline app preparation failed: ${error.message}`));
    },
    onRegisterError: error => setShellError(`Offline app preparation failed: ${error.message}`),
    // useReloadOnUpdate reloads every tab, not just the one that tapped Reload.
    onNeedReload: () => {},
  });
  // Moving between screens never reloads the page, so the browser would not check on its own.
  useInterval(() => {
    if (registration && !registration.installing && navigator.onLine) void registration.update().catch(() => {});
  }, UPDATE_CHECK_MS, { autoInvoke: true });
  return needRefresh && !activity ? <Alert withCloseButton onClose={() => setNeedRefresh(false)}>
    <Group justify="space-between" gap="xs">
      {t('offline.updateReady', 'A new version of ChordVault is ready.')}
      <Button size="xs" onClick={() => void updateServiceWorker()}>{t('offline.reload', 'Reload')}</Button>
    </Group>
  </Alert> : null;
}

export function OfflinePwa() {
  const { enabled } = useOffline();
  const [existing, setExisting] = useState(false);
  useReloadOnUpdate();
  useEffect(() => {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.getRegistration().then(reg => setExisting(!!reg)).catch(() => {});
  }, []);
  return import.meta.env.PROD && (enabled || existing) ? <Registration /> : null;
}
