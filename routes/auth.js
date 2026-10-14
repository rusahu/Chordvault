const express = require('express');
const bcrypt = require('bcryptjs');
const { isRegistrationAllowed } = require('../lib/db');
const User = require('../lib/models/user');
const Invite = require('../lib/models/invite');
const { requireAuth, hashPassword, issueToken } = require('../lib/auth');
const { validateObjectBody, assertValid, validateUserCredentials, validatePassword } = require('../lib/validation');
const { ROLES } = require('../lib/constants');
const { AppError, handleDbError } = require('../lib/errors');
const { DEMO_MODE, blockInDemo } = require('../lib/demo');

async function verifyTurnstile(token) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
  });
  const data = await res.json();
  return data.success === true;
}

function createAuthRouter() {
  const router = express.Router();
  router.use(validateObjectBody);

  router.get('/config', (req, res) => {
    const userCount = User.count().count;
    const hasInvites = Invite.countPending() > 0;
    res.json({ allowRegistration: isRegistrationAllowed() || userCount === 0, invitesEnabled: hasInvites, turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null, demoMode: DEMO_MODE });
  });

  router.post('/register', async (req, res) => {
    const userCount = User.count().count;
    if (DEMO_MODE && userCount > 0) throw new AppError('Disabled in demo mode', 403);
    if (!isRegistrationAllowed() && userCount > 0) throw new AppError('Registration is currently disabled', 403);

    const { username, password, turnstile_token } = req.body;
    if (!(await verifyTurnstile(turnstile_token))) throw new AppError('Bot verification failed. Please try again.', 400);
    assertValid(validateUserCredentials(username, password));

    const isFirstUser = userCount === 0;
    const role = isFirstUser ? ROLES.OWNER : ROLES.USER;
    const hash = await hashPassword(password);
    try {
      const result = User.create(username.trim(), hash, role);
      const token = issueToken({ id: result.lastInsertRowid, username: username.trim() });
      res.json({ token, id: result.lastInsertRowid, username: username.trim(), role });
    } catch (e) {
      throw handleDbError(e, { uniqueMessage: 'Username already taken' });
    }
  });

  router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (typeof username !== 'string' || typeof password !== 'string') throw new AppError('Username and password required', 400);
    const user = User.findByUsername(username.trim());
    if (!user || !(await bcrypt.compare(password, user.password_hash))) throw new AppError('Invalid username or password', 401);
    if (user.disabled) throw new AppError('Account is disabled. Contact an administrator.', 403);
    res.json({ token: issueToken(user), id: user.id, username: user.username, role: user.role });
  });

  router.post('/redeem-invite', blockInDemo, async (req, res) => {
    const { code, username, password, turnstile_token } = req.body;
    if (!(await verifyTurnstile(turnstile_token))) throw new AppError('Bot verification failed. Please try again.', 400);
    if (typeof code !== 'string' || !code.trim()) throw new AppError('Invite code is required', 400);
    assertValid(validateUserCredentials(username, password));

    const invite = Invite.findByCode(code.trim());
    if (!invite) throw new AppError('Invalid or already used invite code', 400);

    const hash = await hashPassword(password);
    try {
      const result = Invite.redeem(code.trim(), username.trim(), hash);
      const token = issueToken({ id: result.lastInsertRowid, username: username.trim() });
      res.json({ token, id: result.lastInsertRowid, username: username.trim(), role: ROLES.USER });
    } catch (e) {
      throw handleDbError(e, { uniqueMessage: 'Username already taken' });
    }
  });

  router.put('/password', blockInDemo, requireAuth, async (req, res) => {
    const { current_password, new_password } = req.body;
    if (typeof current_password !== 'string' || typeof new_password !== 'string' || !current_password || !new_password) throw new AppError('Current password and new password are required', 400);
    assertValid(validatePassword(new_password, 'New password'));
    const user = User.getFullById(req.user.id);
    if (!user) throw new AppError('User not found', 404);
    if (!(await bcrypt.compare(current_password, user.password_hash))) throw new AppError('Current password is incorrect', 401);
    const hash = await hashPassword(new_password);
    User.updatePassword(req.user.id, hash);
    res.json({ success: true });
  });

  return router;
}

module.exports = { createAuthRouter };
