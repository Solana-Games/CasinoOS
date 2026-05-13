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
  if (!preparedRound.serverSeed && !preparedRound.reveal?.serverSeed && !options.serverSeed) {
    throw new TypeError('serverSeed is required via preparedRound.serverSeed or options.serverSeed');
  }

  const closeSlot = options.closeSlot ?? preparedRound.closeSlot;
  if (!Number.isInteger(Number(closeSlot)) || Number(closeSlot) <= 1) {
    throw new TypeError('closeSlot must be provided as a future slot (> 1)');
  }

  return buildCreateRoundInstructionData({
    roundId: preparedRound.roundId,
    serverSeed: options.serverSeed || preparedRound.serverSeed || preparedRound.reveal?.serverSeed,
    minBetLamports: options.minBetLamports || 1_000_000,
    closeSlot,
    jackpotBps: options.jackpotBps ?? 100
  });
}

function buildSettleRoundInstructionData({
  serverSeed,
  nonce = 0,
  jackpotWinner = null,
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
      : /^[a-f0-9]{64}$/i.test(serverSeed)
        ? Buffer.from(serverSeed, 'hex')
        : crypto.createHash('sha256').update(serverSeed).digest();

  if (serverSeedBytes.length !== 32) {
    throw new TypeError('serverSeed must resolve to 32 bytes');
  }

  return {
    serverSeed: serverSeedBytes,
    nonce: normalizedNonce,
    jackpotWinner: jackpotWinner ? String(jackpotWinner) : null,
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
    : (() => {
      if (eligible.length > 10_000) {
        throw new TypeError('too many winners to allocate minimum 1 bps each');
      }

      const distributableBps = 10_000 - eligible.length;
      const proportional = eligible.map((item, index) => {
        const exact = (Number(item.totalWin) / totalWins) * distributableBps;
        const base = Math.floor(exact);
        return {
          player: item.playerId,
          bps: 1 + base,
          remainder: exact - base,
          index
        };
      });

      let assigned = proportional.reduce((sum, item) => sum + item.bps, 0);
      proportional
        .sort((a, b) => (b.remainder - a.remainder) || (a.index - b.index))
        .forEach((item) => {
          if (assigned < 10_000) {
            item.bps += 1;
            assigned += 1;
          }
        });

      return proportional
        .sort((a, b) => a.index - b.index)
        .map(({ player, bps }) => ({ player, bps }));
    })();

  const jackpotWinner = eligible.length === 0
    ? null
    : eligible.reduce((best, item) => (Number(item.totalWin) > Number(best.totalWin) ? item : best)).playerId;

  return buildSettleRoundInstructionData({
    serverSeed: resolvedRound.reveal.serverSeed,
    nonce: Number(resolvedRound.roundId) || 0,
    jackpotWinner,
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
