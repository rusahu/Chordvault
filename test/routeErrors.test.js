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
  const refine = await request('/api/ocr/gemini/refine', { ...owner, method: 'POST', body: { image: 'x', history: [], message: 'x' } });
  assert.equal(refine.status, 400);
});

test('a stored Gemini key that no longer decrypts is a 500 on both OCR routes', async t => {
  const request = await serve(t, mount);
  const account = user('errors-bad-key');
  db.prepare('UPDATE users SET gemini_api_key = ? WHERE id = ?').run('00:00:00', account.id);
  for (const path of ['/api/ocr/gemini', '/api/ocr/gemini/refine']) {
    const response = await request(path, { ...account, method: 'POST', body: { image: 'data:image/png;base64,YQ==', history: [], message: 'x' } });
    assert.equal(response.status, 500, path);
  }
});
