import { Badge } from '@mantine/core';
import { languageName } from '../lib/languages';

export function LanguageBadge({ code }: { code: string }) {
  return <Badge title={languageName(code)}>{code.toUpperCase()}</Badge>;
}
