const crypto = require('crypto');
const User = require('./models/user');
const { AppError } = require('./errors');
const { resolveGeminiModel } = require('./constants');

let encKey;

/** Derives the 256-bit AES key from JWT_SECRET once; PBKDF2 at 100k rounds blocks the event loop. */
function deriveEncKey() {
  encKey ??= crypto.pbkdf2Sync(process.env.JWT_SECRET, 'chordvault-gemini-enc', 100_000, 32, 'sha256');
  return encKey;
}

/** AES-256-GCM with a random IV, stored as `ivHex:tagHex:encHex`. */
function encryptApiKey(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveEncKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}

/** Throws if the stored value was tampered with or JWT_SECRET changed. */
function decryptApiKey(stored) {
  const [ivHex, tagHex, encHex] = stored.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveEncKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(encHex, 'hex', 'utf8') + decipher.final('utf8');
}

/** The user's Gemini key and the model to call: the requested one, else their saved one, else the default. */
function loadGeminiCredentials(userId, requestModel) {
  const user = User.getFullById(userId);
  if (!user?.gemini_api_key) throw new AppError('No Gemini API key configured. Add one in Settings.', 400);
  try {
    return { user, apiKey: decryptApiKey(user.gemini_api_key), model: resolveGeminiModel(requestModel, user.gemini_model) };
  } catch {
    throw new AppError('Failed to decrypt API key. Try re-saving it in Settings.', 500);
  }
}

module.exports = { encryptApiKey, decryptApiKey, loadGeminiCredentials };
