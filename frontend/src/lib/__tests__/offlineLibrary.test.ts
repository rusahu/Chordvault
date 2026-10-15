import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { createOfflineLibrary } from '../offlineLibrary';
import type { OfflineSnapshot } from '../../types/offline';

function snapshot(accountId = 1): OfflineSnapshot {
  const songs = [1, 2, 3].map(id => ({
    id, familyId: id === 2 ? 1 : id, parent_id: id === 2 ? 1 : null,
    user_id: accountId, title: id === 3 ? '喜樂' : 'Amazing Grace', artist: 'Anonymous',
    content: '[C]Sing', visibility: 'public', status: 'active', key: 'C', language: id === 3 ? 'zh' : 'en',
    username: 'demo', youtube_url: null, bpm: null, tags: null, format_detected: null,
    created_at: '2026-01-01', updated_at: `2026-01-0${id}`,
  }));
  return { schemaVersion: 1, accountId, songs, catalog: songs.map(({ content: _, ...s }) => ({
    ...s, search: { title: [s.title.toLowerCase(), ...(s.id === 3 ? ['喜乐'] : [])],
      artist: ['anonymous'], lyrics: ['sing'], pinyin: s.id === 3 ? 'xile' : 'amazinggrace' },
  })), setlists: [{ id: 1, user_id: accountId, name: 'Worship', visibility: 'private', event_date: null, entries: [] }] };
}

let library: ReturnType<typeof createOfflineLibrary>;
beforeEach(async () => {
  library = createOfflineLibrary(`offline-test-${crypto.randomUUID()}`);
  await library.enable(1);
});
afterEach(async () => { await library.db.delete(); vi.restoreAllMocks(); });
async function save(data = snapshot(), revision = 'A') {
  const ticket = await library.beginRefresh(data.accountId);
  expect(ticket).not.toBeNull();
  return library.replaceDownload(ticket!, data, revision);
}

it('stores a complete snapshot, groups versions and finds both Chinese scripts and pinyin', async () => {
  expect(await save()).toBe(true);
  expect((await library.querySongs(1, {})).total).toBe(2);
  expect((await library.getVersions(1, 1)).length).toBe(2);
  for (const q of ['喜樂', '喜乐', 'xi le']) {
    expect((await library.querySongs(1, { q })).songs.map(s => s.id)).toEqual([3]);
  }
  expect((await library.getSong(1, 2)).content).toBe('[C]Sing');
  expect((await library.querySetlists(1, {})).setlists[0].name).toBe('Worship');
});

it('rolls back every table and the completed timestamp when a late bulk write fails', async () => {
  await save();
  const before = await library.state();
  const changed = snapshot();
  changed.songs[0].content = 'new';
  vi.spyOn(library.db.setlists, 'bulkPut').mockRejectedValueOnce(new Error('quota'));
  await expect(save(changed, 'B')).rejects.toThrow('quota');
  expect((await library.getSong(1, 1)).content).toBe('[C]Sing');
  expect((await library.state())?.revision).toBe('A');
  expect((await library.state())?.downloadedAt).toBe(before?.downloadedAt);
});

it('rejects an old response after disable, re-enable and account changes', async () => {
  const old = (await library.beginRefresh(1))!;
  await library.disable(1);
  await library.enable(1);
  expect(await library.replaceDownload(old, snapshot(), 'old')).toBe(false);
  await save();
  await library.enable(2);
  await expect(library.getSong(1, 1)).rejects.toThrow();
  await save(snapshot(2));
  await library.disable(1);
  expect((await library.getSong(2, 1)).user_id).toBe(2);
});

it('does not let out-of-order responses from two connections overwrite a later request', async () => {
  const second = createOfflineLibrary(library.db.name);
  try {
    const old = (await library.beginRefresh(1))!;
    const current = (await second.beginRefresh(1))!;
    expect(await second.replaceDownload(current, snapshot(), 'new')).toBe(true);
    expect(await library.replaceDownload(old, snapshot(), 'old')).toBe(false);
    expect((await library.state())?.revision).toBe('new');
  } finally { second.db.close(); }
});

it('rejects malformed snapshots before replacing a completed download', async () => {
  await save();
  const broken = snapshot();
  broken.songs.push(broken.songs[0]);
  await expect(save(broken, 'B')).rejects.toThrow();
  expect((await library.state())?.revision).toBe('A');
});

it('commits an empty snapshot and only advances checkedAt for a matching 304', async () => {
  await save();
  const ticket = (await library.beginRefresh(1))!;
  expect(await library.markChecked(ticket, 'wrong')).toBe(false);
  expect(await library.markChecked(ticket, 'A')).toBe(true);
  await save({ schemaVersion: 1, accountId: 1, songs: [], catalog: [], setlists: [] }, 'empty');
  expect((await library.querySongs(1, {})).total).toBe(0);
  expect((await library.state())?.songCount).toBe(0);
});

it('does not report an evicted partial download as ready or serve its remaining rows', async () => {
  await save();
  await library.db.catalog.delete(2);
  expect((await library.status())?.revision).toBeNull();
  await expect(library.getSong(1, 1)).rejects.toThrow('not available');
});

it('rejects catalog metadata that does not describe the downloaded song', async () => {
  await save();
  const invalid = snapshot();
  invalid.catalog[0].user_id = 99;
  await expect(save(invalid, 'bad')).rejects.toThrow();
  expect((await library.state())?.revision).toBe('A');
});

