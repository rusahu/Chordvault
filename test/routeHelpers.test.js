const test = require('node:test');
const assert = require('node:assert/strict');
const { AppError, requireFound } = require('../lib/errors');
const { requireId, assertValid, validatePassword } = require('../lib/validation');

const isAppError = (status, message) => err => err instanceof AppError && err.status === status && err.message === message && err.code === undefined;

test('requireId returns the parsed id or throws a 400 with the given message', () => {
  assert.equal(requireId('12', 'Invalid song ID'), 12);
  for (const value of ['abc', '0', undefined]) assert.throws(() => requireId(value, 'Invalid song ID'), isAppError(400, 'Invalid song ID'));
});

test('requireFound returns the value or throws a 404 with the given message', () => {
  const song = { id: 1 };
  assert.equal(requireFound(song, 'Song not found'), song);
  for (const value of [undefined, null]) assert.throws(() => requireFound(value, 'Song not found'), isAppError(404, 'Song not found'));
});

test('assertValid throws a 400 only when a validator returned an error', () => {
  assert.doesNotThrow(() => assertValid(null));
  assert.throws(() => assertValid('Name is required'), isAppError(400, 'Name is required'));
});

test('validatePassword checks type and minimum length with a caller label', () => {
  assert.equal(validatePassword('secret1'), null);
  for (const value of ['short', 123456, undefined]) assert.equal(validatePassword(value), 'Password must be at least 6 characters');
  assert.equal(validatePassword('short', 'New password'), 'New password must be at least 6 characters');
});
