const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanTagName, splitTags, tagNameError } = require('../shared/tags.mjs');

test('splitTags cleans, drops blanks and keeps the first of each name', () => {
  assert.deepEqual(splitTags(' Worship, worship ,,Kids'), ['worship', 'kids']);
  for (const empty of [null, undefined, '', ' , ']) assert.deepEqual(splitTags(empty), [], String(empty));
});

test('cleanTagName and tagNameError apply the tag rules', () => {
  assert.equal(cleanTagName('  Advent '), 'advent');
  assert.equal(tagNameError('advent', ['worship'], 30), null);
  assert.equal(tagNameError('', [], 30), 'Tag names must be 1 to 30 characters');
  assert.equal(tagNameError('x'.repeat(31), [], 30), 'Tag names must be 1 to 30 characters');
  assert.equal(tagNameError('a{b', [], 30), 'Tag names cannot contain commas or braces');
  assert.equal(tagNameError('worship', ['worship'], 30), 'Duplicate tag: worship');
});
