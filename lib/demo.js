const { AppError } = require('./errors');

const DEMO_DISABLED = 'Disabled in demo mode';
const DEMO_MODE = process.env.DEMO_MODE === 'true';

function blockInDemo(req, res, next) {
  if (DEMO_MODE) throw new AppError(DEMO_DISABLED, 403);
  next();
}

module.exports = { DEMO_MODE, DEMO_DISABLED, blockInDemo };
