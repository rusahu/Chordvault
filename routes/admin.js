const express = require('express');
const crypto = require('crypto');
const { setSetting, isRegistrationAllowed } = require('../lib/db');
const User = require('../lib/models/user');
const Song = require('../lib/models/song');
const Invite = require('../lib/models/invite');
const { requireAuth, requireAdmin, hashPassword } = require('../lib/auth');
const { validateObjectBody, requireId, assertValid, validateUserCredentials, validatePassword } = require('../lib/validation');
const { AppError, handleDbError, requireFound } = require('../lib/errors');
const { ROLES } = require('../lib/constants');
const { blockInDemo } = require('../lib/demo');

function resolveAdminTarget(req) {
  const targetId = requireId(req.params.id, 'Invalid user ID');
  const target = requireFound(User.getFullById(targetId), 'User not found');
  if (target.role === ROLES.OWNER) throw new AppError('Cannot modify the owner', 403);
  if (target.role === ROLES.ADMIN && req.user.role !== ROLES.OWNER) throw new AppError('Only the owner can manage admins', 403);
  if (targetId === req.user.id) throw new AppError('Cannot modify yourself', 403);
  return { targetId, target };
}

function createAdminRouter() {
  const router = express.Router();
  router.use(validateObjectBody);

  router.get('/admin/stats', requireAuth, requireAdmin, (req, res) => {
    const userCount = User.count().count;
    const songCount = Song.count();
    const pendingCount = Song.countPending();
    const recentUsers = User.getRecent(5);
    const recentSongs = Song.getRecent(5);
    const noFormatCount = Song.countNoFormat();
    const languageDistribution = Song.getLanguageDistribution();
    res.json({ userCount, songCount, pendingCount, noFormatCount, languageDistribution, recentUsers, recentSongs });
  });

  router.get('/admin/users', requireAuth, requireAdmin, (req, res) => {
    const users = User.listWithSongCount();
    res.json(users);
  });

  router.put('/admin/users/:id/role', requireAuth, requireAdmin, blockInDemo, (req, res) => {
    const { role } = req.body;
    const resolved = resolveAdminTarget(req);

    if ((role === ROLES.ADMIN || resolved.target.role === ROLES.ADMIN) && req.user.role !== ROLES.OWNER) {
      throw new AppError('Only the owner can promote or demote admins', 403);
    }
    if (role !== ROLES.USER && role !== ROLES.ADMIN) throw new AppError('Role must be "user" or "admin"', 400);

    User.updateRole(resolved.targetId, role);
    res.json({ success: true });
  });

  router.put('/admin/users/:id/disabled', requireAuth, requireAdmin, blockInDemo, (req, res) => {
    const { disabled } = req.body;
    User.updateDisabled(resolveAdminTarget(req).targetId, disabled);
    res.json({ success: true });
  });

  router.put('/admin/users/:id/password', requireAuth, requireAdmin, blockInDemo, async (req, res) => {
    const { targetId } = resolveAdminTarget(req);
    const { password } = req.body;
    assertValid(validatePassword(password));

    const hash = await hashPassword(password);
    User.updatePassword(targetId, hash);
    res.json({ success: true });
  });

  router.post('/admin/users', requireAuth, requireAdmin, blockInDemo, async (req, res) => {
    const { username, password } = req.body;
    assertValid(validateUserCredentials(username, password));
    const hash = await hashPassword(password);
    try {
      const result = User.create(username.trim(), hash, ROLES.USER);
      res.json({ id: result.lastInsertRowid, username: username.trim() });
    } catch (e) {
      throw handleDbError(e, { uniqueMessage: 'Username already taken' });
    }
  });

  router.delete('/admin/users/:id', requireAuth, requireAdmin, blockInDemo, (req, res) => {
    User.delete(resolveAdminTarget(req).targetId);
    res.json({ success: true });
  });

  router.delete('/admin/songs/:id', requireAuth, requireAdmin, (req, res) => {
    const result = Song.delete(requireId(req.params.id, 'Invalid song ID'));
    if (!result.changes) throw new AppError('Song not found', 404);
    res.json({ success: true });
  });

  router.post('/admin/invites', requireAuth, requireAdmin, blockInDemo, (req, res) => {
    const code = crypto.randomBytes(8).toString('hex');
    Invite.create(code, req.user.id);
    res.json({ code });
  });

  router.get('/admin/invites', requireAuth, requireAdmin, (req, res) => {
    const invites = Invite.list();
    res.json(invites);
  });

  router.delete('/admin/invites/:id', requireAuth, requireAdmin, blockInDemo, (req, res) => {
    const result = Invite.deleteUnused(requireId(req.params.id, 'Invalid invite ID'));
    if (!result.changes) throw new AppError('Invite not found or already used', 404);
    res.json({ success: true });
  });

  router.get('/admin/corrections', requireAuth, requireAdmin, (req, res) => {
    const corrections = Song.getPendingCorrections();
    res.json(corrections);
  });

  router.get('/admin/config', requireAuth, requireAdmin, (req, res) => {
    res.json({ allowRegistration: isRegistrationAllowed() });
  });

  router.put('/admin/config', requireAuth, requireAdmin, blockInDemo, (req, res) => {
    const { allowRegistration } = req.body;
    if (typeof allowRegistration !== 'boolean') throw new AppError('allowRegistration must be a boolean', 400);
    setSetting('allow_registration', allowRegistration ? '1' : '0');
    res.json({ success: true, allowRegistration });
  });

  return router;
}

module.exports = { createAdminRouter };
