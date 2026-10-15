import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const locale: Record<string, string> = JSON.parse(readFileSync(resolve(__dirname, '../../../public/locales/en.json'), 'utf8'));

const t = (key: string, fallback?: string) => locale[key] || fallback || key;
const tReplace = (key: string, replacements: Record<string, string | number>) =>
  Object.entries(replacements).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), t(key));

/** Stands in for `context/I18nContext` with the real English strings. */
export const useI18n = () => ({ t, tReplace, loaded: true });
