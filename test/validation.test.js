const test = require('node:test');
const assert = require('node:assert/strict');
const { parseId, isValidDate, validateUserCredentials, validateSongInput, validateSetlistInput, parsePaginationParams, validatePassword, validateSongMetadata, validateBoolean, validateTagList } = require('../lib/validation');

test('IDs are positive safe integers with no coercion of other types', () => {
  for (const value of ['12junk','1.5','1e3','',0,-1,1.5,true,[],{},Number.MAX_SAFE_INTEGER+1]) assert.equal(parseId(value),null,JSON.stringify(value));
  assert.equal(parseId(' 12 '),12);
  assert.equal(parseId(12),12);
});
test('dates must be real calendar dates', () => {
  for (const value of ['2026-02-31','2025-02-29','2026-13-01',{},null]) assert.equal(isValidDate(value),false);
  assert.equal(isValidDate('2024-02-29'),true);
});
test('validators reject malformed field types instead of throwing', () => {
  for (const value of [123,true,[],{}]) {
    assert.ok(validateUserCredentials(value,'password123'));
    assert.ok(validateUserCredentials('validuser',value));
    assert.ok(validateSongInput({content:value}));
    assert.ok(validateSongInput({title:value}));
    assert.ok(validateSongInput({youtube_url:value}));
    assert.ok(validateSetlistInput(value));
  }
});
test('pagination retains omission defaults and rejects explicit invalid values', () => {
  assert.deepEqual(parsePaginationParams(),{page:null,limit:null});
  assert.deepEqual(parsePaginationParams('2'),{page:2,limit:20});
  assert.deepEqual(parsePaginationParams(undefined,'5'),{page:1,limit:5});
  for (const value of ['0','-1','12junk','',null,[],{}]) assert.throws(()=>parsePaginationParams(value,'10'),err=>err.status===400);
  assert.throws(()=>parsePaginationParams(Number.MAX_SAFE_INTEGER,10),err=>err.status===400);
});

test('song metadata needs a title and accepts only known languages', () => {
  assert.equal(validateSongMetadata({ title: '', language: 'en' }), 'Title is required. Add {title: Song Name} to your content.');
  assert.equal(validateSongMetadata({ title: 'Grace', language: 'zz' }), 'Invalid language code');
  assert.equal(validateSongMetadata({ title: 'Grace', language: '' }), null);
  assert.equal(validateSongMetadata({ title: 'Grace', language: 'en' }), null);
});
test('boolean fields reject strings and numbers', () => {
  for (const value of ['false', 'true', 0, 1, null, undefined]) assert.equal(validateBoolean(value, 'disabled'), 'disabled must be a boolean');
  assert.equal(validateBoolean(false, 'disabled'), null);
  assert.equal(validateBoolean(true, 'allowRegistration'), null);
});
test('passwords are capped so bcrypt never reads a huge string', () => {
  assert.equal(validatePassword('x'.repeat(256)), null);
  assert.equal(validatePassword('x'.repeat(257), 'New password'), 'New password must be at most 256 characters');
});
test('tag lists are cleaned and validated', () => {
  assert.deepEqual(validateTagList([' Worship ', 'KIDS']), { tags: ['worship', 'kids'], error: null });
  assert.deepEqual(validateTagList([]), { tags: [], error: null });
  for (const [value, error] of [
    ['worship', 'Tags must be a list of names'],
    [[1], 'Tags must be a list of names'],
    [['  '], 'Tag names must be 1 to 30 characters'],
    [['x'.repeat(31)], 'Tag names must be 1 to 30 characters'],
    [['a,b'], 'Tag names cannot contain commas or braces'],
    [['a}'], 'Tag names cannot contain commas or braces'],
    [['hymn', 'Hymn'], 'Duplicate tag: hymn'],
    [Array.from({ length: 51 }, (_, i) => `t${i}`), 'Maximum 50 tags'],
  ]) assert.equal(validateTagList(value).error, error, JSON.stringify(value).slice(0, 40));
});
