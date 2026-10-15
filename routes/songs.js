const express = require('express');
const yazl = require('yazl');
const { requireAuth, requireAdmin, optionalAuth, isAdminRole, canManageSong } = require('../lib/auth');
const { STATUS, VISIBILITY, LIMITS } = require('../lib/constants');
const { validateListQuery, validateObjectBody, requireId, assertValid, validateSongInput, validateVisibility, validateSongMetadata, parsePaginationParams } = require('../lib/validation');
const { AppError, requireFound } = require('../lib/errors');
const { DEMO_MODE } = require('../lib/demo');
const { makeUniqueNamer } = require('../lib/exportFilename');
const Song = require('../lib/models/song');
const User = require('../lib/models/user');
const Tags = require('../lib/models/tags');
const { canViewSongVisibility } = require('../lib/songAccess');
const { splitTags } = require('../shared/tags.mjs');

function extractDirective(content, name) {
  const re = new RegExp(`\\{${name}:\\s*([^}]*)\\}`, 'i');
  const m = content.match(re);
  return m ? m[1].trim() : null;
}

function extractMetadata(content) {
  const cleanedTags = splitTags(extractDirective(content, 'x_tags')).join(',') || null;
  const bpmStr = extractDirective(content, 'tempo');
  const bpm = bpmStr ? parseInt(bpmStr, 10) : null;
  return {
    title: extractDirective(content, 'title') || '',
    artist: extractDirective(content, 'artist') || '',
    key: extractDirective(content, 'key') || '',
    bpm: (bpm && bpm >= 1 && bpm <= 300) ? bpm : null,
    youtube_url: extractDirective(content, 'x_youtube') || null,
    tags: cleanedTags,
    language: extractDirective(content, 'x_language') || '',
  };
}

function requireSongMetadata(content) {
  const meta = extractMetadata(content);
  assertValid(validateSongMetadata(meta));
  return meta;
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
  if (original.user_id !== req.user.id && !isAdminRole(req.user.role)) {
    throw new AppError('Only the song owner or admins can manage corrections', 403);
  }
  return { correction, original, originalId };
}

