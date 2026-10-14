const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { db, user } = require('./helpers/app');
const User = require('../lib/models/user');
const { encryptApiKey, decryptApiKey, loadGeminiCredentials } = require('../lib/geminiKey');
const { AppError } = require('../lib/errors');
test.after(() => db.close());

const KEY = 'test-key-for-gemini-credentials-1234';

test('the encryption key is derived once and reused', t => {
  const derive = t.mock.method(crypto, 'pbkdf2Sync');
  const stored = encryptApiKey(KEY);
  assert.equal(decryptApiKey(stored), KEY);
  assert.equal(decryptApiKey(encryptApiKey(KEY)), KEY);
  assert.equal(derive.mock.callCount(), 1);
});

test('a tampered value does not decrypt', () => {
  const [iv, tag, enc] = encryptApiKey(KEY).split(':');
  assert.throws(() => decryptApiKey([iv, tag, enc.replace(/^./, c => (c === '0' ? '1' : '0'))].join(':')));
});

test('loadGeminiCredentials returns the user and plaintext key', () => {
  const account = user('gemini-ok');
  User.updateGeminiApiKey(account.id, encryptApiKey(KEY));
  const { user: row, apiKey } = loadGeminiCredentials(account.id);
  assert.equal(row.id, account.id);
  assert.equal(apiKey, KEY);
});

test('loadGeminiCredentials throws 400 without a key and 500 when it cannot decrypt', () => {
  const missing = user('gemini-missing');
  assert.throws(() => loadGeminiCredentials(missing.id), err => err instanceof AppError && err.status === 400 && err.message === 'No Gemini API key configured. Add one in Settings.');
  const broken = user('gemini-broken');
  User.updateGeminiApiKey(broken.id, '00:00:00');
  assert.throws(() => loadGeminiCredentials(broken.id), err => err instanceof AppError && err.status === 500 && err.message === 'Failed to decrypt API key. Try re-saving it in Settings.');
});

test('a key stored by v1.29.1 still decrypts', () => {
  const stored = '247808c269dff6e98386c3c0:16f5c7a3029f45770db6cd962d60d7fa:d0946e256a200ea6570606a91443a26d6bfe92f27c2ae17a73fe9d6d42f39a503c25650e9fd4';
  assert.equal(decryptApiKey(stored), 'AIzaSyPreChangeVector-0123456789abcdef');
});
