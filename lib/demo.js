const DEMO_DISABLED = 'Disabled in demo mode';
const DEMO_MODE = process.env.DEMO_MODE === 'true';

function blockInDemo(req, res, next) {
  if (DEMO_MODE) return res.status(403).json({ error: DEMO_DISABLED });
  next();
}

module.exports = { DEMO_MODE, DEMO_DISABLED, blockInDemo };
