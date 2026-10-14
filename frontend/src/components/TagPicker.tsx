import { Box, Chip, Group, Tooltip } from '@mantine/core';
import { useTagList } from '../hooks/useTagList';
import { useI18n } from '../context/I18nContext';
import { tagLabel } from '../lib/tagName';

interface TagPickerProps {
  label?: string;
  selected: string[];
  onChange: (tags: string[]) => void;
}

export function TagPicker({ selected, onChange, label }: TagPickerProps) {
  const tags = useTagList();
  const { t } = useI18n();
  const offList = selected.filter(tag => !tags.includes(tag));
  return <Chip.Group multiple value={selected} onChange={onChange}>
    <Group gap={6} role="group" aria-label={label}>
      {tags.map(tag => <Chip key={tag} value={tag} size="sm">{tagLabel(t, tag)}</Chip>)}
      {offList.map(tag => (
        <Tooltip key={tag} label={t('songEdit.tagNotOnList')} events={{ hover: true, focus: true, touch: true }}>
          <Box component="span" display="inline-block"><Chip value={tag} size="sm">{tagLabel(t, tag)}</Chip></Box>
        </Tooltip>
      ))}
    </Group>
  </Chip.Group>;
}
