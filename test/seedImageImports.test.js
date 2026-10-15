const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// The image ships these files without devDependencies (Dockerfile), and the demo seed imports session.mjs.
test('the demo seed session helper loads without devDependencies', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-image-'));
  for (const file of ['scripts/lib/session.mjs', 'shared/public-constants.json']) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.copyFileSync(path.join(__dirname, '..', file), path.join(root, file));
  }
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(path.join(root, 'scripts/lib/session.mjs'))})`], { encoding: 'utf8' });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(run.status, 0, run.stderr);
});
