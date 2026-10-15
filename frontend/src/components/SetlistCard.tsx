import { Button } from '@mantine/core';
import type { SetlistListItem } from '../types';
import { useI18n } from '../context/I18nContext';
import { ListCard } from './ListCard';
import { formatDbDate, formatSongCount } from '../lib/format';

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
        {formatSongCount(setlist.song_count, t)}
        {date && ` · ${date}`}
      </>}
      onClick={onClick}
      actions={onPlay && setlist.song_count > 0 && (
        <Button variant="default" size="xs"
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
        >
          {t('setlist.play')}
        </Button>
      )}
    />
  );
}
