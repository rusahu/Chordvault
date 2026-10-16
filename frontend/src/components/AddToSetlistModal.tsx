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
import { useSetlistStore } from '../hooks/useSetlistStore';
import { notifyError } from '../lib/errors';
import { useStackedModalProps } from '../hooks/useStackedModalProps';
import type { SetlistListItem } from '../types';
import { formatSongCount } from '../lib/format';
import { VISIBILITY } from '../lib/constants';
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
  const store = useSetlistStore(!user);
  const song = { id: songId, title: songTitle, artist: songArtist };
  const pick = { targetKey, nashville };
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
      setUserSetlists(store.setlists.map(localSetlistToListItem));
    }
  }, [user, apiCall, store.setlists]);

  useEffect(() => {
    if (isOpen) {
      loadSetlists();
    }
  }, [isOpen, loadSetlists]);

  const addToExisting = async (targetId: number | string, confirmed = false) => {
    const session = openSession.current;
    const target = userSetlists.find((sl) => sl.id === targetId);
    if (user && !confirmed && songVisibility === VISIBILITY.PRIVATE && target?.visibility === VISIBILITY.PUBLIC) {
      modals.openConfirmModal({ children: 'This song is private. Other viewers of this public setlist will see it as "[Private Song]". Continue?', labels: { confirm: 'Continue', cancel: 'Cancel' }, onConfirm: () => { void addToExisting(targetId, true); } });
      return;
    }
    try {
      await store.addSong(String(targetId), song, pick);
      if (session !== openSession.current) return;
      onClose();
      toast(t('setlist.songAdded'), 'success');
    } catch (e) {
      if (session === openSession.current) notifyError(e);
    }
  };

  const createAndAdd = () => {
    const session = openSession.current;
    modals.openContextModal({ modal: 'setlistName', title: t('setlist.enterName'), innerProps: { onSubmit: async (name: string) => {
      if (session !== openSession.current) return;
      try {
        const id = await store.create(name.trim());
        await store.addSong(id, song, pick);
        if (session !== openSession.current) return;
        onClose();
        toast(t('setlist.songAdded'), 'success');
      } catch (e) {
        if (session === openSession.current) notifyError(e);
      }
    } } });
  };

  return (
    <Modal opened={isOpen} onClose={onClose} title={<>{t('setlist.addToSetlist')}</>} returnFocus={false} {...stacked}>


        <CardGrid>
          <ListCard title={<Group gap={6}><IconPlus size={16} aria-hidden />{t('setlist.newSetlist')}</Group>} onClick={createAndAdd} />
          {userSetlists.map((sl) => (
            <ListCard
              key={sl.id}
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
