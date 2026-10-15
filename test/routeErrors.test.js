const test = require('node:test');
const assert = require('node:assert/strict');
const { db, user, serve } = require('./helpers/app');
const { createSongsRouter } = require('../routes/songs');
const { createSetlistsRouter } = require('../routes/setlists');
const { createAdminRouter } = require('../routes/admin');
const { createSettingsRouter } = require('../routes/settings');
const owner = user('errors-owner');
const other = user('errors-other');
const admin = user('errors-admin', 'admin');
const siteOwner = user('errors-site-owner', 'owner');
test.after(() => db.close());

const mount = app => {
  app.use('/api', createSongsRouter());
  app.use('/api', createSetlistsRouter());
  app.use('/api', createAdminRouter());
  app.use('/api', createSettingsRouter());
};
const content = '{title: Grace}\n[C]Grace';
const songId = Number(db.prepare("INSERT INTO songs (user_id,title,content) VALUES (?,'Grace',?)").run(owner.id, content).lastInsertRowid);
const correctionId = Number(db.prepare("INSERT INTO songs (user_id,title,content,status,parent_id) VALUES (?,'Grace',?,'pending',?)").run(other.id, content, songId).lastInsertRowid);
const setlistId = Number(db.prepare("INSERT INTO setlists (user_id,name) VALUES (?,'Sunday')").run(owner.id).lastInsertRowid);
const { SONG_ERRORS } = require('../shared/song-errors.mjs');

async function expectError(request, path, options, status, error) {
  const response = await request(path, options);
  assert.equal(response.status, status, path);
  assert.deepEqual(await response.json(), { error }, path);
}

test('song routes keep their id, not-found and permission errors', async t => {
  const request = await serve(t, mount);
  for (const [path, options, status, error] of [
    ['/api/songs/abc', {}, 400, 'Invalid song ID'],
    ['/api/songs/999999', {}, 404, 'Song not found'],
    ['/api/songs/abc', { ...owner, method: 'PUT', body: { content } }, 400, 'Invalid song ID'],
    ['/api/songs/999999', { ...owner, method: 'PUT', body: { content } }, 404, 'Song not found or not yours'],
    ['/api/songs/abc', { ...owner, method: 'DELETE' }, 400, 'Invalid song ID'],
    ['/api/songs/999999', { ...owner, method: 'DELETE' }, 404, 'Song not found or not yours'],
    ['/api/songs/abc/version', { ...owner, method: 'POST', body: { content } }, 400, 'Invalid song ID'],
    ['/api/songs/999999/version', { ...owner, method: 'POST', body: { content } }, 404, 'Song not found'],
    ['/api/songs/abc/versions', {}, 400, 'Invalid song ID'],
    ['/api/songs/999999/versions', {}, 404, 'Song not found'],
    ['/api/songs/abc/correction', { ...other, method: 'POST', body: { content } }, 400, 'Invalid song ID'],
    ['/api/songs/999999/correction', { ...other, method: 'POST', body: { content } }, 404, 'Song not found'],
    ['/api/songs/abc/corrections', owner, 400, 'Invalid song ID'],
    ['/api/songs/999999/corrections', owner, 404, 'Song not found'],
    ['/api/users/nobody/songs', {}, 404, 'User not found'],
    ['/api/corrections/abc/approve', { ...owner, method: 'PUT' }, 400, 'Invalid correction ID'],
    ['/api/corrections/999999/approve', { ...owner, method: 'PUT' }, 404, 'Pending correction not found'],
    [`/api/corrections/${songId}`, { ...owner, method: 'DELETE' }, 404, 'Pending correction not found'],
    [`/api/corrections/${correctionId}/approve`, { ...other, method: 'PUT' }, 403, 'Only the song owner or admins can manage corrections'],
  ]) await expectError(request, path, options, status, error);
});

