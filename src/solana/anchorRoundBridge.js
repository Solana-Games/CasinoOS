const crypto = require('node:crypto');
const { createCommit } = require('../engine/commitRevealRng');

function normalizeBps(value, { min = 0, max = 10_000, field = 'bps' } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new TypeError(`${field} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function normalizeLamports(value, field = 'lamports') {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new TypeError(`${field} must be a positive integer`);
  }
  return parsed;
}

function normalizeRoundId(roundId) {
  const parsed = Number(roundId);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new TypeError('roundId must be a non-negative integer');
  }
  return parsed;
}

function toAnchorCommitHash(serverSeed) {
  const commitHex = createCommit(serverSeed);
  return Buffer.from(commitHex, 'hex');
}

function buildCreateRoundInstructionData({
  roundId,
  serverSeed,
  minBetLamports,
  closeSlot,
  jackpotBps = 100
} = {}) {
  return {
    roundId: normalizeRoundId(roundId),
    commitHash: toAnchorCommitHash(serverSeed),
    minBetLamports: normalizeLamports(minBetLamports, 'minBetLamports'),
    closeSlot: normalizeLamports(closeSlot, 'closeSlot'),
    jackpotBps: normalizeBps(jackpotBps, { field: 'jackpotBps' })
  };
}

function fromPreparedSyncedRound(preparedRound, options = {}) {
  if (!preparedRound || typeof preparedRound !== 'object') {
    throw new TypeError('preparedRound must be an object');
  }
  if (!preparedRound.reveal?.serverSeed && !options.serverSeed) {
    throw new TypeError('serverSeed is required via preparedRound.reveal.serverSeed or options.serverSeed');
  }

  return buildCreateRoundInstructionData({
    roundId: preparedRound.roundId,
    serverSeed: options.serverSeed || preparedRound.reveal.serverSeed,
    minBetLamports: options.minBetLamports || 1_000_000,
    closeSlot: options.closeSlot || 1,
    jackpotBps: options.jackpotBps ?? 100
  });
}

function buildSettleRoundInstructionData({
  serverSeed,
  nonce = 0,
  winnerPayoutBps = []
} = {}) {
  if (!Buffer.isBuffer(serverSeed) && !(Array.isArray(serverSeed) && serverSeed.length === 32)) {
    if (typeof serverSeed !== 'string') {
      throw new TypeError('serverSeed must be a string, Buffer, or 32-byte array');
    }
  }

  const normalizedNonce = normalizeRoundId(nonce);
  const normalizedPayouts = winnerPayoutBps.map((entry) => ({
    player: String(entry.player),
    bps: normalizeBps(entry.bps, { min: 1, field: 'winnerPayout.bps' })
  }));

  const total = normalizedPayouts.reduce((sum, item) => sum + item.bps, 0);
  if (total > 10_000) {
    throw new TypeError('winnerPayoutBps total must be <= 10000');
  }

  const serverSeedBytes = Buffer.isBuffer(serverSeed)
    ? serverSeed
    : Array.isArray(serverSeed)
      ? Buffer.from(serverSeed)
      : crypto.createHash('sha256').update(serverSeed).digest();

  if (serverSeedBytes.length !== 32) {
    throw new TypeError('serverSeed must resolve to 32 bytes');
  }

  return {
    serverSeed: serverSeedBytes,
    nonce: normalizedNonce,
    payouts: normalizedPayouts
  };
}

function fromResolvedSyncedRound(resolvedRound) {
  if (!resolvedRound || typeof resolvedRound !== 'object') {
    throw new TypeError('resolvedRound must be an object');
  }
  if (!resolvedRound.reveal?.serverSeed) {
    throw new TypeError('resolvedRound.reveal.serverSeed is required');
  }

  const eligible = (resolvedRound.playerOutcomes || []).filter((item) => item.totalWin > 0);
  const totalWins = eligible.reduce((sum, item) => sum + Number(item.totalWin), 0);

  const payouts = totalWins === 0
    ? []
    : eligible.map((item, index) => {
      if (index === eligible.length - 1) {
        const consumed = eligible
          .slice(0, -1)
          .reduce((sum, prior) => sum + Math.floor((Number(prior.totalWin) / totalWins) * 10_000), 0);
        return { player: item.playerId, bps: 10_000 - consumed };
      }
      return { player: item.playerId, bps: Math.floor((Number(item.totalWin) / totalWins) * 10_000) };
    });

  return buildSettleRoundInstructionData({
    serverSeed: resolvedRound.reveal.serverSeed,
    nonce: Number(resolvedRound.roundId) || 0,
    winnerPayoutBps: payouts
  });
}

module.exports = {
  toAnchorCommitHash,
  buildCreateRoundInstructionData,
  fromPreparedSyncedRound,
  buildSettleRoundInstructionData,
  fromResolvedSyncedRound
};
