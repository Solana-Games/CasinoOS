const test = require('node:test');
const assert = require('node:assert/strict');
const { createCommit, verifyCommit, createDeterministicRng } = require('../src/engine/commitRevealRng');

test('commit hash can be verified against server seed', () => {
  const serverSeed = 'server-seed-2026-05-12';
  const commit = createCommit(serverSeed);

  assert.equal(verifyCommit(serverSeed, commit), true);
  assert.equal(verifyCommit('different-seed', commit), false);
});

test('deterministic rng returns identical sequence for same inputs', () => {
  const params = {
    serverSeed: 'server-seed-constant',
    clientSeed: 'client-seed-constant',
    nonce: 7
  };
  const rngA = createDeterministicRng(params);
  const rngB = createDeterministicRng(params);

  const sequenceA = Array.from({ length: 8 }, () => rngA(0, 100));
  const sequenceB = Array.from({ length: 8 }, () => rngB(0, 100));
  assert.deepEqual(sequenceA, sequenceB);
});
