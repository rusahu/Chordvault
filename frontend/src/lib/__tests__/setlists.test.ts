import { formatLocalEntry, localSetlistToListItem, localSetlistToSetlist } from '../setlists';

const local = { id: 'local_1', name: 'Mine', entries: [{ song_id: 3, title: 'Grace', artist: '', target_key: 'D', nashville: 0 }] };

it('shows a local setlist as a private, undated setlist', () => {
  const entries = local.entries.map(formatLocalEntry);
  expect(localSetlistToSetlist(local, entries)).toEqual({ id: 'local_1', name: 'Mine', entries, isLocal: true, visibility: 'private', event_date: null });
  expect(localSetlistToListItem(local)).toEqual({ id: 'local_1', name: 'Mine', visibility: 'private', song_count: 1, event_date: null });
});
