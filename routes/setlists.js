const express = require('express');
const { requireAuth, optionalAuth } = require('../lib/auth');
const { STATUS, VISIBILITY, LIMITS } = require('../lib/constants');
const { validateListQuery, validateObjectBody, parseId, requireId, assertValid, validateSetlistInput, validateTargetKey, canonicalTargetKey, parsePaginationParams } = require('../lib/validation');
const { AppError, requireFound } = require('../lib/errors');
const Setlist = require('../lib/models/setlist');
const Song = require('../lib/models/song');
const { maskSetlistEntry } = require('../lib/songAccess');
const { normalizeVisibility } = require('../shared/access.mjs');

const requireSetlistId = raw => requireId(raw, 'Invalid setlist ID');

function resolveSetlist(setlistId, userId) {
  return requireFound(Setlist.findById(setlistId, userId), 'Setlist not found');
}

function createSetlistsRouter() {
  const router = express.Router();
  router.use(validateObjectBody);

  router.get('/setlists', requireAuth, validateListQuery, (req, res) => {
    const { q, date_from, date_to, page, limit } = req.query;
    const { page: pageNum, limit: limitNum } = parsePaginationParams(page, limit);
    res.json(Setlist.listForUser(req.user.id, { q, dateFrom: date_from, dateTo: date_to, page: pageNum, limit: limitNum }));
  });

  router.post('/setlists', requireAuth, (req, res) => {
    const { name, visibility, event_date } = req.body;
    assertValid(validateSetlistInput(name, event_date));
    const vis = normalizeVisibility(visibility);
    const result = Setlist.create(req.user.id, name.trim(), vis, event_date || null);
    res.json({ id: result.lastInsertRowid, name: name.trim() });
  });

  router.get('/setlists/public', validateListQuery, (req, res) => {
    const { q, date_from, date_to, page, limit } = req.query;
    const { page: pageNum, limit: limitNum } = parsePaginationParams(page, limit);
    res.json(Setlist.listPublic({ q, dateFrom: date_from, dateTo: date_to, page: pageNum, limit: limitNum }));
  });

  router.get('/setlists/public/:id', optionalAuth, (req, res) => {
    const id = requireSetlistId(req.params.id);
    const setlist = requireFound(Setlist.findPublicById(id), 'Setlist not found');
    const entries = Setlist.getEntries(id);
    const safeEntries = entries.map(entry => maskSetlistEntry(entry, req.user));
    res.json({ ...setlist, entries: safeEntries });
  });

  router.get('/setlists/:id', requireAuth, (req, res) => {
    const id = requireSetlistId(req.params.id);
    const setlist = resolveSetlist(id, req.user.id);
    const entries = Setlist.getEntries(id);
    const safeEntries = entries.map(entry => maskSetlistEntry(entry, req.user));
    res.json({ ...setlist, entries: safeEntries });
  });

  router.put('/setlists/:id', requireAuth, (req, res) => {
    const id = requireSetlistId(req.params.id);
    const { name, visibility, event_date } = req.body;
    assertValid(validateSetlistInput(name, event_date));
    const vis = normalizeVisibility(visibility);
    const result = Setlist.update(id, req.user.id, name.trim(), vis, event_date !== undefined ? (event_date || null) : null);
    if (!result.changes) throw new AppError('Setlist not found', 404);
    res.json({ success: true });
  });

  router.delete('/setlists/:id', requireAuth, (req, res) => {
    const id = requireSetlistId(req.params.id);
    const result = Setlist.delete(id, req.user.id);
    if (!result.changes) throw new AppError('Setlist not found', 404);
    res.json({ success: true });
  });

  router.post('/setlists/:id/songs', requireAuth, (req, res) => {
    const id = requireSetlistId(req.params.id);
    resolveSetlist(id, req.user.id);
    const { song_id, target_key, nashville } = req.body;
    if (!song_id) throw new AppError('song_id is required', 400);
    const songIdParsed = requireId(song_id, 'Invalid song_id');
    assertValid(validateTargetKey(target_key));
    if (nashville !== undefined && typeof nashville !== 'boolean' && nashville !== 0 && nashville !== 1) {
      throw new AppError('Nashville must be a boolean', 400);
    }
    const song = requireFound(Song.findById(songIdParsed), 'Song not found');
    if (song.status === STATUS.PENDING) throw new AppError('Cannot add a pending correction to a setlist', 400);
    if (song.user_id !== req.user.id && song.visibility !== VISIBILITY.PUBLIC) {
      throw new AppError('Cannot add a private song you don\'t own', 403);
    }
    const result = Setlist.addSongEntry(id, songIdParsed, { targetKey: target_key == null ? null : canonicalTargetKey(target_key), nashville });
    res.json({ entry_id: result.entry_id, position: result.position });
  });

  router.put('/setlists/:setlistId/entries/:entryId', requireAuth, (req, res) => {
    const setlistId = requireSetlistId(req.params.setlistId);
    const entryId = requireId(req.params.entryId, 'Invalid entry ID');
    resolveSetlist(setlistId, req.user.id);
    const entry = requireFound(Setlist.getEntryById(entryId, setlistId), 'Entry not found');
    const { target_key, nashville, font, two_col, content_override } = req.body;
    assertValid(validateTargetKey(target_key));
    if (nashville !== undefined && typeof nashville !== 'boolean' && nashville !== 0 && nashville !== 1) {
      throw new AppError('Nashville must be a boolean', 400);
    }
    if (content_override != null && typeof content_override !== 'string') throw new AppError('Content override must be a string or null', 400);
    if (content_override !== undefined && content_override !== null && content_override.length > LIMITS.MAX_CONTENT) {
      throw new AppError(`Content override too large (max ${LIMITS.MAX_CONTENT / 1000}KB)`, 400);
    }
    Setlist.updateSongEntry(entryId, setlistId, entry, {
      targetKey: target_key == null ? null : canonicalTargetKey(target_key),
      targetKeyProvided: 'target_key' in req.body,
      nashville,
      font,
      twoCol: two_col,
      contentOverride: content_override
    });
    res.json({ success: true });
  });

  router.delete('/setlists/:setlistId/entries/:entryId', requireAuth, (req, res) => {
    const setlistId = requireSetlistId(req.params.setlistId);
    const entryId = requireId(req.params.entryId, 'Invalid entry ID');
    resolveSetlist(setlistId, req.user.id);
    const result = Setlist.deleteSongEntry(entryId, setlistId);
    if (!result.changes) throw new AppError('Entry not found', 404);
    res.json({ success: true });
  });

  router.put('/setlists/:id/reorder', requireAuth, (req, res) => {
    const id = requireSetlistId(req.params.id);
    resolveSetlist(id, req.user.id);
    const { entry_ids } = req.body;
    if (!Array.isArray(entry_ids)) throw new AppError('entry_ids array is required', 400);
    if (entry_ids.length > LIMITS.MAX_REORDER) throw new AppError('Too many entries', 400);
    const parsedIds = entry_ids.map(e => parseId(e));
    if (parsedIds.some(e => e === null)) throw new AppError('All entry_ids must be valid integers', 400);
    if (new Set(parsedIds).size !== parsedIds.length) throw new AppError('Duplicate entry_ids are not allowed', 400);
    const entries = Setlist.getEntries(id);
    if (parsedIds.length !== entries.length) throw new AppError('entry_ids count must match the number of entries in the setlist', 400);
    Setlist.reorderEntries(id, parsedIds);
    res.json({ success: true });
  });

  return router;
}

module.exports = { createSetlistsRouter };