function createSongsRouter() {
  const router = express.Router();
  router.use(validateObjectBody);

  router.get('/songs', requireAuth, validateListQuery, (req, res) => {
    const { q, language, page, limit } = req.query;
    const userId = req.user.id;
    const { page: pageNum, limit: limitNum } = parsePaginationParams(page, limit);
    res.json(Song.listForUser(userId, { q, language, page: pageNum, limit: limitNum }));
  });

  router.get('/songs/public', optionalAuth, validateListQuery, (req, res) => {
    const { q, language, page, limit } = req.query;
    const userId = req.user ? req.user.id : 0;
    const { page: pageNum, limit: limitNum } = parsePaginationParams(page, limit);
    res.json(Song.listPublic({ q, language, userId, page: pageNum, limit: limitNum }));
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
    const { page, limit } = req.query;
    const { page: pageNum, limit: limitNum } = parsePaginationParams(page, limit);
    const songs = Song.listByUser(user.id, { page: pageNum, limit: limitNum });
    res.json(songs);
  });

  router.get('/tags', (_req, res) => res.json({ tags: Tags.getTags() }));

  router.get('/songs/:id', optionalAuth, (req, res) => {
    const song = findSong(req.params.id);
    if (song.status === STATUS.PENDING) {
      const isSubmitter = req.user && req.user.id === song.user_id;
      const isOriginalOwner = req.user && song.parent_id && Song.findById(song.parent_id)?.user_id === req.user.id;
      const isAdmin = req.user && isAdminRole(req.user.role);
      if (!isSubmitter && !isOriginalOwner && !isAdmin) throw new AppError('Song not found', 404);
    }
    if (!canViewSongVisibility(req.user, song)) throw new AppError('Song not found', 404);
    // Include version_count for single song view
    const userId = req.user ? req.user.id : 0;
    const versionCount = Song.getVersionCount(song.parent_id, song.id, userId);
    res.json({ ...song, version_count: versionCount });
  });

  router.post('/songs', requireAuth, (req, res) => {
    const { content, format_detected, visibility } = req.body;
    assertValid(validateSongInput({ content, format_detected, requireContent: true, requireChord: true }));
    const meta = requireSongMetadata(content);
    assertValid(validateVisibility(visibility));

    const fmt = format_detected?.trim() || null;
    const finalVisibility = visibility === VISIBILITY.PRIVATE ? VISIBILITY.PRIVATE : VISIBILITY.PUBLIC;
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
      const inputError = !s || typeof s !== 'object' || Array.isArray(s) ? 'Song must be an object'
        : validateSongInput({ content: s.content, requireContent: true });
      if (inputError) { errors.push({ index: i, error: inputError }); return; }
      const meta = extractMetadata(s.content);
      const metaError = validateSongMetadata(meta);
      if (metaError) { errors.push({ index: i, error: metaError }); return; }
      const visError = validateVisibility(s.visibility);
      if (visError) { errors.push({ index: i, error: visError }); return; }
      valid.push({
        index: i,
        ...meta,
        content: s.content.trim(),
        visibility: s.visibility === VISIBILITY.PRIVATE ? VISIBILITY.PRIVATE : VISIBILITY.PUBLIC,
      });
    });

    try {
      const { imported, skipped } = Song.importSongs(req.user.id, valid);
      res.json({ imported, skipped, errors });
    } catch (e) {
      console.error('Import failed:', e.message);
      res.status(500).json({ error: 'Import failed. Please check your data and try again.' });
    }
  });

  router.put('/songs/:id', requireAuth, (req, res) => {
    const id = requireId(req.params.id, 'Invalid song ID');
    const existing = Song.findById(id);
    if (!existing || !canManageSong(req.user, existing.user_id)) throw new AppError('Song not found or not yours', 404);
    const { content, format_detected, visibility } = req.body;
    assertValid(validateSongInput({ content, format_detected, requireChord: true }));
    const finalContent = content?.trim() || existing.content;
    const meta = requireSongMetadata(finalContent);
    assertValid(validateVisibility(visibility));

    const fmt = format_detected !== undefined ? (format_detected?.trim() || null) : existing.format_detected;
    const finalVisibility = visibility !== undefined ? (visibility === VISIBILITY.PRIVATE ? VISIBILITY.PRIVATE : VISIBILITY.PUBLIC) : existing.visibility;
    Song.update(id, meta, finalContent, finalVisibility, fmt);
    res.json({ success: true });
  });

  router.delete('/songs/:id', requireAuth, (req, res) => {
    const id = requireId(req.params.id, 'Invalid song ID');
    const isAdmin = isAdminRole(req.user.role);
    const result = Song.delete(id, isAdmin ? null : req.user.id);
    if (!result.changes) throw new AppError('Song not found or not yours', 404);
    res.json({ success: true });
  });

  router.post('/songs/:id/version', requireAuth, (req, res) => {
    const original = findSong(req.params.id);
    if (original.status !== STATUS.ACTIVE) throw new AppError('Song not found', 404);

    const isOwner = original.user_id === req.user.id;
    const isAdmin = isAdminRole(req.user.role);
    const isPublic = original.visibility === VISIBILITY.PUBLIC;
    if (!isOwner && !isAdmin && !isPublic) throw new AppError('Not authorized', 403);

    const { content, youtube_url } = req.body;
    assertValid(validateSongInput({ content, youtube_url, requireContent: true, requireChord: true }));

    const parentId = original.parent_id || original.id;
    const meta = requireSongMetadata(content);
    const result = Song.createVersion(req.user.id, parentId, meta, content, original.visibility);
    res.json({ id: result.lastInsertRowid });
  });

  router.get('/songs/:id/versions', optionalAuth, (req, res) => {
    const song = findSong(req.params.id);
    if (song.status !== STATUS.ACTIVE || !canViewSongVisibility(req.user, song)) throw new AppError('Song not found', 404);
    const rootId = song.parent_id || song.id;
    const userId = req.user ? req.user.id : 0;
    const versions = Song.getVersions(rootId, userId);
    res.json(versions);
  });

  router.post('/songs/:id/correction', requireAuth, (req, res) => {
    const original = findSong(req.params.id);
    if (original.status === STATUS.PENDING) throw new AppError('Cannot correct a pending correction', 400);
    if (original.visibility === VISIBILITY.PRIVATE && req.user.id !== original.user_id) throw new AppError('Cannot submit corrections on private songs', 403);
    const { content, youtube_url } = req.body;
    const validationError = validateSongInput({ content, youtube_url, requireContent: true, requireChord: true });
    if (validationError) throw new AppError(validationError.replace('before saving', 'before submitting'), 400);

    const parentId = original.parent_id || original.id;
    const meta = requireSongMetadata(content);
    const result = Song.createCorrection(req.user.id, parentId, meta, content);
    res.json({ id: result.lastInsertRowid });
  });

  router.get('/songs/:id/corrections', requireAuth, (req, res) => {
    const song = findSong(req.params.id);
    const isOwner = song.user_id === req.user.id;
    if (!isOwner && !isAdminRole(req.user.role)) throw new AppError('Only the song owner or admins can view corrections', 403);
    const rootId = song.parent_id || song.id;
    const corrections = Song.getCorrections(rootId);
    res.json(corrections);
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
