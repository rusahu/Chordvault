import { tagLabel } from '../tagName';

const t = (key: string) => ({ 'tag.worship': '敬拜' } as Record<string, string>)[key] ?? key;

it('labels a tag from the language file and falls back to the stored name', () => {
  expect(tagLabel(t, 'worship')).toBe('敬拜');
  expect(tagLabel(t, 'advent')).toBe('advent');
});
