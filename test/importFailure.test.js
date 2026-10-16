const test = require('node:test');
const assert = require('node:assert/strict');
const { db, user, serve } = require('./helpers/app');
const { createSongsRouter } = require('../routes/songs');
const Song = require('../lib/models/song');
test.after(() => db.close());
const admin = user('import-failure-admin', 'admin');

test('a failed import answers 500 with the import message', async t => {
  const original = Song.importSongs;
  Song.importSongs = () => { throw new Error('disk full'); };
  t.after(() => { Song.importSongs = original; });
  const request = await serve(t, app => app.use('/api', createSongsRouter()));
  const res = await request('/api/songs/import', { ...admin, method: 'POST', body: { songs: [{ content: '{title: Import Fail}\n[C]a' }] } });
  assert.deepEqual([res.status, await res.json()], [500, { error: 'Import failed. Please check your data and try again.' }]);
});