test('setlist routes keep their id and not-found errors', async t => {
  const request = await serve(t, mount);
  for (const [path, options, status, error] of [
    ['/api/setlists/public/abc', {}, 400, 'Invalid setlist ID'],
    ['/api/setlists/public/999999', {}, 404, 'Setlist not found'],
    ['/api/setlists/abc', owner, 400, 'Invalid setlist ID'],
    [`/api/setlists/${setlistId}`, other, 404, 'Setlist not found'],
    ['/api/setlists/abc', { ...owner, method: 'PUT', body: { name: 'x' } }, 400, 'Invalid setlist ID'],
    [`/api/setlists/${setlistId}`, { ...other, method: 'PUT', body: { name: 'x' } }, 404, 'Setlist not found'],
    ['/api/setlists/abc', { ...owner, method: 'DELETE' }, 400, 'Invalid setlist ID'],
    [`/api/setlists/${setlistId}`, { ...other, method: 'DELETE' }, 404, 'Setlist not found'],
    ['/api/setlists/abc/songs', { ...owner, method: 'POST', body: { song_id: songId } }, 400, 'Invalid setlist ID'],
    [`/api/setlists/${setlistId}/songs`, { ...other, method: 'POST', body: { song_id: songId } }, 404, 'Setlist not found'],
    [`/api/setlists/${setlistId}/songs`, { ...owner, method: 'POST', body: { song_id: 999999 } }, 404, 'Song not found'],
    ['/api/setlists/abc/entries/1', { ...owner, method: 'PUT', body: {} }, 400, 'Invalid setlist ID'],
    [`/api/setlists/${setlistId}/entries/abc`, { ...owner, method: 'PUT', body: {} }, 400, 'Invalid entry ID'],
    [`/api/setlists/${setlistId}/entries/999999`, { ...owner, method: 'PUT', body: {} }, 404, 'Entry not found'],
    [`/api/setlists/${setlistId}/entries/1`, { ...other, method: 'PUT', body: {} }, 404, 'Setlist not found'],
    [`/api/setlists/${setlistId}/entries/abc`, { ...owner, method: 'DELETE' }, 400, 'Invalid entry ID'],
    [`/api/setlists/${setlistId}/entries/999999`, { ...owner, method: 'DELETE' }, 404, 'Entry not found'],
    ['/api/setlists/abc/reorder', { ...owner, method: 'PUT', body: { entry_ids: [] } }, 400, 'Invalid setlist ID'],
    [`/api/setlists/${setlistId}/reorder`, { ...other, method: 'PUT', body: { entry_ids: [] } }, 404, 'Setlist not found'],
  ]) await expectError(request, path, options, status, error);
});

test('admin routes keep their target, id and password errors', async t => {
  const request = await serve(t, mount);
  for (const [path, options, status, error] of [
    ['/api/admin/users/abc/role', { ...admin, method: 'PUT', body: { role: 'user' } }, 400, 'Invalid user ID'],
    ['/api/admin/users/999999/disabled', { ...admin, method: 'PUT', body: { disabled: true } }, 404, 'User not found'],
    [`/api/admin/users/${siteOwner.id}`, { ...admin, method: 'DELETE' }, 403, 'Cannot modify the owner'],
    [`/api/admin/users/${admin.id}/disabled`, { ...admin, method: 'PUT', body: { disabled: true } }, 403, 'Only the owner can manage admins'],
    [`/api/admin/users/${other.id}/password`, { ...admin, method: 'PUT', body: { password: 'short' } }, 400, 'Password must be at least 6 characters'],
    [`/api/admin/users/${other.id}/password`, { ...admin, method: 'PUT', body: { password: 123456 } }, 400, 'Password must be at least 6 characters'],
    ['/api/admin/songs/abc', { ...admin, method: 'DELETE' }, 400, 'Invalid song ID'],
    ['/api/admin/songs/999999', { ...admin, method: 'DELETE' }, 404, 'Song not found'],
    ['/api/admin/invites/abc', { ...admin, method: 'DELETE' }, 400, 'Invalid invite ID'],
    ['/api/admin/invites/999999', { ...admin, method: 'DELETE' }, 404, 'Invite not found or already used'],
  ]) await expectError(request, path, options, status, error);
});

test('settings routes keep their prompt and OCR input errors', async t => {
  const request = await serve(t, mount);
  for (const [path, options, status, error] of [
    ['/api/settings/ocr-prompt', { ...owner, method: 'PUT', body: { prompt: ' ' } }, 400, 'Prompt is required'],
    ['/api/settings/ocr-prompt', { ...owner, method: 'PUT', body: { prompt: 'x'.repeat(5001) } }, 400, 'Prompt must be under 5000 characters'],
    ['/api/ocr/gemini', { ...owner, method: 'POST', body: {} }, 400, 'Base64 image is required'],
    ['/api/ocr/gemini', { ...owner, method: 'POST', body: { image: 'data:image/png;base64,YQ==' } }, 400, 'No Gemini API key configured. Add one in Settings.'],
    ['/api/ocr/gemini/refine', { ...owner, method: 'POST', body: { image: 'x', history: [] } }, 400, 'image, history, and message are required'],
    ['/api/ocr/gemini/refine', { ...owner, method: 'POST', body: { image: 'x', history: Array(21).fill({ role: 'user', text: 'x' }), message: 'x' } }, 400, 'Conversation too long. Start a new extraction.'],
    ['/api/ocr/gemini/refine', { ...owner, method: 'POST', body: { image: 'x', history: [], message: 'x'.repeat(2001) } }, 400, 'Message too long (max 2000 chars)'],
  ]) await expectError(request, path, options, status, error);
  await expectError(request, '/api/ocr/gemini/refine', { ...owner, method: 'POST', body: { image: 'x', history: [], message: 'x' } }, 400, 'No Gemini API key configured. Add one in Settings.');
});

test('a stored Gemini key that no longer decrypts is a 500 on both OCR routes', async t => {
  const request = await serve(t, mount);
  const account = user('errors-bad-key');
  db.prepare('UPDATE users SET gemini_api_key = ? WHERE id = ?').run('00:00:00', account.id);
  for (const path of ['/api/ocr/gemini', '/api/ocr/gemini/refine']) {
    await expectError(request, path, { ...account, method: 'POST', body: { image: 'data:image/png;base64,YQ==', history: [], message: 'x' } }, 500, 'Failed to decrypt API key. Try re-saving it in Settings.');
  }
});

