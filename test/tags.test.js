const test = require('node:test');
const assert = require('node:assert/strict');
const { db, user } = require('./helpers/app');
const Tags = require('../lib/models/tags');
const { DEFAULT_TAGS } = require('../shared/public-constants.json');
test.after(() => db.close());
const author = user('tags-author');
const setRaw = value => db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('song_tags', ?)").run(value);

test('defaults until saved, saved list after, defaults again after reset', () => {
  assert.deepEqual(Tags.getTags(), DEFAULT_TAGS);
  assert.equal(Tags.isDefault(), true);
  Tags.saveTags(['advent', 'worship']);
  assert.deepEqual(Tags.getTags(), ['advent', 'worship']);
  assert.equal(Tags.isDefault(), false);
  Tags.resetTags();
  assert.deepEqual(Tags.getTags(), DEFAULT_TAGS);
  assert.equal(Tags.isDefault(), true);
});

test('a corrupt stored value falls back to the defaults', () => {
  for (const raw of ['not json', '{"a":1}', '[1,2]']) {
    setRaw(raw);
    assert.deepEqual(Tags.getTags(), DEFAULT_TAGS, raw);
  }
  Tags.resetTags();
});

test('usage counts exact tag names on active songs only', () => {
  const add = (tags, status = 'active') => db.prepare('INSERT INTO songs (user_id,title,content,tags,status) VALUES (?,?,?,?,?)').run(author.id, 'T', '[C]x', tags, status);
  add('hymn,worship'); add('hymns'); add('hymn', 'pending'); add(null);
  Tags.saveTags(['hymn', 'worship', 'kids']);
  assert.deepEqual(Tags.withUsage(), { tags: [{ name: 'hymn', count: 1 }, { name: 'worship', count: 1 }, { name: 'kids', count: 0 }], isDefault: false });
  Tags.resetTags();
});
