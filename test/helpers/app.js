process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'backend-cleanup-test';
const jwt = require('jsonwebtoken');
const { db } = require('../../lib/db');
const { createApp } = require('../../lib/app');
const User = require('../../lib/models/user');

function user(name, role = 'user') {
  const { id } = User.create(name, 'unused', role);
  return { id, token: jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1h' }) };
}

async function serve(t, mount) {
  const app = createApp(mount);
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return (path, { method = 'GET', token, body, ip = '192.0.2.1' } = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

module.exports = { db, user, serve };