test('versions and corrections require a title and a known language', async t => {
  const request = await serve(t, mount);
  const noTitle = '[C]Grace';
  const badLanguage = '{title: Grace}\n{x_language: zz}\n[C]Grace';
  for (const path of [`/api/songs/${songId}/version`, `/api/songs/${songId}/correction`]) {
    await expectError(request, path, { ...other, method: 'POST', body: { content: noTitle } }, 400, SONG_ERRORS.titleRequired);
    await expectError(request, path, { ...other, method: 'POST', body: { content: badLanguage } }, 400, 'Invalid language code');
  }
});

test('admin disable accepts only a boolean', async t => {
  const request = await serve(t, mount);
  const target = user('errors-disable-target');
  const path = `/api/admin/users/${target.id}/disabled`;
  for (const disabled of ['false', 'true', 0, 1, null, undefined]) {
    await expectError(request, path, { ...admin, method: 'PUT', body: { disabled } }, 400, 'disabled must be a boolean');
  }
  assert.equal(db.prepare('SELECT disabled FROM users WHERE id = ?').get(target.id).disabled, 0);
  for (const disabled of [true, false]) {
    assert.equal((await request(path, { ...admin, method: 'PUT', body: { disabled } })).status, 200);
    assert.equal(db.prepare('SELECT disabled FROM users WHERE id = ?').get(target.id).disabled, disabled ? 1 : 0);
  }
});

test('every song save checks the YouTube link and title length from the song text', async t => {
  const request = await serve(t, mount);
  const youtubeError = 'YouTube URL must be a valid youtube.com or youtu.be link';
  const evil = '{title: Grace}\n{x_language: en}\n{x_youtube: https://evil.example/watch}\n[C]Grace';
  const longTitle = `{title: ${'T'.repeat(201)}}\n{x_language: en}\n[C]Grace`;
  const saves = [
    ['/api/songs', { ...owner, method: 'POST' }],
    [`/api/songs/${songId}`, { ...owner, method: 'PUT' }],
    [`/api/songs/${songId}/version`, { ...other, method: 'POST' }],
    [`/api/songs/${songId}/correction`, { ...other, method: 'POST' }],
  ];
  for (const [path, options] of saves) {
    await expectError(request, path, { ...options, body: { content: evil } }, 400, youtubeError);
    await expectError(request, path, { ...options, body: { content: longTitle } }, 400, 'Title too long (max 200 characters)');
  }
  const imported = await (await request('/api/songs/import', { ...admin, method: 'POST', body: { songs: [{ content: evil }, { content: '{title: Words}\njust words' }] } })).json();
  assert.deepEqual(imported.errors, [{ index: 0, error: youtubeError }, { index: 1, error: SONG_ERRORS.noChords }]);
  for (const link of ['https://m.youtube.com/watch?v=abc', 'https://music.youtube.com/watch?v=abc', 'https://youtu.be/abc']) {
    const ok = await request('/api/songs', { ...owner, method: 'POST', body: { content: `{title: Link}\n{x_language: en}\n{x_youtube: ${link}}\n[C]Grace` } });
    assert.equal(ok.status, 200, link);
  }
});

test('admins can use any song they can view; others cannot use a private song', async t => {
  const request = await serve(t, mount);
  const privateId = Number(db.prepare("INSERT INTO songs (user_id,title,content,visibility) VALUES (?,'Hidden',?,'private')").run(owner.id, content).lastInsertRowid);
  const adminSetlist = Number(db.prepare("INSERT INTO setlists (user_id,name) VALUES (?,'Admin set')").run(admin.id).lastInsertRowid);
  const otherSetlist = Number(db.prepare("INSERT INTO setlists (user_id,name) VALUES (?,'Other set')").run(other.id).lastInsertRowid);
  const correction = { content: '{title: Hidden}\n{x_language: en}\n[C]Grace' };
  assert.equal((await request(`/api/setlists/${adminSetlist}/songs`, { ...admin, method: 'POST', body: { song_id: privateId } })).status, 200);
  assert.equal((await request(`/api/songs/${privateId}/correction`, { ...admin, method: 'POST', body: correction })).status, 200);
  assert.equal((await request(`/api/setlists/${otherSetlist}/songs`, { ...other, method: 'POST', body: { song_id: privateId } })).status, 403);
  assert.equal((await request(`/api/songs/${privateId}/correction`, { ...other, method: 'POST', body: correction })).status, 403);
});

test('setlists reject an unknown visibility', async t => {
  const request = await serve(t, mount);
  const error = 'Visibility must be "public" or "private"';
  await expectError(request, '/api/setlists', { ...owner, method: 'POST', body: { name: 'Odd', visibility: 'secret' } }, 400, error);
  await expectError(request, `/api/setlists/${setlistId}`, { ...owner, method: 'PUT', body: { name: 'Odd', visibility: 'secret' } }, 400, error);
});
