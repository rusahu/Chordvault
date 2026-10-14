process.env.DEMO_MODE = 'true';
const test = require('node:test');
const assert = require('node:assert/strict');
const { db, user, serve } = require('./helpers/app');
const { createAdminRouter } = require('../routes/admin');
const admin = user('tag-demo-admin', 'admin');
test.after(() => db.close());

test('demo mode blocks tag changes but not reads', async t => {
  const request = await serve(t, app => app.use('/api', createAdminRouter()));
  assert.equal((await request('/api/admin/tags', { ...admin, method: 'PUT', body: { tags: ['x'] } })).status, 403);
  assert.equal((await request('/api/admin/tags', { ...admin, method: 'DELETE' })).status, 403);
  assert.equal((await request('/api/admin/tags', admin)).status, 200);
});
