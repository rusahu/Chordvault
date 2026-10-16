import { applyStoredOverrides, formatLocalEntry, localSetlistToListItem, localSetlistToSetlist } from '../setlists';
import { getSetlistOverrides, saveSetlistOverride } from '../storage';
import type { SetlistEntry } from '../../types';

const local = { id: 'local_1', name: 'Mine', entries: [{ song_id: 3, title: 'Grace', artist: '', target_key: 'D', nashville: 0 }] };

it('shows a local setlist as a private, undated setlist', () => {
  const entries = local.entries.map(formatLocalEntry);
  expect(localSetlistToSetlist(local, entries)).toEqual({ id: 'local_1', name: 'Mine', entries, isLocal: true, visibility: 'private', event_date: null });
  expect(localSetlistToListItem(local)).toEqual({ id: 'local_1', name: 'Mine', visibility: 'private', song_count: 1, event_date: null });
});

describe('applyStoredOverrides', () => {
  const entry = (entry_id: number, target_key: string | null) =>
    ({ entry_id, song_id: entry_id, title: 'S', content: '{key: C}\n[C]a', target_key, nashville: 1 }) as unknown as SetlistEntry;
  beforeEach(() => localStorage.clear());

  it('lets a stored null key win over the server key and resets numbers', () => {
    saveSetlistOverride(9, 1, { target_key: null });
    const { entries, targetKeys } = applyStoredOverrides(9, [entry(1, 'D')]);
    expect(entries[0]).toMatchObject({ target_key: null, nashville: 0 });
    expect(targetKeys).toEqual({ 1: null });
  });

  it('keeps the entry key when the stored record holds no key decision', () => {
    saveSetlistOverride(9, 1, { nashville: true });
    expect(applyStoredOverrides(9, [entry(1, 'D')]).entries[0].target_key).toBe('D');
  });

  it('turns a legacy transpose record into a target key and writes it back', () => {
    localStorage.setItem('cv_setlist_overrides', JSON.stringify({ 9: { 1: { transpose: 2 } } }));
    expect(applyStoredOverrides(9, [entry(1, null)]).entries[0].target_key).toBe('D');
    expect(getSetlistOverrides(9)['1']).toMatchObject({ target_key: 'D' });
  });
});
