const express = require('express');
const yazl = require('yazl');
const { requireAuth, requireAdmin, optionalAuth, isAdminRole, canManageSong, viewerId } = require('../lib/auth');
const { STATUS, LIMITS } = require('../lib/constants');
const { validateListQuery, validateObjectBody, requireId, assertValid, validateSongInput, validateVisibility, validateSongMetadata, parsePaginationParams, songListOptions } = require('../lib/validation');
const { AppError, requireFound, requireChanged } = require('../lib/errors');
const { DEMO_MODE } = require('../lib/demo');
const { makeUniqueNamer } = require('../lib/exportFilename');
const Song = require('../lib/models/song');
const User = require('../lib/models/user');
const Tags = require('../lib/models/tags');
const { canViewSongVisibility, familyRootId } = require('../lib/songAccess');
const { splitTags } = require('../shared/tags.mjs');
const { normalizeVisibility } = require('../shared/access.mjs');
const { extractDirective, parseBpm } = require('../shared/chordpro.mjs');

function extractMetadata(content) {
  const cleanedTags = splitTags(extractDirective(content, 'x_tags')).join(',') || null;
  return {
    title: extractDirective(content, 'title') || '',
    artist: extractDirective(content, 'artist') || '',
    key: extractDirective(content, 'key') || '',
    bpm: parseBpm(extractDirective(content, 'tempo'), LIMITS.MIN_BPM, LIMITS.MAX_BPM),
    youtube_url: extractDirective(content, 'x_youtube') || null,
    tags: cleanedTags,
    language: extractDirective(content, 'x_language') || '',
  };
}

/** Every song save: the submitted text, then the metadata stored from the saved text (an edit without text keeps the stored text). */
function checkSongSave({ content, format_detected }, { fallbackContent = null } = {}) {
  const error = validateSongInput({ content, format_detected, requireContent: fallbackContent === null });
  if (error) return { error };
  const saved = fallbackContent === null ? content : content?.trim() || fallbackContent;
  const meta = extractMetadata(saved);
  const metaError = validateSongMetadata(meta);
  return metaError ? { error: metaError } : { meta, content: saved };
}

function requireSongSave(body, options) {
  const { error, ...saved } = checkSongSave(body, options);
  assertValid(error);
  return saved;
}

function assertManagesCorrections(user, ownerId, action) {
  if (!canManageSong(user, ownerId)) throw new AppError(`Only the song owner or admins can ${action} corrections`, 403);
}

function findSong(rawId) {
  return requireFound(Song.findById(requireId(rawId, 'Invalid song ID')), 'Song not found');
}

function resolveCorrectionWithAuth(req) {
  const correction = Song.findById(requireId(req.params.id, 'Invalid correction ID'));
  if (correction?.status !== STATUS.PENDING) throw new AppError('Pending correction not found', 404);
  const originalId = correction.parent_id;
  if (!originalId) throw new AppError('Correction has no parent song', 400);
  const original = requireFound(Song.findById(originalId), 'Original song not found');
  assertManagesCorrections(req.user, original.user_id, 'manage');
  return { correction, original, originalId };
}

