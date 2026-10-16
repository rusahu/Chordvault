import registry from '../../../shared/languages.json';

export interface Language {
  code: string;
  name: string;
}

export const LANGUAGES: Language[] = registry;

export const LANGUAGE_CODES = new Set(LANGUAGES.map(l => l.code));

/** Select options for the languages `keep` accepts, labelled "Name (code)". */
export const languageOptions = (keep: (code: string) => boolean) =>
  LANGUAGES.filter(l => keep(l.code)).map(l => ({ value: l.code, label: `${l.name} (${l.code})` }));

export function languageName(code: string): string {
  return LANGUAGES.find(l => l.code === code)?.name ?? code.toUpperCase();
}
