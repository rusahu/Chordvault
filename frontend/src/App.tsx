import { useI18n } from './context/I18nContext';
import { usePlaybackLayout } from './hooks/usePlaybackLayout';
import { Alert, Badge } from '@mantine/core';
import { useOffline } from './context/OfflineContext';
import { useWriteLock } from './hooks/useWriteLock';
import { useState, useEffect, useCallback } from 'react';
import { shallowEqual, useWindowEvent } from '@mantine/hooks';
import { formatTimestamp } from './lib/format';
import { useAuth } from './context/AuthContext';
import { useDemo } from './context/DemoContext';
import { Nav } from './components/Nav';
import { DemoBanner } from './components/DemoBanner';

import { BrowseView } from './views/BrowseView';
import { MySongsView } from './views/MySongsView';
import { SongView } from './views/SongView';
import { SongEditView } from './views/SongEditView';
import { CorrectionView } from './views/CorrectionView';
import { AuthView } from './views/AuthView';
import { SetlistsView } from './views/SetlistsView';
import { PublicSetlistsView } from './views/PublicSetlistsView';
import { SetlistEditView } from './views/SetlistEditView';
import { SetlistPlayView } from './views/SetlistPlayView';
import { AdminView } from './views/AdminView';
import { SettingsView } from './views/SettingsView';
import { AboutView } from './views/AboutView';
import { api } from './lib/api';
import { songEditReturn, type Destination } from './lib/songEditRoute';
import { parseHash, parseSetlistId, isLocalSetlistId, routeHash, replaceHash, WRITE_LOCKED_VIEWS, type Navigate } from './lib/routes';
import type { AuthConfig } from './types';

export function App() {
  const { user } = useAuth();
  const { readOnly } = useOffline();
  const { setDemoMode } = useDemo();
  const isWriteLocked = useWriteLock();
  const listIdentity = user?.id ?? 'guest';
  // An address can name a page the write lock refuses, or nothing at all; both settle on Browse with a clean address.
  const settle = (hash: string): Destination => {
    const dest = parseHash(hash);
    const next = isWriteLocked() && WRITE_LOCKED_VIEWS.includes(dest.view) ? { view: 'browse', params: {} } : dest;
    if (next.view === 'browse' && hash) replaceHash('');
    return next;
  };
  const [route, setRoute] = useState<Destination>(() => settle(location.hash));
  const [animClass, setAnimClass] = useState('');

  useEffect(() => {
    api<AuthConfig>('GET', '/api/auth/config').then((cfg) => {
      if (cfg.demoMode) setDemoMode(true);
    }).catch(() => {});
  }, [setDemoMode]);

  // Listen for hash changes
  useWindowEvent('hashchange', () => {
    const newRoute = settle(location.hash);
    setRoute((prev) => {
      return prev.view === newRoute.view && shallowEqual(prev.params, newRoute.params) ? prev : newRoute;
    });
  });

  const navigate = useCallback<Navigate>((view, params = {}, { replace = false } = {}) => {
    if (isWriteLocked() && WRITE_LOCKED_VIEWS.includes(view)) return;
    // Trigger animation
    setAnimClass('');
    requestAnimationFrame(() => {
      setRoute({ view, params });
      setAnimClass('view-enter');
    });

    const hash = routeHash(view, params);
    if (hash === null) return;
    if (replace) {
      if (hash) location.replace(hash);
      else replaceHash('');
    } else if (hash) location.hash = hash;
    // pushState gives Browse its own entry without a hashchange, which would race the rAF setRoute above.
    else if (location.hash) history.pushState(null, '', location.pathname + location.search);
  }, [isWriteLocked]);



  const renderView = () => {
    const { view, params } = route;

    switch (view) {
      case 'browse':
        return <BrowseView key={listIdentity} navigate={navigate} />;
      case 'my-songs':
        return user ? <MySongsView key={listIdentity} navigate={navigate} /> : <BrowseView key={listIdentity} navigate={navigate} />;
      case 'song-view':
        return params.id ? <SongView songId={parseInt(params.id)} navigate={navigate} /> : <BrowseView key={listIdentity} navigate={navigate} />;
      case 'song-edit':
        return <SongEditView songId={params.id ? parseInt(params.id) : undefined} returnTo={songEditReturn(params)} navigate={navigate} />;
      case 'correction':
        return params.id ? <CorrectionView songId={parseInt(params.id)} navigate={navigate} /> : <BrowseView key={listIdentity} navigate={navigate} />;
      case 'auth':
        return <AuthView navigate={navigate} />;
      case 'setlists':
        return <SetlistsView key={listIdentity} navigate={navigate} />;
      case 'public-setlists':
        return <PublicSetlistsView key={listIdentity} navigate={navigate} />;
      case 'setlist-edit':
        return params.id ? (
          <SetlistEditView
            setlistId={parseSetlistId(params.id)}
            navigate={navigate}
          />
        ) : <SetlistsView key={listIdentity} navigate={navigate} />;
      case 'setlist-play': {
        const initialIdx = params.index ? parseInt(params.index) : undefined;
        return params.id ? (
          <SetlistPlayView
            key={params.id}
            setlistId={parseSetlistId(params.id)}
            isLocal={!!params.local || isLocalSetlistId(params.id)}
            initialIndex={initialIdx}
            navigate={navigate}
          />
        ) : <SetlistsView key={listIdentity} navigate={navigate} />;
      }
      case 'admin':
        return <AdminView navigate={navigate} />;
      case 'settings':
        return <SettingsView />;
      case 'about':
        return <AboutView navigate={navigate} />;
      default:
        return <BrowseView key={listIdentity} navigate={navigate} />;
    }
  };

  return (
    <>
      <DemoBanner />
      {route.view !== 'setlist-play' && <Nav view={route.view} navigate={navigate} />}
      <main key={listIdentity} id="app" className={animClass}>
        {readOnly && <OfflineStatus playback={route.view === 'setlist-play'} />}
        {renderView()}
      </main>
    </>
  );
}

function OfflineStatus({ playback }: { playback: boolean }) {
  const { state, usingDownload } = useOffline();
  const { t } = useI18n();
  const layout = usePlaybackLayout();
  if (playback) return <Badge pos="fixed" bottom={layout === 'desktop' ? 12 : 90} right={12} style={{ zIndex: 61, pointerEvents: 'none' }} role="status">{t('offline.playbackStatus', 'Offline library · viewing only')}</Badge>;
  return <Alert py="xs" mb="sm" role="status" title={usingDownload ? t('offline.downloaded', 'Downloaded library') : t('offline.disconnected', 'Offline')}>
    {t('offline.viewing', 'Viewing only.')} {state?.downloadedAt ? `${t('offline.updated', 'Last downloaded')} ${formatTimestamp(state.downloadedAt)}.` : t('offline.onlyDownloaded', 'Only downloaded songs are available.')} {t('offline.connectToEdit', 'Connect to make changes.')}
  </Alert>;
}
