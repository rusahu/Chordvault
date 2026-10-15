import { Button } from '@mantine/core';
import type { SetlistListItem } from '../types';
import { useI18n } from '../context/I18nContext';
import { ListCard } from './ListCard';
import { formatDbDate } from '../lib/format';

interface SetlistCardProps {
  setlist: SetlistListItem;
  onClick: () => void;
  onPlay?: () => void;
  showUsername?: boolean;
}

export function SetlistCard({ setlist, onClick, onPlay, showUsername }: SetlistCardProps) {
  const { t } = useI18n();
  const date = setlist.event_date || formatDbDate(setlist.updated_at);

  return (
    <ListCard
      className="setlist-card"
      title={setlist.name}
      meta={<>
        {showUsername && setlist.username && `@${setlist.username} · `}
        {setlist.song_count} {setlist.song_count !== 1 ? t('admin.songPlural') : t('admin.song')}
        {date && ` · ${date}`}
      </>}
      onClick={onClick}
      actions={onPlay && setlist.song_count > 0 && (
        <Button variant="default" size="xs"
          className="btn btn-ghost btn-sm"
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
        >
          {t('setlist.play')}
        </Button>
      )}
    />
  );
}
