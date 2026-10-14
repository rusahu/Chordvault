import { MAX_TAG_LENGTH } from './constants';

/** Display label from the language file; `t` returns the key itself when it has no entry. */
export function tagLabel(t: (key: string) => string, name: string): string {
  const key = `tag.${name}`;
  const label = t(key);
  return label === key ? name : label;
}

/** Same rules as the server's validateTagList, for one new or renamed name. */
export function tagNameError(raw: string, existing: string[]): string | null {
  const name = raw.trim().toLowerCase();
  if (!name || name.length > MAX_TAG_LENGTH) return `Tag names must be 1 to ${MAX_TAG_LENGTH} characters`;
  if (/[,{}]/.test(name)) return 'Tag names cannot contain commas or braces';
  if (existing.includes(name)) return `Duplicate tag: ${name}`;
  return null;
}
