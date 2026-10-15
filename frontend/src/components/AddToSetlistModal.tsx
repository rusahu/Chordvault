import { Badge, Group, Modal } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { ListCard } from './ListCard';
import { CardGrid } from './CardGrid';
import { modals } from '@mantine/modals';
import { useFocusReturn } from '@mantine/hooks';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { showStatusNotification as toast } from '../lib/notifications';
import { useLocalSetlists } from '../hooks/useLocalSetlists';
import { useStackedModalProps } from '../hooks/useStackedModalProps';
import type { SetlistListItem } from '../types';
import { formatSongCount } from '../lib/format';
import { VISIBILITY, MAX_LOCAL_SETLISTS } from '../lib/constants';
import { localSetlistToListItem } from '../lib/setlists';

interface AddToSetlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  songId: number;
  songTitle: string;
  songArtist: string;
  songVisibility?: string;
  targetKey: string | null;
  nashville: boolean;
}

export function AddToSetlistModal({
  isOpen,
  onClose,
  songId,
  songTitle,
  songArtist,
  songVisibility,
  targetKey,
  nashville,
}: AddToSetlistModalProps) {
  const stacked = useStackedModalProps();
  useFocusReturn({ opened: isOpen });
  const apiCall = useApi();
  const { user } = useAuth();
  const { t } = useI18n();
  const { setlists, addEntry: lsAddEntry, create: lsCreate } = useLocalSetlists();
  const [userSetlists, setUserSetlists] = useState<SetlistListItem[]>([]);
  const openSession = useRef(0);
  useEffect(() => {
    openSession.current += 1;
    return () => { openSession.current += 1; };
  }, [isOpen]);

  const loadSetlists = useCallback(async () => {
    const session = openSession.current;
    if (user) {
      try {
        const sls = await apiCall<SetlistListItem[]>('GET', '/api/setlists');
        if (session === openSession.current) setUserSetlists(sls);
      } catch { /* ignore */ }
    } else {
      setUserSetlists(setlists.map(localSetlistToListItem));
    }
  }, [user, apiCall, setlists]);

  useEffect(() => {
    if (isOpen) {
      loadSetlists();
    }
  }, [isOpen, loadSetlists]);

  const addToExisting = async (targetId: number | string, confirmed = false) => {
    const session = openSession.current;
    const targetSetlist = userSetlists.find((sl) => sl.id === targetId);
    if (!user) {
      const added = lsAddEntry(String(targetId), {
        song_id: songId,
        title: songTitle,
        artist: songArtist,
        target_key: targetKey,
        nashville: nashville ? 1 : 0,
      });
      if (added) {
        onClose();
        toast(t('setlist.songAdded'), 'success');
      } else {
        toast('Failed to add song', 'error');
      }
      return;
    }
    if (!confirmed && songVisibility === VISIBILITY.PRIVATE && targetSetlist?.visibility === VISIBILITY.PUBLIC) {
      modals.openConfirmModal({ children: 'This song is private. Other viewers of this public setlist will see it as "[Private Song]". Continue?', labels: { confirm: 'Continue', cancel: 'Cancel' }, onConfirm: () => { void addToExisting(targetId, true); } });
      return;
    }
    try {
      await apiCall('POST', `/api/setlists/${targetId}/songs`, {
        song_id: songId,
        target_key: targetKey,
        nashville,
      });
      if (session !== openSession.current) return;
      onClose();
      toast(t('setlist.songAdded'), 'success');
    } catch (e) {
      if (session === openSession.current) toast((e as Error).message, 'error');
    }
  };

  const createAndAdd = () => {
    const session = openSession.current;
    modals.openContextModal({ modal: 'setlistName', title: t('setlist.enterName'), innerProps: { onSubmit: async (name: string) => {
    if (session !== openSession.current) return;
    if (!user) {
      const sl = lsCreate(name.trim());
      if (!sl) {
        toast(`Max ${MAX_LOCAL_SETLISTS} setlists`, 'error');
        return;
      }
      lsAddEntry(sl.id, {
        song_id: songId,
        title: songTitle,
        artist: songArtist,
        target_key: targetKey,
        nashville: nashville ? 1 : 0,
      });
      onClose();
      toast(t('setlist.songAdded'), 'success');
      return;
    }
    try {
      const result = await apiCall<{ id: number }>('POST', '/api/setlists', {
        name: name.trim(),
      });
      await apiCall('POST', `/api/setlists/${result.id}/songs`, {
        song_id: songId,
        target_key: targetKey,
        nashville,
      });
      if (session !== openSession.current) return;
      onClose();
      toast(t('setlist.songAdded'), 'success');
    } catch (e) {
      if (session === openSession.current) toast((e as Error).message, 'error');
    }
  } } });
  };

  return (
    <Modal opened={isOpen} onClose={onClose} title={<>{t('setlist.addToSetlist')}</>} returnFocus={false} {...stacked}>


        <CardGrid>
          <ListCard className="mantine-focus-auto" title={<Group gap={6}><IconPlus size={16} aria-hidden />{t('setlist.newSetlist')}</Group>} onClick={createAndAdd} />
          {userSetlists.map((sl) => (
            <ListCard
              key={sl.id}
              className="mantine-focus-auto"
              title={sl.name}
              meta={formatSongCount(sl.song_count, t)}
              onClick={() => { void addToExisting(sl.id); }}
            >
              {sl.visibility === VISIBILITY.PUBLIC && (
                <Badge size="sm">Public</Badge>
              )}
            </ListCard>
          ))}
        </CardGrid>

    </Modal>
  );
}
