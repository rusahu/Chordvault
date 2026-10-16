import { Alert, Button, Box, Text } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { useOffline } from '../context/OfflineContext';
import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useSwipe } from '../hooks/useSwipe';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useLocalStorage } from '@mantine/hooks';
import { useWakeLock } from '../hooks/useWakeLock';
import { useSetlistPlayer } from '../hooks/useSetlistPlayer';
import { useFontScale } from '../hooks/useFontScale';
import { useTwoCol } from '../hooks/useTwoCol';
import { ChordSheet } from '../components/ChordSheet';
import type { ToolbarProps } from '../components/Toolbar';
import { usePlaybackLayout } from '../hooks/usePlaybackLayout';
import { PlaybackTopBar } from '../components/PlaybackTopBar';
import { PlaybackDock, type PlaybackNav } from '../components/PlaybackDock';
import { PlaybackMoreMenu } from '../components/PlaybackMoreMenu';
import { SettingsPanel } from '../components/SettingsPanel';
import { EmptyState } from '../components/EmptyState';
import { SetlistEntryEditor } from '../components/SetlistEntryEditor';
import { Loading } from '../components/Loading';
import { clampFontSize, autoFit } from '../lib/chords';
import { useRenderedChords } from '../hooks/useRenderedChords';
import { useSetlistPreferences } from '../hooks/useSetlistPreferences';
import { stepKey } from '../lib/keys';
import { entryContent, entryStartKey } from '../lib/setlistKeys';
import { songEditFromSetlist } from '../lib/songEditRoute';
import { usePdfExport } from '../hooks/usePdfExport';
import type { Navigate } from '../lib/routes';

interface SetlistPlayViewProps {
  setlistId: number | string;
  isLocal?: boolean;
  initialIndex?: number;
  navigate: Navigate;
}

