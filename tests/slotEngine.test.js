const test = require('node:test');
const assert = require('node:assert/strict');
const { spinGrid } = require('../src/engine/slotEngine');

test('slot engine produces 5x4 grid', () => {
  const result = spinGrid({
    betSol: 1,
    commitReveal: { serverSeed: 'srv', clientSeed: 'cli', nonce: 1 },
    rtpTarget: 95,
  });

  assert.equal(result.grid.length, 4);
  assert.equal(result.grid[0].length, 5);
  assert.ok(result.payoutSol >= 0);
});
