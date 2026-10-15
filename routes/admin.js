const express = require('express');
const crypto = require('crypto');
const { setSetting, isRegistrationAllowed } = require('../lib/db');
const User = require('../lib/models/user');
const Song = require('../lib/models/song');
const Invite = require('../lib/models/invite');
const { requireAuth, requireAdmin, createAccount, setPassword } = require('../lib/auth');
const { validateObjectBody, requireId, assertValid, validateUserCredentials, validatePassword, validateBoolean, validateTagList } = require('../lib/validation');
const { AppError, requireFound } = require('../lib/errors');
const { ROLES } = require('../lib/constants');
const Tags = require('../lib/models/tags');
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
  router.use('/admin', requireAuth, requireAdmin);

  router.get('/admin/stats', (req, res) => {
    const userCount = User.count().count;
    const songCount = Song.count();
    const pendingCount = Song.countPending();
    const recentUsers = User.getRecent(5);
    const recentSongs = Song.getRecent(5);
    const noFormatCount = Song.countNoFormat();
    const languageDistribution = Song.getLanguageDistribution();
    res.json({ userCount, songCount, pendingCount, noFormatCount, languageDistribution, recentUsers, recentSongs });
  });

  router.get('/admin/users', (req, res) => {
    const users = User.listWithSongCount();
    res.json(users);
  });

  router.put('/admin/users/:id/role', blockInDemo, (req, res) => {
    const { role } = req.body;
    const resolved = resolveAdminTarget(req);

    if ((role === ROLES.ADMIN || resolved.target.role === ROLES.ADMIN) && req.user.role !== ROLES.OWNER) {
      throw new AppError('Only the owner can promote or demote admins', 403);
    }
    if (role !== ROLES.USER && role !== ROLES.ADMIN) throw new AppError('Role must be "user" or "admin"', 400);

    User.updateRole(resolved.targetId, role);
    res.json({ success: true });
  });

  router.put('/admin/users/:id/disabled', blockInDemo, (req, res) => {
    const { disabled } = req.body;
    assertValid(validateBoolean(disabled, 'disabled'));
    User.updateDisabled(resolveAdminTarget(req).targetId, disabled);
    res.json({ success: true });
  });

  router.put('/admin/users/:id/password', blockInDemo, async (req, res) => {
    const { targetId } = resolveAdminTarget(req);
    const { password } = req.body;
    assertValid(validatePassword(password));

    await setPassword(targetId, password);
    res.json({ success: true });
  });

  router.post('/admin/users', blockInDemo, async (req, res) => {
    const { username, password } = req.body;
    assertValid(validateUserCredentials(username, password));
    const { id, username: name } = await createAccount(username, password, (trimmed, hash) => User.create(trimmed, hash, ROLES.USER));
    res.json({ id, username: name });
  });

  router.delete('/admin/users/:id', blockInDemo, (req, res) => {
    User.delete(resolveAdminTarget(req).targetId);
    res.json({ success: true });
  });

  router.delete('/admin/songs/:id', (req, res) => {
    const result = Song.delete(requireId(req.params.id, 'Invalid song ID'));
    if (!result.changes) throw new AppError('Song not found', 404);
    res.json({ success: true });
  });

  router.post('/admin/invites', blockInDemo, (req, res) => {
    const code = crypto.randomBytes(8).toString('hex');
    Invite.create(code, req.user.id);
    res.json({ code });
  });

  router.get('/admin/invites', (req, res) => {
    const invites = Invite.list();
    res.json(invites);
  });

  router.delete('/admin/invites/:id', blockInDemo, (req, res) => {
    const result = Invite.deleteUnused(requireId(req.params.id, 'Invalid invite ID'));
    if (!result.changes) throw new AppError('Invite not found or already used', 404);
    res.json({ success: true });
  });

  router.get('/admin/corrections', (req, res) => {
    const corrections = Song.getPendingCorrections();
    res.json(corrections);
  });

  router.get('/admin/config', (req, res) => {
    res.json({ allowRegistration: isRegistrationAllowed() });
  });

  router.get('/admin/tags', (_req, res) => res.json(Tags.withUsage()));

  router.put('/admin/tags', blockInDemo, (req, res) => {
    const { tags, error } = validateTagList(req.body.tags);
    assertValid(error);
    Tags.saveTags(tags);
    res.json(Tags.withUsage());
  });

  router.delete('/admin/tags', blockInDemo, (_req, res) => {
    Tags.resetTags();
    res.json(Tags.withUsage());
  });

  router.put('/admin/config', blockInDemo, (req, res) => {
    const { allowRegistration } = req.body;
    assertValid(validateBoolean(allowRegistration, 'allowRegistration'));
    setSetting('allow_registration', allowRegistration ? '1' : '0');
    res.json({ success: true, allowRegistration });
  });

  return router;
}

module.exports = { createAdminRouter };
