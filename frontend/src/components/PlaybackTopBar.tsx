import { ActionIcon, Button, Divider, Group, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconBrandYoutube, IconChevronLeft, IconChevronRight, IconPencil, IconX } from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import type { ReactNode } from 'react';
import type { PlaybackLayout } from '../hooks/usePlaybackLayout';
import type { PlaybackNav } from './PlaybackDock';
import { SetlistDefaultsButton } from './SetlistDefaultsButton';
import { Toolbar, type ToolbarProps } from './Toolbar';
import { useI18n } from '../context/I18nContext';

interface PlaybackTopBarProps {
  layout: PlaybackLayout;
  title: string;
  position: string;
  nav: PlaybackNav;
  onExit: () => void;
  toolbar: ToolbarProps;
  more: ReactNode;
  bpm?: number | null;
  youtubeUrl?: string | null;
  onEdit?: () => void;
}

function TitleBlock({ title, position, layout, bpm }: { title: string; position: string; layout: PlaybackLayout; bpm?: number | null }) {
  const compact = layout !== 'desktop';
  return (
    <Stack gap={0} className="playback-title" align={compact ? 'center' : undefined} ta={compact ? 'center' : undefined} flex={compact ? 1 : '0 1 auto'} miw={compact ? 0 : 140} px={6}>
      <Title order={1} className="playback-title-main" fz={layout === 'phone' ? 18 : 21} lh={1.15}>{title}</Title>
      <Text span size="sm" c="dimmed" fw={500}>{position}{bpm ? <>, <Text span inherit>{bpm} bpm</Text></> : null}</Text>
    </Stack>
  );
}

export function PlaybackTopBar({ layout, title, position, nav, onExit, toolbar, more, bpm, youtubeUrl, onEdit }: PlaybackTopBarProps) {
  const { t } = useI18n();
  const roomy = useMediaQuery('(min-width: 1200px)', true, { getInitialValueInEffect: false });
  if (layout === 'desktop') {
    return (
      <Group component="header" className="playback-topbar" data-no-swipe gap="xs" wrap="nowrap" mih={72} px={20} bg="var(--cv-band)">
        <Button variant="subtle" className="btn-exit" leftSection={<IconArrowLeft size={20} aria-hidden />} onClick={onExit}>{t('setlist.exit')}</Button>
        <Divider orientation="vertical" my={14} />
        <ActionIcon size="input-md" aria-label="Previous Song" disabled={!nav.hasPrev} onClick={nav.onPrev}><IconChevronLeft size={22} aria-hidden /></ActionIcon>
        <TitleBlock title={title} position={position} layout={layout} bpm={bpm} />
        <ActionIcon size="input-md" aria-label="Next Song" disabled={!nav.hasNext} onClick={nav.onNext}><IconChevronRight size={22} aria-hidden /></ActionIcon>
        {youtubeUrl && (
          <ActionIcon component="a" href={youtubeUrl} target="_blank" rel="noopener" size="input-md" aria-label="Watch on YouTube" title="Watch on YouTube">
            <IconBrandYoutube size={22} aria-hidden />
          </ActionIcon>
        )}
        {onEdit && (
          <ActionIcon size="input-md" aria-label="Edit song" title="Edit song" onClick={onEdit}>
            <IconPencil size={22} aria-hidden />
          </ActionIcon>
        )}
        <Group flex={1} justify="flex-end" wrap="nowrap">
          <Toolbar {...toolbar} dense={!roomy} />
        </Group>
      </Group>
    );
  }
  return (
    <Group component="header" className="playback-topbar compact" data-no-swipe gap={4} wrap="nowrap" justify="space-between" mih={60} px={8} bg="var(--cv-band)">
      <ActionIcon size="input-md" className="btn-exit" aria-label="Exit playback" onClick={onExit}><IconX size={22} aria-hidden /></ActionIcon>
      <TitleBlock title={title} position={position} layout={layout} />
      <Group gap={0} wrap="nowrap">
        {toolbar.settingsPanel && <SetlistDefaultsButton panel={toolbar.settingsPanel} />}
        {more}
      </Group>
    </Group>
  );
}
