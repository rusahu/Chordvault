const test = require('node:test');
const assert = require('node:assert/strict');
const { db, serve } = require('./helpers/app');
const { createAuthRouter } = require('../routes/auth');
test.after(() => db.close());
const mount = app => app.use('/api/auth', createAuthRouter());
const register = (request, username) => request('/api/auth/register', { method: 'POST', body: { username, password: 'secret1' } });
const roles = () => db.prepare('SELECT role FROM users ORDER BY role').all().map(r => r.role);

test('two sign-ups racing on an empty install make one owner, and closed registration refuses the other', async t => {
  const request = await serve(t, mount);
  const responses = await Promise.all([register(request, 'first'), register(request, 'second')]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 403]);
  assert.deepEqual(await responses.find(r => r.status === 403).json(), { error: 'Registration is currently disabled' });
  assert.deepEqual(roles(), ['owner']);
  const later = await register(request, 'later');
  assert.deepEqual([later.status, await later.json()], [403, { error: 'Registration is currently disabled' }]);
});

test('with registration open, a racing second sign-up becomes a normal user', async t => {
  db.prepare('DELETE FROM users').run();
  db.prepare("UPDATE settings SET value = '1' WHERE key = 'allow_registration'").run();
  const request = await serve(t, mount);
  const responses = await Promise.all([register(request, 'third'), register(request, 'fourth')]);
  assert.deepEqual(responses.map(r => r.status), [200, 200]);
  assert.deepEqual((await Promise.all(responses.map(r => r.json()))).map(body => body.role).sort(), ['owner', 'user']);
  assert.deepEqual(roles(), ['owner', 'user']);
});