export function SetlistPlayView({ setlistId, isLocal: _isLocal, initialIndex, navigate }: SetlistPlayViewProps) {
  const { t } = useI18n();

  const { readOnly } = useOffline();
  const [editing, setEditing] = useState(false);

  // Global setlist settings
  const [slNashville, setSlNashville] = useState(false);
  const [slHideYt, setSlHideYt] = useState(false);
  const fontScale = useFontScale();
  const twoColState = useTwoCol();
  const layout = usePlaybackLayout();

  const { loadError, setlist, entry, index, total, prev, next, exit, updateEntry, isModified, saveOnline, saveLocal } = useSetlistPlayer({
    setlistId,
    isLocal: _isLocal,
    initialIndex,
    navigate,
    onNavigate: () => {
      setEditing(false);
    },
  });

  const content = entry ? entryContent(entry) : '';

  const { user } = useAuth();
  const isOwner = setlist?.user_id && user && setlist.user_id === user.id;
  const [keepScreenOn, setKeepScreenOn] = useLocalStorage({ key: 'cv_keep_screen_on', defaultValue: true, getInitialValueInEffect: false });
  const wakeLock = useWakeLock(keepScreenOn && !!setlist);

  // Effective values for current entry
  const globalPrefs = useMemo(() => ({
    nashville: slNashville,
    twoCol: twoColState.twoCol,
    fontSize: fontScale.fontSize,
    hideYt: slHideYt,
  }), [slNashville, twoColState.twoCol, fontScale.fontSize, slHideYt]);

  const effectivePrefs = useSetlistPreferences(entry, globalPrefs);
  const effNum = effectivePrefs.nashville;
  const effTwoCol = effectivePrefs.twoCol;
  const effFont = effectivePrefs.fontSize;
  const hideYt = effectivePrefs.hideYt;
  const { renderedHtml, currentKey: keyDisplay, hasKey } = useRenderedChords(content, entry?.target_key, !!effNum);

  // Key stepping
  const stepEntryKey = useCallback((direction: 1 | -1) => {
    if (!entry) return;
    const current = entryStartKey(entry);
    if (!current) return;
    updateEntry({ target_key: stepKey(current, direction) });
  }, [entry, updateEntry]);

  // Per-song overrides
  const toggleEntryNum = useCallback((checked: boolean) => {
    if (!entry) return;
    const globalVal = slNashville;
    updateEntry({
      _num: (checked === !!globalVal) ? null : (checked ? 1 : 0),
    });
  }, [entry, slNashville, updateEntry]);

  const toggleEntryTwoCol = useCallback(() => {
    if (!entry) return;
    const nextVal = !effTwoCol;
    updateEntry({ _twoCol: nextVal === (!!twoColState.twoCol) ? null : nextVal });
  }, [entry, effTwoCol, twoColState.twoCol, updateEntry]);

  const changeEntryFont = useCallback((delta: number) => {
    if (!entry) return;
    const nextVal = clampFontSize(effFont + delta);
    updateEntry({ _font: nextVal === fontScale.fontSize ? null : nextVal });
  }, [entry, effFont, fontScale.fontSize, updateEntry]);

  // Key picker
  const pickKey = useCallback((targetKey: string) => {
    if (!entry) return;
    updateEntry({ target_key: targetKey });
  }, [entry, updateEntry]);

  // Inline editor
  const openEditor = useCallback(() => {
    if (readOnly || !entry || setlist?.isLocal) return;
    setEditing(true);
  }, [entry, setlist, readOnly]);

  // Swipe
  const swipeRef = useSwipe({ onNext: next, onPrev: prev, enabled: !editing && !!setlist });

  // Keyboard shortcuts
  const shortcuts = useMemo(() => ({
    'ArrowLeft': (e: KeyboardEvent) => { e.preventDefault(); prev(); },
    'ArrowRight': (e: KeyboardEvent) => { e.preventDefault(); next(); },
    'ArrowUp': (e: KeyboardEvent) => { e.preventDefault(); stepEntryKey(1); },
    'ArrowDown': (e: KeyboardEvent) => { e.preventDefault(); stepEntryKey(-1); },
    'n': () => { if (entry) toggleEntryNum(!effNum); },
    'N': () => { if (entry) toggleEntryNum(!effNum); },
    'e': (e: KeyboardEvent) => { e.preventDefault(); openEditor(); },
    'E': (e: KeyboardEvent) => { e.preventDefault(); openEditor(); },
    'Escape': () => { if (editing) setEditing(false); else exit(); },
  }), [prev, next, stepEntryKey, entry, effNum, toggleEntryNum, openEditor, editing, exit]);

  useKeyboardShortcuts(shortcuts, !!setlist);

  const resetFont = () => {
    fontScale.resetFontSize();
    if (entry) updateEntry({ _font: null });
  };

  const exportPdf = usePdfExport();
  const handleExportAllPdf = () => {
    if (!setlist) return;
    void exportPdf('Setlist PDF exported', async () => (await import('../lib/pdf-export')).exportSetlistPdf(setlist, {
      nashville: slNashville, fontSize: fontScale.fontSize,
    }));
  };

  const doFit = () => {
    const result = autoFit();
    updateEntry({
      _font: result.fontSize === fontScale.fontSize ? null : result.fontSize,
      _twoCol: result.twoCol === !!twoColState.twoCol ? null : result.twoCol
    });
    window.scrollTo(0, 0);
  };

  if (loadError) return <Alert title="Setlist unavailable" color="red">{loadError}<Button mt="sm" display="block" onClick={() => navigate('setlists')}>Back to setlists</Button></Alert>;
  if (!setlist) return <Loading />;
  if (!entry) return <EmptyState text={t('setlist.noSongsYet')} />;

  const resetEntryLayout = () => { if (entry) updateEntry({ _font: null, _twoCol: null }); };
  const canReset = entry._font != null || entry._twoCol != null;
  const toolbar: ToolbarProps = {
    currentKey: keyDisplay,
    nashville: !!effNum,
    nashvilleDisabled: !hasKey,
    onNashvilleChange: toggleEntryNum,
    twoCol: !!effTwoCol,
    onTwoColToggle: toggleEntryTwoCol,
    fontSize: effFont || 0,
    onFontChange: changeEntryFont,
    onReset: resetEntryLayout,
    onPickKey: pickKey,
    onAutoFit: doFit,
    onSaveOnline: !readOnly && isOwner ? saveOnline : undefined,
    onSaveLocal: readOnly ? undefined : saveLocal,
    onExportPdf: handleExportAllPdf,
    settingsPanel: (
      <SettingsPanel
        nashville={slNashville}
        onNashvilleChange={setSlNashville}
        hideYt={slHideYt}
        onHideYtChange={setSlHideYt}
        twoCol={twoColState.twoCol}
        onTwoColChange={twoColState.setTwoColTo}
        fontSize={fontScale.fontSize}
        onFontChange={fontScale.changeFontSize}
        onFontReset={resetFont}
        keepScreenOn={wakeLock.supported ? keepScreenOn : undefined}
        onKeepScreenOnChange={wakeLock.supported ? setKeepScreenOn : undefined}
      />
    ),
    isModified,
    renderKey: index,
    overrides: { num: entry._num != null, twoCol: entry._twoCol != null, font: entry._font != null },
    canReset,
  };
  const editSong = user && !readOnly && !entry.is_private_placeholder
    ? () => navigate('song-edit', songEditFromSetlist(entry.song_id, 'setlist-play', setlistId, index))
    : undefined;
  const nav: PlaybackNav = { onPrev: prev, onNext: next, hasPrev: index > 0, hasNext: index < total - 1 };
  const more = (
    <PlaybackMoreMenu nashville={!!effNum} nashvilleDisabled={toolbar.nashvilleDisabled} onNashvilleChange={toggleEntryNum}
      onExportPdf={handleExportAllPdf} onReset={resetEntryLayout} canReset={canReset}
      bpm={entry.bpm} youtubeUrl={hideYt ? null : entry.youtube_url} onEdit={editSong} />
  );

  return (
    <div ref={swipeRef} className={`setlist-play-container${layout === 'desktop' ? '' : ' has-dock'}`}>
      <PlaybackTopBar layout={layout} title={entry.title} position={`${index + 1} of ${total}, ${setlist.name}`}
        nav={nav} onExit={exit} toolbar={toolbar} more={more}
        bpm={entry.bpm} youtubeUrl={hideYt ? null : entry.youtube_url} onEdit={editSong} />


      {editing ? (
        <SetlistEntryEditor setlistId={setlist.id} entry={entry}
          onSaved={(saved) => { updateEntry({ content_override: saved }); setEditing(false); }}
          onCancel={() => setEditing(false)} />
      ) : (
        <>
          {entry?.is_private_placeholder ? (
            <Box mt={40}>
              <EmptyState icon={<IconLock size={56} aria-hidden />} text={entry.not_downloaded ? "This song is not downloaded. Connect and refresh your library." : <>This song is private<Text span display="block" size="sm" mt="xs">The song owner has marked it as private.</Text></>} />
            </Box>
          ) : (
            <ChordSheet
              html={renderedHtml}
              twoCol={!!effTwoCol}
              fontSize={effFont || 0}
            />
          )}
        </>
      )}
      {layout !== 'desktop' && <PlaybackDock layout={layout} nav={nav} toolbar={toolbar} />}
    </div>
  );
}
