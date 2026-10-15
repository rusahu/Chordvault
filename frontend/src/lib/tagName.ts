import { MAX_TAG_LENGTH } from './constants';
import { cleanTagName, tagNameError as sharedTagNameError } from '../../../shared/tags.mjs';

export { cleanTagName, splitTags } from '../../../shared/tags.mjs';

/** Display label from the language file; `t` returns the key itself when it has no entry. */
export function tagLabel(t: (key: string) => string, name: string): string {
  const key = `tag.${name}`;
  const label = t(key);
  return label === key ? name : label;
}

/** Same rules as the server's validateTagList, for one new or renamed name. */
export function tagNameError(raw: string, existing: string[]): string | null {
  return sharedTagNameError(cleanTagName(raw), existing, MAX_TAG_LENGTH);
}
