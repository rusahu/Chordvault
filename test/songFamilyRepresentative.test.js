process.env.DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('../lib/db');
const Song = require('../lib/models/song');

const u = db.prepare("INSERT INTO users (username, password_hash) VALUES ('u', 'x')").run().lastInsertRowid;
const insert = db.prepare(
  "INSERT INTO songs (user_id, title, artist, content, visibility, status, parent_id, updated_at) VALUES (?, ?, 'x', ?, 'public', 'active', ?, ?)"
);
const add = (title, lyrics, parentId, updatedAt) => Number(insert.run(u, title, `{title: ${title}}\n${lyrics}`, parentId, updatedAt).lastInsertRowid);

const root = add('Zephyr Hymn', '[G]sing', null, '2026-01-01 00:00:00');
const lyricOnly = add('Other Words', '[G]a zephyr blows', root, '2026-01-05 00:00:00');
const single = add('Zephyr Song', '[C]la', null, '2026-01-03 00:00:00');
const tieRoot = add('Quillon Tie', '[C]a', null, '2026-02-01 00:00:00');
const tieVersion = add('Quillon Tie', '[C]b', tieRoot, '2026-02-01 00:00:00');

test('a family is shown by its best-matching version, ordered by its newest match', () => {
  assert.deepEqual(Song.listPublic({ q: 'zephyr' }).map(r => r.id), [root, single]);
  assert.notEqual(Song.listPublic({ q: 'zephyr' })[0].id, lyricOnly);
});

test('equal score and equal time pick the higher id', () => {
  assert.deepEqual(Song.listPublic({ q: 'quillon' }).map(r => r.id), [tieVersion]);
});

test('without a query the newest version represents the family', () => {
  const ids = Song.listPublic({}).map(r => r.id);
  assert.ok(ids.includes(lyricOnly) && !ids.includes(root));
  assert.deepEqual(ids, [tieVersion, lyricOnly, single]);
});