it('does not accept a 304 as validation of an unsupported stored contract', async () => {
  await save();
  await library.db.state.update('current', { contractVersion: 2 });
  const ticket = (await library.beginRefresh(1))!;
  expect(await library.markChecked(ticket, 'A')).toBe(false);
  expect((await library.status())?.revision).toBeNull();
});

it('rejects a superseded response even when the newer request fails', async () => {
  await save();
  const older = (await library.beginRefresh(1))!;
  const newer = (await library.beginRefresh(1))!;
  await expect(library.replaceDownload(newer, { schemaVersion: 2 }, 'bad')).rejects.toThrow();
  expect(await library.replaceDownload(older, snapshot(), 'stale')).toBe(false);
  expect((await library.state())?.revision).toBe('A');
});

it('allows another tab to upgrade storage without changing hydrated playback data', async () => {
  await save();
  const playing = await library.getSong(1, 1);
  const upgraded = new Dexie(library.db.name);
  upgraded.version(2).stores({});
  try {
    await upgraded.open();
    expect(library.db.isOpen()).toBe(false);
    expect(playing.content).toBe('[C]Sing');
    await expect(library.getSong(1, 1)).rejects.toThrow();
  } finally { upgraded.close(); }
});

it('filters offline songs by any picked tag, by exact name', async () => {
  const data = snapshot();
  data.catalog[0].tags = 'christmas,worship';
  data.catalog[2].tags = 'kids';
  await save(data);
  const ids = async (tags: string[]) => (await library.querySongs(1, { tags })).songs.map(s => s.id);
  expect(await ids(['kids', 'christmas'])).toEqual([3, 1]);
  expect(await ids(['christ'])).toEqual([]);
  // Unfiltered, family 1 shows its newest row (id 2); filtered, only id 1 carries the tag.
  expect(await ids([])).toEqual([3, 2]);
});

it('filters and sorts setlists like the server', async () => {
  const data = snapshot();
  const base = { user_id: 1, visibility: 'private', entries: [] };
  data.setlists = [
    { ...base, id: 1, name: 'Early', event_date: '2026-10-01', updated_at: '2026-10-30 00:00:00' },
    { ...base, id: 2, name: 'Undated', event_date: null, created_at: '2026-10-15 01:00:00', updated_at: '2026-10-20 00:00:00' },
    { ...base, id: 3, name: 'Later', event_date: '2026-10-10', updated_at: '2026-10-11 00:00:00' },
    { ...base, id: 4, name: '讚美', event_date: null, created_at: '2026-09-01 00:00:00', search: ['讚美', '赞美'] },
  ];
  await save(data);
  const ids = async (query: object) => (await library.querySetlists(1, query)).setlists.map(s => s.id);
  expect(await ids({})).toEqual([3, 1, 2, 4]);
  expect(await ids({ dateFrom: '2026-10-15', dateTo: '2026-10-15' })).toEqual([2]);
  expect(await ids({ q: '赞美' })).toEqual([4]);
  expect(await ids({ q: '  EARLY ' })).toEqual([1]);
  expect((await library.querySetlists(1, {})).setlists[0]).not.toHaveProperty('search');
});

it('picks the newest, then highest id, version on equal score and orders families by newest match', async () => {
  const data = snapshot();
  const extra = { ...data.songs[0], id: 4, familyId: 1, parent_id: 1, updated_at: '2026-01-02' };
  data.songs.push(extra);
  data.catalog.push({ ...data.catalog[0], id: 4, familyId: 1, parent_id: 1, updated_at: '2026-01-02' });
  await save(data);
  expect((await library.querySongs(1, { q: 'amazing' })).songs.map(s => s.id)).toEqual([4]);
  expect((await library.querySongs(1, {})).songs.map(s => s.id)).toEqual([3, 4]);
});

it('pages like the server: a page past the end is empty and no rows means no pages', async () => {
  await save();
  const { songs, page, limit, total, totalPages } = await library.querySongs(1, { page: 5, limit: 1 });
  expect({ ids: songs.map(s => s.id), page, limit, total, totalPages }).toEqual({ ids: [], page: 5, limit: 1, total: 2, totalPages: 2 });
  expect(await library.querySetlists(1, { q: 'nothing matches', page: 1, limit: 20 })).toMatchObject({ setlists: [], total: 0, totalPages: 0 });
});

it('reports a song, its versions or a setlist missing from the download as unavailable', async () => {
  await save();
  for (const read of [library.getSong(1, 99), library.getVersions(1, 99), library.getSetlist(1, 99)]) {
    await expect(read).rejects.toThrow('not available in your downloaded library');
  }
});

it('ranks a pinyin hit above short words that only appear inside newer lyrics', async () => {
  const data = snapshot();
  const noise = { ...data.songs[0], id: 4, familyId: 4, title: 'Morning Praise', content: '[C]flexible', updated_at: '2026-01-09' };
  data.songs.push(noise);
  const { content: _, ...meta } = noise;
  data.catalog.push({ ...meta, search: { title: ['morning praise'], artist: ['anonymous'], lyrics: ['flexible'], pinyin: 'morningpraiseanonymous' } });
  await save(data);
  expect((await library.querySongs(1, { q: 'xi le' })).songs.map(s => s.id)).toEqual([3, 4]);
});
