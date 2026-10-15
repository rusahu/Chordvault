process.env.DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert/strict');
const { AppError, requireFound } = require('../lib/errors');
const { requireId, assertValid, validatePassword, validateOcrPrompt, validateOcrImage, validateRefineInput } = require('../lib/validation');

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

test('OCR validators keep each route message', () => {
  assert.equal(validateOcrPrompt('Read chords'), null);
  assert.equal(validateOcrPrompt(' '), 'Prompt is required');
  assert.equal(validateOcrPrompt('x'.repeat(5001)), 'Prompt must be under 5000 characters');
  const oversized = 'a'.repeat(25 * 1024 * 1024);
  assert.equal(validateOcrImage('data:image/png;base64,YQ=='), null);
  assert.equal(validateOcrImage(), 'Base64 image is required');
  assert.equal(validateOcrImage(oversized), 'File too large (max 18MB)');
  const refine = { image: 'x', history: [], message: 'fix' };
  assert.equal(validateRefineInput(refine), null);
  assert.equal(validateRefineInput({ ...refine, message: '' }), 'image, history, and message are required');
  assert.equal(validateRefineInput({ ...refine, image: oversized }), 'Image too large (max 18MB)');
  assert.equal(validateRefineInput({ ...refine, history: [{ role: 'system', text: 'x' }] }), 'History entries require a user/model role and string text');
  assert.equal(validateRefineInput({ ...refine, message: 'x'.repeat(2001) }), 'Message too long (max 2000 chars)');
  assert.equal(validateRefineInput({ ...refine, history: Array(21).fill({ role: 'user', text: 'x' }) }), 'Conversation too long. Start a new extraction.');
});

test('shared error messages keep their wording', () => {
  assert.equal(require('../lib/demo').DEMO_DISABLED, 'Disabled in demo mode');
  assert.equal(require('../lib/models/invite').INVALID_INVITE, 'Invalid or already used invite code');
  assert.equal(require('../lib/validation').CREDENTIALS_REQUIRED, 'Username and password required');
});
