const test = require('node:test');
const assert = require('node:assert/strict');
const { ROLES, STATUS, VISIBILITY, isAdminRole, normalizeVisibility } = require('../shared/access.mjs');
const constants = require('../lib/constants');

test('the server constants are the shared ones', () => {
  assert.equal(constants.ROLES, ROLES);
  assert.equal(constants.STATUS, STATUS);
  assert.equal(constants.VISIBILITY, VISIBILITY);
  assert.deepEqual({ ...ROLES, ...STATUS, ...VISIBILITY }, { OWNER: 'owner', ADMIN: 'admin', USER: 'user', ACTIVE: 'active', PENDING: 'pending', PUBLIC: 'public', PRIVATE: 'private' });
});

test('isAdminRole accepts owner and admin only', () => {
  assert.deepEqual(['owner', 'admin', 'user', '', undefined].map(isAdminRole), [true, true, false, false, false]);
});

test('normalizeVisibility keeps private and makes anything else public', () => {
  assert.deepEqual(['private', 'public', undefined, null, 'PRIVATE', 'secret'].map(normalizeVisibility), ['private', 'public', 'public', 'public', 'public', 'public']);
});

test('the password minimum is a shared limit', () => {
  assert.equal(require('../shared/public-constants.json').limits.PASSWORD_MIN, 6);
  assert.equal(constants.LIMITS.PASSWORD_MIN, 6);
});
