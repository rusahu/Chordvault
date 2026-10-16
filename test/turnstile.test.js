const test = require('node:test');
const assert = require('node:assert/strict');
const { db, serve } = require('./helpers/app');
const { createAuthRouter } = require('../routes/auth');
test.after(() => db.close());
const mount = app => app.use('/api/auth', createAuthRouter());
const FAILED = { error: 'Bot verification failed. Please try again.' };

function stubSiteverify(t, reply) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = (url, init) => {
    if (!String(url).includes('challenges.cloudflare.com')) return original(url, init);
    calls.push(init);
    return reply();
  };
  process.env.TURNSTILE_SECRET_KEY = 'turnstile secret';
  db.prepare("UPDATE settings SET value = '1' WHERE key = 'allow_registration'").run();
  t.after(() => { globalThis.fetch = original; delete process.env.TURNSTILE_SECRET_KEY; });
  return calls;
}
const register = (request, username) => request('/api/auth/register', { method: 'POST', body: { username, password: 'secret1', turnstile_token: 'tok en' } });

test('sends the secret and token as a form with a timeout', async t => {
  const calls = stubSiteverify(t, async () => ({ json: async () => ({ success: true }) }));
  const request = await serve(t, mount);
  assert.equal((await register(request, 'turnstile-ok')).status, 200);
  const body = new URLSearchParams(String(calls[0].body));
  assert.deepEqual([body.get('secret'), body.get('response')], ['turnstile secret', 'tok en']);
  assert.ok(calls[0].signal instanceof AbortSignal);
});

test('a network failure or a non JSON reply is a failed check, not a server error', async t => {
  let reply = async () => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); };
  stubSiteverify(t, () => reply());
  const request = await serve(t, mount);
  const timedOut = await register(request, 'turnstile-timeout');
  assert.deepEqual([timedOut.status, await timedOut.json()], [400, FAILED]);
  reply = async () => ({ json: async () => { throw new SyntaxError('Unexpected token <'); } });
  const html = await register(request, 'turnstile-html');
  assert.deepEqual([html.status, await html.json()], [400, FAILED]);
});
