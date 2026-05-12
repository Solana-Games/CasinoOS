const test = require('node:test');
const assert = require('node:assert/strict');

const {
  toAnchorCommitHash,
  buildCreateRoundInstructionData,
  fromPreparedSyncedRound,
  buildSettleRoundInstructionData,
  fromResolvedSyncedRound
} = require('../src/solana/anchorRoundBridge');

test('create-round payload includes 32-byte commit hash', () => {
  const payload = buildCreateRoundInstructionData({
    roundId: 7,
    serverSeed: 'server-seed-7',
    minBetLamports: 1000,
    closeSlot: 12345,
    jackpotBps: 120
  });

  assert.equal(payload.roundId, 7);
  assert.equal(payload.commitHash.length, 32);
  assert.equal(Buffer.isBuffer(payload.commitHash), true);
  assert.equal(payload.minBetLamports, 1000);
  assert.equal(payload.closeSlot, 12345);
  assert.equal(payload.jackpotBps, 120);
});

test('prepare bridge supports external serverSeed option', () => {
  const payload = fromPreparedSyncedRound(
    {
      roundId: 9,
      commitHash: toAnchorCommitHash('seed-9').toString('hex')
    },
    {
      serverSeed: 'seed-9',
      minBetLamports: 2_000,
      closeSlot: 22_000
    }
  );

  assert.equal(payload.roundId, 9);
  assert.equal(payload.commitHash.length, 32);
});

test('settle payload enforces payout bps bounds', () => {
  assert.throws(
    () =>
      buildSettleRoundInstructionData({
        serverSeed: 'server-seed',
        winnerPayoutBps: [{ player: 'p1', bps: 9000 }, { player: 'p2', bps: 2000 }]
      }),
    /<= 10000/
  );
});

test('resolved synced round maps winners into settle payload', () => {
  const settle = fromResolvedSyncedRound({
    roundId: 4,
    reveal: { serverSeed: 'resolved-server-seed' },
    playerOutcomes: [
      { playerId: 'p1', totalWin: 10 },
      { playerId: 'p2', totalWin: 30 },
      { playerId: 'p3', totalWin: 0 }
    ]
  });

  assert.equal(settle.serverSeed.length, 32);
  assert.equal(settle.nonce, 4);
  assert.deepEqual(
    settle.payouts.map((item) => item.player),
    ['p1', 'p2']
  );
  assert.equal(
    settle.payouts.reduce((sum, item) => sum + item.bps, 0),
    10_000
  );
});
