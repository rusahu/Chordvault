const express = require('express');
const helmet = require('helmet');
const { errorHandler } = require('./errors');
const { LIMITS } = require('./constants');

/** The request pipeline shared by the server and the route tests; `mount` adds the routes. */
function createApp(mount) {
  const app = express();
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://challenges.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
        fontSrc: ["'self'", "fonts.gstatic.com"],
        connectSrc: ["'self'"],
        frameSrc: ["'self'", "https://challenges.cloudflare.com"],
      }
    }
  }));
  app.set('trust proxy', 1);
  app.use(express.json({ limit: LIMITS.MAX_BODY_JSON }));
  mount(app);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
