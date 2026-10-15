process.env.DEMO_MODE = 'true';
const test = require('node:test');
const assert = require('node:assert/strict');
const { db, serve } = require('./helpers/app');
const { createAuthRouter } = require('../routes/auth');
test.after(() => db.close());

test('in demo mode only the first account can sign up', async t => {
  const request = await serve(t, app => app.use('/api/auth', createAuthRouter()));
  const register = username => request('/api/auth/register', { method: 'POST', body: { username, password: 'secret1' } });
  const first = await register('demo-owner');
  assert.deepEqual([first.status, (await first.json()).role], [200, 'owner']);
  const second = await register('demo-second');
  assert.deepEqual([second.status, await second.json()], [403, { error: 'Disabled in demo mode' }]);
});
