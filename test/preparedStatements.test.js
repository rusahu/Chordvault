const test = require('node:test');
const assert = require('node:assert/strict');
const { db, user } = require('./helpers/app');
const Setlist = require('../lib/models/setlist');
const User = require('../lib/models/user');

test.after(() => db.close());

test('setlist entry writes and user deletion reuse prepared statements', () => {
  const owner = user('statements');
  const songId = Number(db.prepare("INSERT INTO songs (user_id, title, content) VALUES (?, 'S', '[C]x')").run(owner.id).lastInsertRowid);
  const setlistId = Number(Setlist.create(owner.id, 'List', 'public', null).lastInsertRowid);
  const original = db.prepare;
  let prepared = 0;
  db.prepare = function (...args) { prepared += 1; return original.apply(this, args); };
  try {
    const { entry_id } = Setlist.addSongEntry(setlistId, songId, { targetKey: null, nashville: false });
    Setlist.updateSongEntry(entry_id, setlistId, { content_override: null }, { targetKeyProvided: false, nashville: true });
    Setlist.reorderEntries(setlistId, [entry_id]);
    Setlist.deleteSongEntry(entry_id, setlistId);
    User.delete(owner.id);
  } finally {
    db.prepare = original;
  }
  assert.equal(prepared, 0);
});
