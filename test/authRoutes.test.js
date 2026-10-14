const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { db, user, serve } = require('./helpers/app');
const { createAuthRouter } = require('../routes/auth');
const { createAdminRouter } = require('../routes/admin');
const { issueToken } = require('../lib/auth');
const admin = user('auth-routes-admin', 'admin');
test.after(() => db.close());
db.prepare("UPDATE settings SET value = '1' WHERE key = 'allow_registration'").run();

const mount = app => {
  app.use('/api/auth', createAuthRouter());
  app.use('/api', createAdminRouter());
};
const THIRTY_DAYS = 30 * 24 * 60 * 60;

function assertToken(token, id, username) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  assert.equal(payload.id, id);
  assert.equal(payload.username, username);
  assert.equal(payload.exp - payload.iat, THIRTY_DAYS);
}

test('issueToken signs id and username for 30 days', () => {
  assertToken(issueToken({ id: 7, username: 'singer' }), 7, 'singer');
});

test('register, login and invite redemption issue the same 30-day token', async t => {
  const request = await serve(t, mount);
  const registered = await (await request('/api/auth/register', { method: 'POST', body: { username: ' singer ', password: 'secret1' } })).json();
  assertToken(registered.token, registered.id, 'singer');
  const login = await (await request('/api/auth/login', { method: 'POST', body: { username: 'singer', password: 'secret1' } })).json();
  assertToken(login.token, registered.id, 'singer');
  const { code } = await (await request('/api/admin/invites', { ...admin, method: 'POST' })).json();
  const redeemed = await (await request('/api/auth/redeem-invite', { method: 'POST', body: { code, username: 'invited', password: 'secret1' } })).json();
  assertToken(redeemed.token, redeemed.id, 'invited');
});

test('duplicate usernames keep their message and gain the DUPLICATE code on every create path', async t => {
  const request = await serve(t, mount);
  user('taken');
  const { code } = await (await request('/api/admin/invites', { ...admin, method: 'POST' })).json();
  for (const [path, options] of [
    ['/api/auth/register', { method: 'POST', body: { username: 'taken', password: 'secret1' } }],
    ['/api/auth/redeem-invite', { method: 'POST', body: { code, username: 'taken', password: 'secret1' } }],
    ['/api/admin/users', { ...admin, method: 'POST', body: { username: 'taken', password: 'secret1' } }],
  ]) {
    const response = await request(path, options);
    assert.equal(response.status, 400, path);
    assert.deepEqual(await response.json(), { error: 'Username already taken', code: 'DUPLICATE' }, path);
  }
});

test('password change keeps its messages', async t => {
  const request = await serve(t, mount);
  const account = user('changer');
  for (const [body, error] of [
    [{ current_password: 'x' }, 'Current password and new password are required'],
    [{ current_password: 'x', new_password: 'short' }, 'New password must be at least 6 characters'],
  ]) {
    const response = await request('/api/auth/password', { ...account, method: 'PUT', body });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error });
  }
});

test('an invite used between the check and the redemption returns 400', async t => {
  const Invite = require('../lib/models/invite');
  const request = await serve(t, mount);
  const { code } = await (await request('/api/admin/invites', { ...admin, method: 'POST' })).json();
  const unused = Invite.findByCode(code);
  assert.equal((await request('/api/auth/redeem-invite', { method: 'POST', body: { code, username: 'race-first', password: 'secret1' } })).status, 200);
  t.mock.method(Invite, 'findByCode', () => unused);
  const response = await request('/api/auth/redeem-invite', { method: 'POST', body: { code, username: 'race-second', password: 'secret1' } });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Invalid or already used invite code' });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE username = 'race-second'").get().n, 0);
});
