const { test } = require('node:test');
const assert = require('node:assert');
const { extractDirective, parseBpm } = require('../shared/chordpro.mjs');

test('reads directives at line start, indented, any case', () => {
  assert.strictEqual(extractDirective('{title: A}\n', 'title'), 'A');
  assert.strictEqual(extractDirective('x\n  {Title: B}\n', 'title'), 'B');
  assert.strictEqual(extractDirective('\t{KEY: G}', 'key'), 'G');
});

test('ignores directives that are not at line start', () => {
  assert.strictEqual(extractDirective('[C]la {title: Mid}', 'title'), null);
  assert.strictEqual(extractDirective('{c: was {title: Old}}\n{title: Real}', 'title'), 'Real');
});

test('parseBpm accepts whole numbers in range only', () => {
  assert.strictEqual(parseBpm(' 120 ', 1, 300), 120);
  for (const bad of ['120bpm', '72.5', '90-100', '0', '400', 'abc', '', null, undefined]) {
    assert.strictEqual(parseBpm(bad, 1, 300), null, String(bad));
  }
});
