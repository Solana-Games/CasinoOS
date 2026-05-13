const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const anchor = require('@coral-xyz/anchor');
const { createRoundPayload } = require('../src/solana/anchorRoundBridge');

test('anchor payload includes 32-byte arrays', () => {
  const player = anchor.web3.Keypair.generate().publicKey.toBase58();
  const payload = createRoundPayload({
    serverSeed: 'server-seed',
    clientSeed: 'client-seed',
    nonce: 42,
    playerId: player,
  });

  assert.equal(payload.commitHashBytes.length, 32);
  assert.equal(payload.clientSeedHashBytes.length, 32);
  const nonceBytes = Buffer.alloc(8);
  nonceBytes.writeBigUInt64LE(42n);
  const playerBytes = new anchor.web3.PublicKey(player).toBuffer();
  const expectedCommit = crypto
    .createHash('sha256')
    .update(Buffer.concat([Buffer.from(payload.serverSeedBytes), Buffer.from(payload.clientSeedBytes), nonceBytes, playerBytes]))
    .digest('hex');
  assert.equal(payload.commitHashHex, expectedCommit);
});
