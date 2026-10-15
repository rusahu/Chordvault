import { useSessionStorage } from '@mantine/hooks';
import { useState } from 'react';

export function useSearchSessionValue(key: string, defaultValue = '') {
  return useSessionStorage<string>({
    key,
    defaultValue,
    getInitialValueInEffect: false,
    sync: false,
    serialize: value => value,
    deserialize: value => value ?? defaultValue,
  });
}

/** A view's working value seeded from session storage; the third item saves it after a successful search. */
export function useSessionField(key: string, defaultValue = '') {
  const [saved, save] = useSearchSessionValue(key, defaultValue);
  const [value, setValue] = useState(saved);
  return [value, setValue, save] as const;
}

export function useSessionToggle(key: string) {
  const [saved, save] = useSearchSessionValue(key, 'false');
  const on = saved === 'true';
  return [on, () => save(String(!on))] as const;
}

export function searchPage(value: string): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}
