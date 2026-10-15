export const cleanTagName = name => name.trim().toLowerCase();

export function splitTags(csv) {
  return csv ? [...new Set(csv.split(',').map(cleanTagName).filter(Boolean))] : [];
}

export function tagNameError(name, existing, maxLength) {
  if (!name || name.length > maxLength) return `Tag names must be 1 to ${maxLength} characters`;
  if (/[,{}]/.test(name)) return 'Tag names cannot contain commas or braces';
  if (existing.includes(name)) return `Duplicate tag: ${name}`;
  return null;
}