function createSongsRouter() {
  const router = express.Router();
  router.use(validateObjectBody);

  router.get('/songs', requireAuth, validateListQuery, (req, res) => {
    res.json(Song.listForUser(req.user.id, songListOptions(req.query)));
  });

  router.get('/songs/public', optionalAuth, validateListQuery, (req, res) => {
    res.json(Song.listPublic({ ...songListOptions(req.query), userId: viewerId(req) }));
  });

  router.get('/songs/export', requireAuth, (req, res) => {
    const isAdmin = isAdminRole(req.user.role);
    const date = new Date().toISOString().slice(0, 10);
    const zip = new yazl.ZipFile();
    res.attachment(`chordvault-export-${date}.zip`);
    zip.outputStream.on('error', (err) => {
      console.error('Export zip error:', err.message);
      res.destroy(err);
    });
    zip.outputStream.pipe(res);
    res.on('close', () => {
      if (!res.writableFinished) zip.outputStream.destroy();
    });
    const nameFor = makeUniqueNamer();
    for (const row of Song.iterateExportable(req.user.id, isAdmin)) {
      zip.addBuffer(Buffer.from(row.content, 'utf8'), nameFor(row.title, row.id));
    }
    zip.end();
  });

  router.get('/users/:username/songs', validateListQuery, (req, res) => {
    const user = requireFound(User.findByUsername(req.params.username), 'User not found');
    res.json(Song.listByUser(user.id, parsePaginationParams(req.query.page, req.query.limit)));
  });

  router.get('/tags', (_req, res) => res.json({ tags: Tags.getTags() }));

  router.get('/songs/:id', optionalAuth, (req, res) => {
    const song = findSong(req.params.id);
    if (song.status === STATUS.PENDING) {
      const isOriginalOwner = req.user && song.parent_id && Song.findById(song.parent_id)?.user_id === req.user.id;
      if (!canManageSong(req.user, song.user_id) && !isOriginalOwner) throw new AppError('Song not found', 404);
    }
    if (!canViewSongVisibility(req.user, song)) throw new AppError('Song not found', 404);
    // Include version_count for single song view
    const versionCount = Song.getVersionCount(song.parent_id, song.id, viewerId(req));
    res.json({ ...song, version_count: versionCount });
  });

  router.post('/songs', requireAuth, (req, res) => {
    const { content, format_detected, visibility } = req.body;
    const { meta } = requireSongSave(req.body);
    assertValid(validateVisibility(visibility));

    const fmt = format_detected?.trim() || null;
    const finalVisibility = normalizeVisibility(visibility);
    const result = Song.create(req.user.id, meta, content, finalVisibility, fmt);
    res.json({ id: result.lastInsertRowid });
  });

  router.post('/songs/import', requireAuth, requireAdmin, (req, res) => {
    const { songs } = req.body;
    if (!Array.isArray(songs)) throw new AppError('Request body must contain a "songs" array', 400);
    if (DEMO_MODE && songs.length > LIMITS.DEMO_MAX_IMPORT) throw new AppError(`Demo mode: import limited to ${LIMITS.DEMO_MAX_IMPORT} songs`, 400);
    if (songs.length > LIMITS.MAX_IMPORT) throw new AppError(`Maximum ${LIMITS.MAX_IMPORT} songs per import`, 400);

    const errors = [];
    const valid = [];

    songs.forEach((s, i) => {
      const { error, meta } = !s || typeof s !== 'object' || Array.isArray(s) ? { error: 'Song must be an object' } : checkSongSave({ content: s.content });
      if (error) { errors.push({ index: i, error }); return; }
      const visError = validateVisibility(s.visibility);
      if (visError) { errors.push({ index: i, error: visError }); return; }
      valid.push({
        index: i,
        ...meta,
        content: s.content.trim(),
        visibility: normalizeVisibility(s.visibility),
      });
    });

    let result;
    try {
      result = Song.importSongs(req.user.id, valid);
    } catch (e) {
      console.error('Import failed:', e.message);
      throw new AppError('Import failed. Please check your data and try again.', 500);
    }
    res.json({ imported: result.imported, skipped: result.skipped, errors });
  });

  router.put('/songs/:id', requireAuth, (req, res) => {
    const id = requireId(req.params.id, 'Invalid song ID');
    const existing = Song.findById(id);
    if (!existing || !canManageSong(req.user, existing.user_id)) throw new AppError('Song not found or not yours', 404);
    const { format_detected, visibility } = req.body;
    const { meta, content: finalContent } = requireSongSave(req.body, { fallbackContent: existing.content });
    assertValid(validateVisibility(visibility));

    const fmt = format_detected !== undefined ? (format_detected?.trim() || null) : existing.format_detected;
    const finalVisibility = visibility !== undefined ? normalizeVisibility(visibility) : existing.visibility;
    Song.update(id, meta, finalContent, finalVisibility, fmt);
    res.json({ success: true });
  });

  router.delete('/songs/:id', requireAuth, (req, res) => {
    const id = requireId(req.params.id, 'Invalid song ID');
    requireChanged(Song.delete(id, isAdminRole(req.user.role) ? null : req.user.id), 'Song not found or not yours');
    res.json({ success: true });
  });

  router.post('/songs/:id/version', requireAuth, (req, res) => {
    const original = findSong(req.params.id);
    if (original.status !== STATUS.ACTIVE) throw new AppError('Song not found', 404);

    if (!canViewSongVisibility(req.user, original)) throw new AppError('Not authorized', 403);

    const { content } = req.body;
    const { meta } = requireSongSave({ content });
    const parentId = familyRootId(original);
    const result = Song.createVersion(req.user.id, parentId, meta, content, original.visibility);
    res.json({ id: result.lastInsertRowid });
  });

  router.get('/songs/:id/versions', optionalAuth, (req, res) => {
    const song = findSong(req.params.id);
    if (song.status !== STATUS.ACTIVE || !canViewSongVisibility(req.user, song)) throw new AppError('Song not found', 404);
    res.json(Song.getVersions(familyRootId(song), viewerId(req)));
  });

  router.post('/songs/:id/correction', requireAuth, (req, res) => {
    const original = findSong(req.params.id);
    if (original.status === STATUS.PENDING) throw new AppError('Cannot correct a pending correction', 400);
    if (!canViewSongVisibility(req.user, original)) throw new AppError('Cannot submit corrections on private songs', 403);
    const { content } = req.body;
    const { meta } = requireSongSave({ content });
    const parentId = familyRootId(original);
    const result = Song.createCorrection(req.user.id, parentId, meta, content);
    res.json({ id: result.lastInsertRowid });
  });

  router.get('/songs/:id/corrections', requireAuth, (req, res) => {
    const song = findSong(req.params.id);
    assertManagesCorrections(req.user, song.user_id, 'view');
    res.json(Song.getCorrections(familyRootId(song)));
  });

  router.put('/corrections/:id/approve', requireAuth, (req, res) => {
    const { correction, originalId } = resolveCorrectionWithAuth(req);
    Song.approveCorrection(correction.id, originalId, correction.content);
    res.json({ success: true });
  });

  router.delete('/corrections/:id', requireAuth, (req, res) => {
    Song.deleteCorrection(resolveCorrectionWithAuth(req).correction.id);
    res.json({ success: true });
  });

  return router;
}

module.exports = { createSongsRouter };
