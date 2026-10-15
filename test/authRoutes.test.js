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

test('login rejects an over-long password before hashing it', async t => {
  const bcrypt = require('bcryptjs');
  const request = await serve(t, mount);
  const compare = t.mock.method(bcrypt, 'compare');
  const response = await request('/api/auth/login', { method: 'POST', body: { username: 'auth-routes-admin', password: 'x'.repeat(257) } });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Invalid username or password' });
  assert.equal(compare.mock.callCount(), 0);
});

test('login runs a password check even when the username does not exist', async t => {
  const bcrypt = require('bcryptjs');
  const request = await serve(t, mount);
  const compare = t.mock.method(bcrypt, 'compare');
  const unknown = await request('/api/auth/login', { method: 'POST', body: { username: 'nobody-here', password: 'secret1' } });
  const wrong = await request('/api/auth/login', { method: 'POST', body: { username: 'auth-routes-admin', password: 'wrong-pass' } });
  assert.deepEqual([unknown.status, await unknown.json()], [401, { error: 'Invalid username or password' }]);
  assert.deepEqual([wrong.status, await wrong.json()], [401, { error: 'Invalid username or password' }]);
  assert.equal(compare.mock.callCount(), 2);
  // bcryptjs returns at once for anything that is not a real hash, so the unknown user must get one.
  assert.match(compare.mock.calls[0].arguments[1], /^\$2b\$10\$.{53}$/);
});

test('a disabled account gets 403 only with the right password', async t => {
  const { hashPassword } = require('../lib/auth');
  const request = await serve(t, mount);
  const { id } = user('disabled-singer');
  db.prepare('UPDATE users SET password_hash = ?, disabled = 1 WHERE id = ?').run(await hashPassword('secret1'), id);
  const login = password => request('/api/auth/login', { method: 'POST', body: { username: 'disabled-singer', password } });
  const right = await login('secret1');
  assert.deepEqual([right.status, await right.json()], [403, { error: 'Account is disabled. Contact an administrator.' }]);
  const wrong = await login('wrong-pass');
  assert.deepEqual([wrong.status, await wrong.json()], [401, { error: 'Invalid username or password' }]);
});

test('password change checks the current password', async t => {
  const { hashPassword } = require('../lib/auth');
  const request = await serve(t, mount);
  const singer = user('changing-singer');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword('secret1'), singer.id);
  const change = current_password => request('/api/auth/password', { ...singer, method: 'PUT', body: { current_password, new_password: 'secret2' } });
  const wrong = await change('wrong-pass');
  assert.deepEqual([wrong.status, await wrong.json()], [401, { error: 'Current password is incorrect' }]);
  assert.equal((await change('secret1')).status, 200);
});
