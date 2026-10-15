import { entryContent, entryStartKey } from '../setlistKeys';

const entry = { content: '{key: G}\n[G]a', content_override: null as string | null, target_key: null as string | null };

it('plays the setlist override when there is one', () => {
  expect(entryContent(entry)).toBe(entry.content);
  expect(entryContent({ ...entry, content_override: '{key: D}\n[D]b' })).toBe('{key: D}\n[D]b');
  expect(entryContent({ ...entry, content_override: '' })).toBe(entry.content);
});

it('starts from the pinned key, else the written key of what is played', () => {
  expect(entryStartKey({ ...entry, target_key: 'A' })).toBe('A');
  expect(entryStartKey(entry)).toBe('G');
  expect(entryStartKey({ ...entry, content_override: '{key: D}\n[D]b' })).toBe('D');
  expect(entryStartKey({ ...entry, target_key: '' })).toBe('G');
  expect(entryStartKey({ ...entry, content: 'no chords' })).toBe('');
});
