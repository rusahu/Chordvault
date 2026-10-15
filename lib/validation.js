const { AppError } = require('./errors');
const { LIMITS, VISIBILITY } = require('./constants');
const { CANONICAL_KEYS, normalizeKey } = require('./enharmonic');
const { LANGUAGE_CODES } = require('./languages');
const { cleanTagName, splitTags, tagNameError } = require('../shared/tags.mjs');

function parseId(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function requireId(value, message) {
  const id = parseId(value);
  if (!id) throw new AppError(message, 400);
  return id;
}

function assertValid(error) {
  if (error) throw new AppError(error, 400);
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateStringFields(fields) {
  for (const [name, value] of Object.entries(fields)) {
    if (value != null && typeof value !== 'string') return `${name} must be a string`;
  }
  return null;
}

function validateListQuery(req, res, next) {
  const { q, language, date_from, date_to, tags } = req.query;
  const error = validateStringFields({ q, language, date_from, date_to, tags })
    || (splitTags(tags).length > LIMITS.MAX_TAGS ? `Maximum ${LIMITS.MAX_TAGS} tags` : null);
  if (error) return res.status(400).json({ error });
  next();
}

function validateObjectBody(req, res, next) {
  if (req.body != null && (typeof req.body !== 'object' || Array.isArray(req.body))) {
    return res.status(400).json({ error: 'Request body must be an object' });
  }
  req.body ??= {};
  next();
}

function validateUserCredentials(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) return 'Username and password required';
  if (username.trim().length < LIMITS.USERNAME_MIN || username.trim().length > LIMITS.USERNAME_MAX) return `Username must be ${LIMITS.USERNAME_MIN}-${LIMITS.USERNAME_MAX} characters`;
  return validatePassword(password);
}

function validatePassword(password, label = 'Password') {
  if (typeof password !== 'string' || password.length < LIMITS.PASSWORD_MIN) return `${label} must be at least ${LIMITS.PASSWORD_MIN} characters`;
  if (password.length > LIMITS.PASSWORD_MAX) return `${label} must be at most ${LIMITS.PASSWORD_MAX} characters`;
  return null;
}

function validateSongInput({ title, content, youtube_url, bpm, format_detected, requireTitle = false, requireContent = false, requireChord = false }) {
  const typeError = validateStringFields({ title, content, youtube_url, format_detected });
  if (typeError) return typeError;
  if (requireTitle && !title?.trim()) return 'Title and content are required';
  if (requireContent && !content?.trim()) return 'Title and content are required';
  if (title && title.trim().length > LIMITS.MAX_TITLE) return `Title too long (max ${LIMITS.MAX_TITLE} characters)`;
  if (content && content.length > LIMITS.MAX_CONTENT) return `Song content too large (max ${LIMITS.MAX_CONTENT / 1000}KB)`;
  if (requireChord && content && !/\[[A-G][^\]]*\]/.test(content)) return 'No chords detected. Add chords (e.g. [C], [G]) before saving.';
  if (youtube_url && youtube_url.length > LIMITS.MAX_YOUTUBE_URL) return 'YouTube URL too long';
  if (youtube_url && !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i.test(youtube_url)) {
    return 'YouTube URL must be a valid youtube.com or youtu.be link';
  }
  if (bpm !== undefined && bpm !== null && (!['number', 'string'].includes(typeof bpm) || isNaN(Number(bpm)) || Number(bpm) < LIMITS.MIN_BPM || Number(bpm) > LIMITS.MAX_BPM)) return `BPM must be between ${LIMITS.MIN_BPM} and ${LIMITS.MAX_BPM}`;
  return null;
}

function validateVisibility(visibility) {
  if (visibility !== undefined && !Object.values(VISIBILITY).includes(visibility)) {
    return 'Visibility must be "public" or "private"';
  }
  return null;
}

function validateSetlistInput(name, event_date) {
  if (typeof name !== 'string' || !name.trim()) return 'Name is required';
  if (name.trim().length > LIMITS.MAX_SETLIST_NAME) return `Name too long (max ${LIMITS.MAX_SETLIST_NAME} characters)`;
  if (event_date != null && event_date !== '' && !isValidDate(event_date)) return 'Invalid date (use YYYY-MM-DD)';
  return null;
}

const CANONICAL_KEY_SET = new Set(CANONICAL_KEYS);

/**
 * The canonical spelling a target key is stored as: trimmed, with awkward
 * enharmonics resolved to the name the key picker and stepKey use. Storing
 * anything else leaves the sharp/flat buttons dead on that entry.
 */
function canonicalTargetKey(key) {
  return normalizeKey(String(key).trim());
}

/**
 * Accepts only the key names the renderer can actually use.
 *
 * Key.parse is far looser — it takes numerals ('1'), solfege ('Do') and
 * lowercase ('a'), none of which the UI can produce. Those persisted fine and
 * then threw inside Key.distance at render time, where getTransposeDelta
 * swallows the error and renders the song as written with live-looking but
 * dead key buttons.
 */
