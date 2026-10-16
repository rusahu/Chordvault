require('dotenv').config();
const express = require('express');
const path = require('path');
const { db } = require('./lib/db');
const { createApp } = require('./lib/app');
const { createApiRateLimiter } = require('./lib/rateLimiter');
const { createAuthRouter } = require('./routes/auth');
const { createSongsRouter } = require('./routes/songs');
const { createSetlistsRouter } = require('./routes/setlists');
const { createAdminRouter } = require('./routes/admin');
const { createSettingsRouter } = require('./routes/settings');
const { createOfflineRouter } = require('./routes/offline');

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required. Set it in your .env file.');
  process.exit(1);
}

const app = createApp((app) => {
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/api', createApiRateLimiter());
  app.use('/api/auth', createAuthRouter());
  app.use('/api', createSongsRouter());
  app.use('/api', createSetlistsRouter());
  app.use('/api', createAdminRouter());
  app.use('/api', createSettingsRouter());
  app.use('/api', createOfflineRouter());
});

const PORT = process.env.PORT || 3100;
const server = app.listen(PORT, () => console.log(`ChordVault running on port ${PORT}`));

let shuttingDown = false;
function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down...`);
  const forceExit = setTimeout(() => { db.close(); process.exit(1); }, 5000);
  server.close(() => {
    clearTimeout(forceExit);
    db.close();
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
