const test = require('node:test');
const assert = require('node:assert/strict');
const { createRoundPayload } = require('../src/solana/anchorRoundBridge');

test('anchor payload includes 32-byte arrays', () => {
  const payload = createRoundPayload({
    serverSeed: 'server-seed',
    clientSeed: 'client-seed',
    nonce: 42,
    playerId: 'player-7',
  });

  assert.equal(payload.commitHashBytes.length, 32);
  assert.equal(payload.clientSeedHashBytes.length, 32);
});
