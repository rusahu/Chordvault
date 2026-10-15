import { splitTags, tagLabel, tagNameError } from '../tagName';

const t = (key: string) => ({ 'tag.worship': '敬拜' } as Record<string, string>)[key] ?? key;

it('labels a tag from the language file and falls back to the stored name', () => {
  expect(tagLabel(t, 'worship')).toBe('敬拜');
  expect(tagLabel(t, 'advent')).toBe('advent');
});

it('applies the server tag rules to a new or renamed name', () => {
  expect(tagNameError('  Advent ', ['worship'])).toBeNull();
  expect(tagNameError('   ', [])).toBe('Tag names must be 1 to 30 characters');
  expect(tagNameError('x'.repeat(31), [])).toBe('Tag names must be 1 to 30 characters');
  expect(tagNameError('a{b', [])).toBe('Tag names cannot contain commas or braces');
  expect(tagNameError('Worship', ['worship'])).toBe('Duplicate tag: worship');
});

it('splits a stored tag list the same way the server does', () => {
  expect(splitTags(' Worship, worship ,,Kids')).toEqual(['worship', 'kids']);
  expect(splitTags(null)).toEqual([]);
});
