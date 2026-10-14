const test = require('node:test');
const assert = require('node:assert/strict');
const { db, user, serve } = require('./helpers/app');
const { createSongsRouter } = require('../routes/songs');
const { createAdminRouter } = require('../routes/admin');
const { DEFAULT_TAGS } = require('../shared/public-constants.json');
const admin = user('tag-routes-admin', 'admin');
const member = user('tag-routes-member');
test.after(() => db.close());
const mount = app => { app.use('/api', createSongsRouter()); app.use('/api', createAdminRouter()); };

test('admins edit the list, everyone reads it', async t => {
  const request = await serve(t, mount);
  assert.deepEqual(await (await request('/api/tags')).json(), { tags: DEFAULT_TAGS });

  const saved = await request('/api/admin/tags', { ...admin, method: 'PUT', body: { tags: [' Advent ', 'worship'] } });
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), { tags: [{ name: 'advent', count: 0 }, { name: 'worship', count: 0 }], isDefault: false });
  assert.deepEqual(await (await request('/api/tags')).json(), { tags: ['advent', 'worship'] });
  assert.equal((await (await request('/api/admin/tags', admin)).json()).isDefault, false);

  const reset = await request('/api/admin/tags', { ...admin, method: 'DELETE' });
  assert.equal((await reset.json()).isDefault, true);
  assert.deepEqual(await (await request('/api/tags')).json(), { tags: DEFAULT_TAGS });
});

test('invalid lists and non-admins are rejected without saving', async t => {
  const request = await serve(t, mount);
  const bad = await request('/api/admin/tags', { ...admin, method: 'PUT', body: { tags: ['a,b'] } });
  assert.equal(bad.status, 400);
  assert.deepEqual(await bad.json(), { error: 'Tag names cannot contain commas or braces' });
  assert.equal((await request('/api/admin/tags', { ...member, method: 'PUT', body: { tags: ['x'] } })).status, 403);
  assert.equal((await request('/api/admin/tags', { method: 'DELETE' })).status, 401);
  assert.equal((await request('/api/admin/tags', member)).status, 403);
  assert.deepEqual(await (await request('/api/tags')).json(), { tags: DEFAULT_TAGS });
});
