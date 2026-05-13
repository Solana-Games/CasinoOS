const test = require('node:test');
const assert = require('node:assert/strict');
const { createCommit, verifyCommit, reveal } = require('../src/engine/commitRevealRng');

test('commit hash verifies deterministically', () => {
  const expected = createCommit('server', 'client', 7, 'player-1');
  assert.equal(verifyCommit({ serverSeed: 'server', clientSeed: 'client', nonce: 7, expectedCommit: expected, playerId: 'player-1' }), true);
});

test('reveal output is bounded 0..1', () => {
  const out = reveal('server', 'client', 1, 0, 'p');
  assert.ok(out.value >= 0 && out.value <= 1);
  assert.equal(typeof out.hash, 'string');
});
