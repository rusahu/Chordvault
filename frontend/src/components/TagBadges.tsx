import { Badge } from '@mantine/core';
import { useI18n } from '../context/I18nContext';
import { splitTags, tagLabel } from '../lib/tagName';

export function TagBadges({ tags }: { tags: string | null }) {
  const { t } = useI18n();
  return <>{splitTags(tags).map(tag => <Badge key={tag}>{tagLabel(t, tag)}</Badge>)}</>;
}
