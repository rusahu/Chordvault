const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { DEMO_ACCOUNT } = require('../scripts/lib/session.mjs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-seed-'));
fs.mkdirSync(path.join(dir, 'data'));
const { NODE_TEST_CONTEXT: _testContext, ...env } = process.env;
execFileSync(process.execPath, [path.join(__dirname, '../scripts/seed-data.mjs')], {
  cwd: dir, env: { ...env, DB_PATH: path.join(dir, 'data/chordvault.db') }, stdio: 'pipe',
});
const db = new Database(path.join(dir, 'data/chordvault.db'), { readonly: true });
const columns = table => db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);

test.after(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('seeds six hashed songs that search can find', () => {
  assert.ok(columns('songs').includes('content_hash'));
  assert.equal(db.prepare('SELECT count(*) AS n FROM songs WHERE content_hash IS NOT NULL').get().n, 6);
  assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'songs_search'").get(), 'songs_search missing');
  assert.equal(db.prepare('SELECT count(*) AS n FROM songs_search').get().n, 6);
});

test('seeds a hidden owner and the demo admin', () => {
  const roles = Object.fromEntries(db.prepare('SELECT username, role FROM users').all().map(u => [u.username, u.role]));
  assert.deepEqual(roles, { _system: 'owner', [DEMO_ACCOUNT.username]: 'admin' });
  const { password_hash } = db.prepare('SELECT password_hash FROM users WHERE username = ?').get(DEMO_ACCOUNT.username);
  assert.ok(bcrypt.compareSync(DEMO_ACCOUNT.password, password_hash));
});

test('seeds three setlists in their song order', () => {
  assert.ok(!columns('setlist_songs').includes('transpose'));
  const setlists = db.prepare('SELECT id, name FROM setlists ORDER BY id').all().map(({ id, name }) => [name,
    db.prepare('SELECT so.title FROM setlist_songs ss JOIN songs so ON so.id = ss.song_id WHERE ss.setlist_id = ? ORDER BY ss.position').all(id).map(r => r.title)]);
  assert.deepEqual(setlists, [
    ['Sunday Morning Worship', ['It Is Well with My Soul', 'Blessed Assurance', 'Holy, Holy, Holy', 'Amazing Grace']],
    ['Christmas Eve Service', ['Silent Night', 'Amazing Grace']],
    ['Personal Practice', ['Come Thou Fount of Every Blessing']],
  ]);
});
