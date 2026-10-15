process.env.DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert/strict');
const { familyRootId, visibleToViewer } = require('../lib/songAccess');

test('song access helpers name the family root and the viewer predicate', () => {
  assert.equal(familyRootId({ id: 7, parent_id: null }), 7);
  assert.equal(familyRootId({ id: 7, parent_id: 3 }), 3);
  assert.equal(visibleToViewer('v'), '(v.visibility = ? OR v.user_id = ?)');
});
