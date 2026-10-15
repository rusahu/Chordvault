const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { addColumnIfMissing } = require('../lib/schema');

test('addColumnIfMissing adds a column once and keeps existing rows', () => {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE t (a TEXT)');
  db.prepare("INSERT INTO t (a) VALUES ('x')").run();
  addColumnIfMissing(db, 't', 'b', 'INTEGER DEFAULT NULL');
  addColumnIfMissing(db, 't', 'b', 'INTEGER DEFAULT NULL');
  assert.deepEqual(db.prepare('PRAGMA table_info(t)').all().map(c => c.name), ['a', 'b']);
  assert.deepEqual(db.prepare('SELECT * FROM t').all(), [{ a: 'x', b: null }]);
  db.close();
});
