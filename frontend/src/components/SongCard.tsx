import { Badge, Button, Group, VisuallyHidden } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { KeyBadge } from './KeyBadge';
import { ListCard } from './ListCard';
import type { SongListItem } from '../types';
import { LanguageBadge } from './LanguageBadge';
import { TagBadges } from './TagBadges';
import { VISIBILITY } from '../lib/constants';
import { useI18n } from '../context/I18nContext';

interface SongCardProps {
  song: SongListItem;
  isOwner?: boolean;
  onClick: () => void;
  onEdit?: () => void;
}

export function SongCard({ song, isOwner, onClick, onEdit }: SongCardProps) {
  const { t, tReplace } = useI18n();
  const hasDetails = Boolean(song.tags || song.language || song.key || song.bpm ||
    (song.version_count ?? 0) > 1 || song.visibility === VISIBILITY.PRIVATE || (isOwner && onEdit));
  return (
    <ListCard
      title={song.title}
      meta={song.artist}
      onClick={onClick}
    >
      {hasDetails && (
        <Group gap={6} mt={8}>
          <TagBadges tags={song.tags} />
          {(song.version_count ?? 0) > 1 && <Badge variant="filled">{tReplace('songs.versionCount', { count: song.version_count ?? 0 })}</Badge>}
          {song.language && <LanguageBadge code={song.language} />}
          {song.visibility === VISIBILITY.PRIVATE && <Badge px={8} title="Private"><IconLock size={14} aria-hidden /><VisuallyHidden>Private</VisuallyHidden></Badge>}
          {song.key && <KeyBadge songKey={song.key} />}
          {Boolean(song.bpm) && <Badge>{song.bpm}</Badge>}
          {isOwner && onEdit && (
            <Button variant="default" size="xs" ml="auto"
              className="btn btn-ghost btn-sm"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
            >
              {t('songView.edit')}
            </Button>
          )}
        </Group>
      )}
    </ListCard>
  );
}
