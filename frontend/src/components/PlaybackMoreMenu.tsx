import { ActionIcon, Menu, VisuallyHidden } from '@mantine/core';
import { IconBrandYoutube, IconCheck, IconDots, IconDownload, IconPencil, IconRestore } from '@tabler/icons-react';

interface PlaybackMoreMenuProps {
  nashville: boolean;
  nashvilleDisabled?: boolean;
  onNashvilleChange: (checked: boolean) => void;
  onExportPdf?: () => void;
  onReset: () => void;
  canReset: boolean;
  bpm?: number | null;
  youtubeUrl?: string | null;
  onEdit?: () => void;
}

export function PlaybackMoreMenu({ nashville, nashvilleDisabled, onNashvilleChange, onExportPdf, onReset, canReset, bpm, youtubeUrl, onEdit }: PlaybackMoreMenuProps) {
  return (
    <Menu position="bottom-end" shadow="md" width={240}>
      <Menu.Target>
        <ActionIcon size="input-md" aria-label="More display options"><IconDots size={22} aria-hidden /></ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {bpm ? <Menu.Label>{bpm} bpm</Menu.Label> : null}
        <Menu.Item disabled={nashvilleDisabled} onClick={() => onNashvilleChange(!nashville)} rightSection={nashville ? <IconCheck size={16} aria-hidden /> : null}>
          Number notation<VisuallyHidden>{nashville ? ', on' : ', off'}</VisuallyHidden>
        </Menu.Item>
        {onExportPdf && <Menu.Item leftSection={<IconDownload size={16} aria-hidden />} onClick={onExportPdf}>Export PDF</Menu.Item>}
        <Menu.Item leftSection={<IconRestore size={16} aria-hidden />} disabled={!canReset} onClick={onReset}>Reset text size and columns</Menu.Item>
        {onEdit && <Menu.Item leftSection={<IconPencil size={16} aria-hidden />} onClick={onEdit}>Edit song</Menu.Item>}
        {youtubeUrl && <Menu.Item component="a" href={youtubeUrl} target="_blank" rel="noopener" leftSection={<IconBrandYoutube size={16} aria-hidden />}>Watch on YouTube</Menu.Item>}
      </Menu.Dropdown>
    </Menu>
  );
}
