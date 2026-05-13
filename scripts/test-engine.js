#!/usr/bin/env node
const test = require('node:test');
const assert = require('node:assert/strict');
const { spinGrid } = require('../src/engine/slotEngine');

test('engine generates deterministic spin with same seeds', () => {
  const input = {
    betSol: 1,
    commitReveal: { serverSeed: 'a', clientSeed: 'b', nonce: 1 },
    rtpTarget: 95,
  };
  const a = spinGrid(input);
  const b = spinGrid(input);
  assert.deepEqual(a.grid, b.grid);
  assert.equal(a.outcomeHash, b.outcomeHash);
});
