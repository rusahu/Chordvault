import { Badge, Box, Button, VisuallyHidden, CloseButton, Flex, Group } from '@mantine/core';
import { IconGripVertical, IconLock, IconPencil } from '@tabler/icons-react';
import { getSongKey } from '../lib/chords';
import { entryContent, entrySemitones, entryStartKey } from '../lib/setlistKeys';
import type { SetlistEntry } from '../types';
import { VISIBILITY } from '../lib/constants';

interface SetlistEntryCardProps {
  entry: SetlistEntry;
  idx: number;
  isEditable: boolean;
  isLocal: boolean;
  onRemove: (entryId: number | string, idx: number) => void;
  onStepKey: (entryId: number | string, idx: number, direction: 1 | -1) => void;
  onClick: (idx: number) => void;
  onEdit?: (idx: number) => void;
  t: (key: string) => string;
  dragProps?: React.HTMLAttributes<HTMLDivElement>;
  handleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
}

export function SetlistEntryCard({
  entry,
  idx,
  isEditable,
  isLocal,
  onRemove,
  onStepKey,
  onClick,
  onEdit,
  t,
  dragProps,
  handleProps,
  isDragging,
}: SetlistEntryCardProps) {
  const content = entryContent(entry);
  const semitones = entrySemitones(content, entry.target_key);
  const keyDisplay = getSongKey(content, semitones);
  const canStep = !!entryStartKey(entry);

  return (
    <Flex
      className={`song-card setlist-song-item ${isDragging ? 'dragging' : ''}`}
      align="center"
      wrap="wrap"
      columnGap={{ base: 6, xs: 12 }}
      rowGap={{ base: 4, xs: 12 }}
      px={{ base: 12, xs: 20 }}
      py={{ base: 10, xs: 12 }}
      mih={72}
      onClick={() => onClick(idx)}
      {...dragProps}
    >
      {isEditable && (
        <Box
          className="setlist-drag-handle"
          mr={{ base: 0, xs: 16 }}
          onClick={(e) => e.stopPropagation()}
          {...handleProps}
          title={t('admin.dragToReorder')}
        >
          <IconGripVertical size={20} aria-hidden />
        </Box>
      )}
      <Box className="setlist-song-pos" mr={{ base: 4, xs: 16 }} w={{ base: 20, xs: 24 }}>{idx + 1}</Box>
      <Box className="song-card-info" flex={1} miw={0}>
        <div className="song-card-title">
          {entry.title}
          {entry.visibility === VISIBILITY.PRIVATE && (
            <Badge ml={8} px={8} title="Private"><IconLock size={14} aria-hidden /><VisuallyHidden>Private</VisuallyHidden></Badge>
          )}
          {!isLocal && isEditable && entry.content_override && (
            <Badge ml={8}>{t('setlist.edited')}</Badge>
          )}
        </div>
        <div className="song-card-meta">
          {entry.artist ? `${entry.artist} · ` : ''}
          {keyDisplay}
        </div>
      </Box>
      {(isEditable || onEdit) && (
        <Group className="setlist-entry-controls" gap={4} wrap="nowrap" justify="flex-end" w={{ base: '100%', xs: 'auto' }} onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <Button variant="default" size="xs" leftSection={<IconPencil size={14} aria-hidden />} onClick={() => onEdit(idx)}>
              {t('songView.edit')}
            </Button>
          )}
          {isEditable && (
            <>
              <Button variant="default" size="xs" disabled={!canStep} onClick={() => onStepKey(entry.entry_id, idx, -1)}>
                &#9837;
              </Button>
              <Button variant="default" size="xs" disabled={!canStep} onClick={() => onStepKey(entry.entry_id, idx, 1)}>
                &#9839;
              </Button>
            </>
          )}
        </Group>
      )}
      {isEditable && (
        <CloseButton
          size="lg"
          aria-label="Remove"
          title="Remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(entry.entry_id, idx);
          }}
        />
      )}
    </Flex>
  );
}

