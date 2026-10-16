import { MultiSelect } from '@mantine/core';
import { useTagList } from '../hooks/useTagList';
import { useI18n } from '../context/I18nContext';
import { tagLabel } from '../lib/tagName';

interface TagFilterProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

export function TagFilter({ value, onChange }: TagFilterProps) {
  const tags = useTagList();
  const { t } = useI18n();
  const data = tags.map(name => ({ value: name, label: tagLabel(t, name) }));
  return (
    <MultiSelect
      flex={1}
      miw={0}
      maw={{ base: 'none', xs: 420 }}
      data={data}
      value={value}
      onChange={onChange}
      searchable
      clearable
      aria-label={t('songs.tags')}
      placeholder={value.length ? undefined : t('songs.allTags')}
    />
  );
}
