const express = require('express');
const { isRegistrationAllowed } = require('../lib/db');
const User = require('../lib/models/user');
const Invite = require('../lib/models/invite');
const { requireAuth, checkPassword, sessionResponse, createAccount, setPassword } = require('../lib/auth');
const { CREDENTIALS_REQUIRED, validateObjectBody, assertValid, validateUserCredentials, validatePassword } = require('../lib/validation');
const { LIMITS } = require('../lib/constants');
const { AppError } = require('../lib/errors');
const { DEMO_MODE, DEMO_DISABLED, blockInDemo } = require('../lib/demo');

async function assertTurnstile(token) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return;
  if (token) {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
    });
    if ((await res.json()).success === true) return;
  }
  throw new AppError('Bot verification failed. Please try again.', 400);
}

function assertCanRegister(userCount) {
  if (userCount === 0) return;
  if (DEMO_MODE) throw new AppError(DEMO_DISABLED, 403);
  if (!isRegistrationAllowed()) throw new AppError('Registration is currently disabled', 403);
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
    assertCanRegister(User.count().count);
    const { username, password, turnstile_token } = req.body;
    await assertTurnstile(turnstile_token);
    assertValid(validateUserCredentials(username, password));
    res.json(sessionResponse(await createAccount(username, password, (name, hash) => User.register(name, hash, assertCanRegister))));
  });

  router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (typeof username !== 'string' || typeof password !== 'string') throw new AppError(CREDENTIALS_REQUIRED, 400);
    if (password.length > LIMITS.PASSWORD_MAX) throw new AppError('Invalid username or password', 401);
    const user = User.findByUsername(username.trim());
    const valid = await checkPassword(password, user?.password_hash);
    if (!user || !valid) throw new AppError('Invalid username or password', 401);
    if (user.disabled) throw new AppError('Account is disabled. Contact an administrator.', 403);
    res.json(sessionResponse(user));
  });

  router.post('/redeem-invite', blockInDemo, async (req, res) => {
    const { code, username, password, turnstile_token } = req.body;
    await assertTurnstile(turnstile_token);
    const inviteCode = typeof code === 'string' ? code.trim() : '';
    if (!inviteCode) throw new AppError('Invite code is required', 400);
    assertValid(validateUserCredentials(username, password));
    if (!Invite.findByCode(inviteCode)) throw new AppError(Invite.INVALID_INVITE, 400);

    res.json(sessionResponse(await createAccount(username, password, (name, hash) => Invite.redeem(inviteCode, name, hash))));
  });

  router.put('/password', blockInDemo, requireAuth, async (req, res) => {
    const { current_password, new_password } = req.body;
    if (typeof current_password !== 'string' || typeof new_password !== 'string' || !current_password || !new_password) throw new AppError('Current password and new password are required', 400);
    assertValid(validatePassword(new_password, 'New password'));
    const user = User.getFullById(req.user.id);
    if (!user) throw new AppError('User not found', 404);
    if (!(await checkPassword(current_password, user.password_hash))) throw new AppError('Current password is incorrect', 401);
    await setPassword(req.user.id, new_password);
    res.json({ success: true });
  });

  return router;
}

module.exports = { createAuthRouter };
