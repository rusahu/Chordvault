import { CloseButton, TextInput } from '@mantine/core';

interface SearchFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
  /** Take focus when it opens inside a Mantine modal. */
  modalAutoFocus?: boolean;
}

export function SearchField({ label, value, onChange, onSearch, onClear, modalAutoFocus }: SearchFieldProps) {
  return (
    <TextInput aria-label={label}
      type="search"
      flex={3}
      miw={0}
      placeholder={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') onSearch(); }}
      rightSection={value ? <CloseButton aria-label="Clear search" title="Clear search" onClick={onClear} /> : null}
      data-autofocus={modalAutoFocus || undefined}
    />
  );
}
