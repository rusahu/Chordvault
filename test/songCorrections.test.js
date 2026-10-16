process.env.DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('../lib/db');
const Song = require('../lib/models/song');
const User = require('../lib/models/user');

const meta = { title: 'Grace', artist: '', key: 'C', youtube_url: null, bpm: null, tags: null, language: 'en' };
const makeUser = (name) => Number(db.prepare('INSERT INTO users (username,password_hash) VALUES (?,?)').run(name, 'x').lastInsertRowid);
const pendingIds = () => Song.getPendingCorrections().map((c) => c.id);
test.after(() => db.close());

function fixture(suffix) {
  const owner = makeUser(`owner-${suffix}`), other = makeUser(`other-${suffix}`);
  const song = Number(Song.create(owner, meta, `[C]Song ${suffix}`, 'public', null).lastInsertRowid);
  const correction = Number(Song.createCorrection(other, song, meta, `[G]Fix ${suffix}`).lastInsertRowid);
  const version = Number(Song.createVersion(other, song, meta, `[D]Version ${suffix}`, 'public').lastInsertRowid);
  return { owner, other, song, correction, version };
}

test('deleting a song deletes its pending corrections and keeps its versions', () => {
  const f = fixture('delete');
  assert.equal(Song.delete(f.song, f.owner).changes, 1);
  assert.equal(pendingIds().includes(f.correction), false);
  assert.equal(Song.findById(f.correction), undefined);
  assert.ok(Song.findById(f.version));
});

test('an admin delete also deletes the pending corrections', () => {
  const f = fixture('admin');
  assert.equal(Song.delete(f.song).changes, 1);
  assert.equal(Song.findById(f.correction), undefined);
});

test('a delete by someone else removes nothing, corrections included', () => {
  const f = fixture('stranger');
  assert.equal(Song.delete(f.song, f.other).changes, 0);
  assert.ok(Song.findById(f.song));
  assert.ok(pendingIds().includes(f.correction));
});

test('deleting a user deletes pending corrections on their songs', () => {
  const f = fixture('user');
  User.delete(f.owner);
  assert.equal(Song.findById(f.correction), undefined);
  assert.ok(User.findById(f.other));
});
