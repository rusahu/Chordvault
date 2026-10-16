import { Select } from '@mantine/core';
import { languageOptions } from '../lib/languages';

interface LanguagePickerProps {
  value: string;
  onChange: (code: string) => void;
  preferredLanguages: string[];
}

export function LanguagePicker({ value, onChange, preferredLanguages }: LanguagePickerProps) {
  const items = (preferred: boolean) => languageOptions(code => preferredLanguages.includes(code) === preferred);
  return <Select label="Language" aria-label="Song language" placeholder="Select language..." searchable allowDeselect={false}
    value={value || null} onChange={(next) => { if (next) onChange(next); }}
    data={[{ group: 'My Languages', items: items(true) }, { group: 'Other Languages', items: items(false) }]}
    nothingFoundMessage="No matching languages" />;
}
