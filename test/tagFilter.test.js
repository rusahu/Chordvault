const test = require('node:test');
const assert = require('node:assert/strict');
const { db, user, serve } = require('./helpers/app');
const Song = require('../lib/models/song');
const { createSongsRouter } = require('../routes/songs');
test.after(() => db.close());
const owner = user('tag-filter-owner');
const insert = db.prepare("INSERT INTO songs (user_id, title, artist, content, language, visibility, tags) VALUES (?, ?, 'Writer', '[C]Sing', ?, 'public', ?)");
for (const [title, language, tags] of [
  ['Christmas Song', 'en', 'christmas,worship'], ['Kids Song', 'en', 'kids'], ['Hymns Song', 'en', 'hymns'],
  ['Underscore Song', 'en', 'a_b'], ['Untagged Song', 'en', null], ['Chinese Kids Song', 'zh', 'kids'],
]) insert.run(owner.id, title, language, tags);
const root = Number(db.prepare("INSERT INTO songs (user_id, title, artist, content, language, visibility, tags, updated_at) VALUES (?, 'Advent Old', 'Writer', '[C]Sing', 'en', 'public', 'advent', '2026-01-01')").run(owner.id).lastInsertRowid);
db.prepare("INSERT INTO songs (user_id, title, artist, content, language, visibility, tags, parent_id, updated_at) VALUES (?, 'Advent New', 'Writer', '[C]Sing', 'en', 'public', NULL, ?, '2026-02-01')").run(owner.id, root);
const titles = list => (Array.isArray(list) ? list : list.songs).map(s => s.title).sort();

test('matches songs with any picked tag, by exact name', () => {
  assert.deepEqual(titles(Song.listPublic({ tags: ['christmas', 'kids'] })), ['Chinese Kids Song', 'Christmas Song', 'Kids Song']);
  assert.deepEqual(titles(Song.listPublic({ tags: ['hymn'] })), []);
  assert.deepEqual(titles(Song.listPublic({ tags: ['a%b'] })), []);
  assert.deepEqual(titles(Song.listPublic({ tags: ['a_b'] })), ['Underscore Song']);
  assert.equal(Song.listPublic({ tags: [] }).length, 7);
});

test('a family shows when one of its versions has the tag, as that version', () => {
  assert.deepEqual(titles(Song.listPublic({ tags: ['advent'] })), ['Advent Old']);
  assert.ok(titles(Song.listPublic({})).includes('Advent New'));
});

test('combines with language and search, and counts only matching songs', () => {
  const chinese = Song.listPublic({ tags: ['kids'], language: 'zh', page: 1, limit: 20 });
  assert.deepEqual([chinese.total, titles(chinese)], [1, ['Chinese Kids Song']]);
  assert.deepEqual(titles(Song.listPublic({ q: 'Song', tags: ['kids'] })), ['Chinese Kids Song', 'Kids Song']);
  const own = Song.listForUser(owner.id, { tags: ['kids', 'worship'], page: 1, limit: 2 });
  assert.deepEqual([own.total, own.totalPages, own.songs.length], [3, 2, 2]);
});

test('list routes read ?tags= and reject bad values', async t => {
  const request = await serve(t, app => app.use('/api', createSongsRouter()));
  assert.deepEqual(titles(await (await request('/api/songs/public?tags=christmas,kids&page=1&limit=20')).json()), ['Chinese Kids Song', 'Christmas Song', 'Kids Song']);
  assert.equal((await (await request('/api/songs?tags=kids&page=1&limit=20', owner)).json()).total, 2);
  const repeated = await request('/api/songs/public?tags=a&tags=b');
  assert.deepEqual([repeated.status, await repeated.json()], [400, { error: 'tags must be a string' }]);
  const many = await request(`/api/songs/public?tags=${Array.from({ length: 51 }, (_, i) => `t${i}`).join(',')}`);
  assert.deepEqual([many.status, await many.json()], [400, { error: 'Maximum 50 tags' }]);
});