function validateTargetKey(key) {
  if (key === undefined || key === null) return null;
  if (typeof key !== 'string') return 'Target key must be a string or null';
  const trimmed = key.trim();
  if (!trimmed) return 'Target key cannot be empty (use null for as-written)';
  if (trimmed.length > 8) return 'Target key is too long';
  if (!CANONICAL_KEY_SET.has(canonicalTargetKey(trimmed))) return `Invalid key: ${trimmed}`;
  return null;
}

function validateLanguage(code) {
  if (!code || typeof code !== 'string') return 'Language is required';
  if (!LANGUAGE_CODES.has(code)) return 'Invalid language code';
  return null;
}

function validateSongMetadata({ title, language }) {
  if (!title) return 'Title is required. Add {title: Song Name} to your content.';
  return language ? validateLanguage(language) : null;
}

const validateBoolean = (value, name) => (typeof value === 'boolean' ? null : `${name} must be a boolean`);

function validateTagList(value) {
  if (!Array.isArray(value) || value.some(name => typeof name !== 'string')) return { tags: [], error: 'Tags must be a list of names' };
  if (value.length > LIMITS.MAX_TAGS) return { tags: [], error: `Maximum ${LIMITS.MAX_TAGS} tags` };
  const tags = value.map(cleanTagName);
  for (const [i, name] of tags.entries()) {
    const error = tagNameError(name, tags.slice(0, i), LIMITS.MAX_TAG_LENGTH);
    if (error) return { tags: [], error };
  }
  return { tags, error: null };
}

function validatePreferredLanguages(languages) {
  if (!Array.isArray(languages)) return 'Languages must be an array';
  if (languages.length > LIMITS.MAX_PREFERRED_LANGUAGES) return `Maximum ${LIMITS.MAX_PREFERRED_LANGUAGES} preferred languages`;
  for (const code of languages) {
    if (typeof code !== 'string') return 'Language codes must be strings';
    if (!LANGUAGE_CODES.has(code)) return `Invalid language code: ${code}`;
  }
  return null;
}

function validateGeminiApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return 'API key is required';
  if (
    apiKey.length < LIMITS.GEMINI_KEY_MIN ||
    apiKey.length > LIMITS.GEMINI_KEY_MAX ||
    /\s/.test(apiKey)
  ) {
    return 'Invalid Gemini API key format';
  }
  return null;
}

function validateOcrPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) return 'Prompt is required';
  if (prompt.length > LIMITS.MAX_OCR_PROMPT) return `Prompt must be under ${LIMITS.MAX_OCR_PROMPT} characters`;
  return null;
}

const isOversizedImage = image => (image.length * 3) / 4 > LIMITS.MAX_OCR_IMAGE;

function validateOcrImage(image) {
  if (!image || typeof image !== 'string') return 'Base64 image is required';
  if (isOversizedImage(image)) return 'File too large (max 18MB)';
  return null;
}

function validateRefineInput({ image, history, message }) {
  if (typeof image !== 'string' || !image || typeof message !== 'string' || !message || !Array.isArray(history)) {
    return 'image, history, and message are required';
  }
  if (isOversizedImage(image)) return 'Image too large (max 18MB)';
  if (history.some(item => !item || !['user', 'model'].includes(item.role) || typeof item.text !== 'string')) {
    return 'History entries require a user/model role and string text';
  }
  if (message.length > LIMITS.MAX_REFINE_MESSAGE) return `Message too long (max ${LIMITS.MAX_REFINE_MESSAGE} chars)`;
  if (history.length > LIMITS.MAX_REFINE_TURNS) return 'Conversation too long. Start a new extraction.';
  return null;
}

function parsePaginationParams(page, limit) {
  if (page === undefined && limit === undefined) {
    return { page: null, limit: null };
  }
  const pageNum = page === undefined ? 1 : parseId(page);
  const limitNum = limit === undefined ? 20 : parseId(limit);
  if (pageNum === null || limitNum === null || !Number.isSafeInteger((pageNum - 1) * limitNum)) {
    throw new AppError('Page and limit must be positive safe integers', 400);
  }
  return { page: pageNum, limit: limitNum };
}

function validateNashville(value) {
  return value === undefined || typeof value === 'boolean' || value === 0 || value === 1 ? null : 'Nashville must be a boolean';
}

function setlistListOptions({ q, date_from, date_to, page, limit }) {
  return { q, dateFrom: date_from, dateTo: date_to, ...parsePaginationParams(page, limit) };
}

function songListOptions({ q, language, tags, page, limit }) {
  return { q, language, tags: splitTags(tags), ...parsePaginationParams(page, limit) };
}

module.exports = {
  validateStringFields,
  validateListQuery,
  validateObjectBody,
  parseId,
  requireId,
  assertValid,
  isValidDate,
  validateUserCredentials,
  validatePassword,
  validateSongInput,
  validateVisibility,
  validateSongMetadata,
  validateBoolean,
  validateTagList,
  validateSetlistInput,
  validateTargetKey,
  validateNashville,
  setlistListOptions,
  canonicalTargetKey,
  validateLanguage,
  validatePreferredLanguages,
  validateGeminiApiKey,
  validateOcrPrompt,
  validateOcrImage,
  validateRefineInput,
  parsePaginationParams,
  songListOptions,
};
