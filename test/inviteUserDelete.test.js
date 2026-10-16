const test = require('node:test');
const assert = require('node:assert/strict');
const { db, user, serve } = require('./helpers/app');
const { createAdminRouter } = require('../routes/admin');
test.after(() => db.close());
const mount = app => app.use('/api', createAdminRouter());
const owner = user('invite-delete-owner', 'owner');
const invite = (code, createdBy, usedBy = null) => db.prepare('INSERT INTO invites (code, created_by, used_by, used_at) VALUES (?, ?, ?, ?)')
  .run(code, createdBy, usedBy, usedBy ? '2026-10-16 10:00:00' : null);
const inviteRow = code => db.prepare('SELECT * FROM invites WHERE code = ?').get(code);

test('deleting a user who joined with an invite keeps the used invite', async t => {
  const request = await serve(t, mount);
  const member = user('invite-delete-member');
  invite('used-by-member', owner.id, member.id);
  const res = await request(`/api/admin/users/${member.id}`, { ...owner, method: 'DELETE' });
  assert.equal(res.status, 200);
  assert.deepEqual([inviteRow('used-by-member').used_by, inviteRow('used-by-member').used_at], [null, '2026-10-16 10:00:00']);
  const listed = await (await request('/api/admin/invites', owner)).json();
  assert.ok(listed.some(i => i.code === 'used-by-member'));
});

test('deleting an admin removes their unused invites and keeps the used ones', async t => {
  const request = await serve(t, mount);
  const admin = user('invite-delete-admin', 'admin');
  const joiner = user('invite-delete-joiner');
  invite('admin-pending', admin.id);
  invite('admin-used', admin.id, joiner.id);
  const res = await request(`/api/admin/users/${admin.id}`, { ...owner, method: 'DELETE' });
  assert.equal(res.status, 200);
  assert.equal(inviteRow('admin-pending'), undefined);
  assert.equal(inviteRow('admin-used').created_by, null);
  const listed = await (await request('/api/admin/invites', owner)).json();
  assert.ok(listed.some(i => i.code === 'admin-used'));
});
