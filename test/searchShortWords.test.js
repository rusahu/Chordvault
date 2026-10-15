process.env.DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('../lib/db');
const Song = require('../lib/models/song');

const userId = db.prepare("INSERT INTO users (username, password_hash) VALUES ('u', 'x')").run().lastInsertRowid;
const insert = db.prepare("INSERT INTO songs (user_id, title, artist, content, visibility, status) VALUES (?, ?, ?, ?, 'public', 'active')");
insert.run(userId, 'Amazing Grace', 'Abel', '{title: Amazing Grace}\n[G]how sweet the sound');
insert.run(userId, '喜樂平安', '某人', '{title: 喜樂平安}\n[G]心裡有喜樂');
insert.run(userId, '我爱你', '某人', '{title: 我爱你}\n[C]爱');
insert.run(userId, 'Other Song', 'Nobody', '{title: Other Song}\n[C]nothing here');

const titles = q => Song.listPublic({ q }).map(r => r.title).sort();

test('a query with a short word still finds songs that have every word', () => {
  assert.deepEqual(titles('amazing ab'), ['Amazing Grace']);
  assert.deepEqual(titles('grace a'), ['Amazing Grace']);
  assert.deepEqual(titles('喜樂 平安'), ['喜樂平安']);
});

test('pinyin and long-word searches keep working', () => {
  assert.deepEqual(titles('wo ai ni'), ['我爱你']);
  assert.deepEqual(titles('amazing grace'), ['Amazing Grace']);
  assert.deepEqual(titles('喜樂'), ['喜樂平安']);
  assert.deepEqual(titles('amazing zz'), []);
});
