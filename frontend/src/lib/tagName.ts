/** Display label from the language file; `t` returns the key itself when it has no entry. */
export function tagLabel(t: (key: string) => string, name: string): string {
  const key = `tag.${name}`;
  const label = t(key);
  return label === key ? name : label;
}
