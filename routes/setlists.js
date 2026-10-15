const express = require('express');
const { requireAuth, optionalAuth } = require('../lib/auth');
const { STATUS, LIMITS } = require('../lib/constants');
const { validateListQuery, validateObjectBody, parseId, requireId, assertValid, validateSetlistInput, validateTargetKey, canonicalTargetKey, validateNashville, validateContentOverride, setlistListOptions } = require('../lib/validation');
const { AppError, requireFound, requireChanged } = require('../lib/errors');
const Setlist = require('../lib/models/setlist');
const Song = require('../lib/models/song');
const { maskSetlistEntry, canViewSongVisibility } = require('../lib/songAccess');
const { normalizeVisibility } = require('../shared/access.mjs');

const requireSetlistId = raw => requireId(raw, 'Invalid setlist ID');

function resolveSetlist(setlistId, userId) {
  return requireFound(Setlist.findById(setlistId, userId), 'Setlist not found');
}

const findOwnSetlist = (rawId, user) => resolveSetlist(requireSetlistId(rawId), user.id);

const withEntries = (setlist, user) => ({ ...setlist, entries: Setlist.getEntries(setlist.id).map(entry => maskSetlistEntry(entry, user)) });

const storedTargetKey = key => (key == null ? null : canonicalTargetKey(key));

function createSetlistsRouter() {
  const router = express.Router();
  router.use(validateObjectBody);

  router.get('/setlists', requireAuth, validateListQuery, (req, res) => {
    res.json(Setlist.listForUser(req.user.id, setlistListOptions(req.query)));
  });

  router.post('/setlists', requireAuth, (req, res) => {
    const { name, visibility, event_date } = req.body;
    assertValid(validateSetlistInput(name, event_date, visibility));
    const vis = normalizeVisibility(visibility);
    const result = Setlist.create(req.user.id, name.trim(), vis, event_date || null);
    res.json({ id: result.lastInsertRowid, name: name.trim() });
  });

  router.get('/setlists/public', validateListQuery, (req, res) => {
    res.json(Setlist.listPublic(setlistListOptions(req.query)));
  });

  router.get('/setlists/public/:id', optionalAuth, (req, res) => {
    res.json(withEntries(requireFound(Setlist.findPublicById(requireSetlistId(req.params.id)), 'Setlist not found'), req.user));
  });

  router.get('/setlists/:id', requireAuth, (req, res) => {
    res.json(withEntries(findOwnSetlist(req.params.id, req.user), req.user));
  });

  router.put('/setlists/:id', requireAuth, (req, res) => {
    const id = requireSetlistId(req.params.id);
    const { name, visibility, event_date } = req.body;
    assertValid(validateSetlistInput(name, event_date, visibility));
    requireChanged(Setlist.update(id, req.user.id, name.trim(), normalizeVisibility(visibility), event_date || null), 'Setlist not found');
    res.json({ success: true });
  });

  router.delete('/setlists/:id', requireAuth, (req, res) => {
    const id = requireSetlistId(req.params.id);
    requireChanged(Setlist.delete(id, req.user.id), 'Setlist not found');
    res.json({ success: true });
  });

  router.post('/setlists/:id/songs', requireAuth, (req, res) => {
    const { id } = findOwnSetlist(req.params.id, req.user);
    const { song_id, target_key, nashville } = req.body;
    if (!song_id) throw new AppError('song_id is required', 400);
    const songIdParsed = requireId(song_id, 'Invalid song_id');
    assertValid(validateTargetKey(target_key));
    assertValid(validateNashville(nashville));
    const song = requireFound(Song.findById(songIdParsed), 'Song not found');
    if (song.status === STATUS.PENDING) throw new AppError('Cannot add a pending correction to a setlist', 400);
    if (!canViewSongVisibility(req.user, song)) throw new AppError('Cannot add a private song you don\'t own', 403);
    const result = Setlist.addSongEntry(id, songIdParsed, { targetKey: storedTargetKey(target_key), nashville });
    res.json({ entry_id: result.entry_id, position: result.position });
  });

  router.put('/setlists/:setlistId/entries/:entryId', requireAuth, (req, res) => {
    const setlistId = requireSetlistId(req.params.setlistId);
    const entryId = requireId(req.params.entryId, 'Invalid entry ID');
    resolveSetlist(setlistId, req.user.id);
    const { target_key, nashville, content_override } = req.body;
    assertValid(validateTargetKey(target_key));
    assertValid(validateNashville(nashville));
    assertValid(validateContentOverride(content_override));
    requireChanged(Setlist.updateSongEntry(entryId, setlistId, {
      targetKey: storedTargetKey(target_key),
      targetKeyProvided: 'target_key' in req.body,
      nashville,
      contentOverride: content_override,
    }), 'Entry not found');
    res.json({ success: true });
  });

  router.delete('/setlists/:setlistId/entries/:entryId', requireAuth, (req, res) => {
    const setlistId = requireSetlistId(req.params.setlistId);
    const entryId = requireId(req.params.entryId, 'Invalid entry ID');
    resolveSetlist(setlistId, req.user.id);
    requireChanged(Setlist.deleteSongEntry(entryId, setlistId), 'Entry not found');
    res.json({ success: true });
  });

  router.put('/setlists/:id/reorder', requireAuth, (req, res) => {
    const { id } = findOwnSetlist(req.params.id, req.user);
    const { entry_ids } = req.body;
    if (!Array.isArray(entry_ids)) throw new AppError('entry_ids array is required', 400);
    if (entry_ids.length > LIMITS.MAX_REORDER) throw new AppError('Too many entries', 400);
    const parsedIds = entry_ids.map(e => parseId(e));
    if (parsedIds.some(e => e === null)) throw new AppError('All entry_ids must be valid integers', 400);
    if (new Set(parsedIds).size !== parsedIds.length) throw new AppError('Duplicate entry_ids are not allowed', 400);
    const entries = Setlist.getEntries(id);
    if (parsedIds.length !== entries.length) throw new AppError('entry_ids count must match the number of entries in the setlist', 400);
    const entryIds = new Set(entries.map(e => e.entry_id));
    if (parsedIds.some(e => !entryIds.has(e))) throw new AppError('entry_ids must be the entries of this setlist', 400);
    Setlist.reorderEntries(id, parsedIds);
    res.json({ success: true });
  });

  return router;
}

module.exports = { createSetlistsRouter };
