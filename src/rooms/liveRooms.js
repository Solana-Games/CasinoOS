const crypto = require('node:crypto');
const { spinGrid, evaluateSpin } = require('../engine/slotEngine');
const { createCommit, verifyCommit } = require('../engine/commitRevealRng');

const rooms = new Map();
const parsedMaxRooms = Number(process.env.MAX_ROOMS || 1000);
const parsedRoomTtl = Number(process.env.ROOM_TTL_MS || 30 * 60 * 1000);
const MAX_ROOMS = Number.isFinite(parsedMaxRooms) && parsedMaxRooms > 0 ? parsedMaxRooms : 1000;
const ROOM_TTL_MS = Number.isFinite(parsedRoomTtl) && parsedRoomTtl > 0 ? parsedRoomTtl : 30 * 60 * 1000;
const JACKPOT_THRESHOLD_MULTIPLIER = 50;
const JACKPOT_CONTRIBUTION_RATE = 0.01;
const ROOM_HISTORY_LIMIT = 50;

function cleanupRooms() {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.updatedAt > ROOM_TTL_MS) {
      rooms.delete(roomId);
    }
  }
}

function createRoom(id) {
  cleanupRooms();
  if (!rooms.has(id)) {
    if (rooms.size >= MAX_ROOMS) {
      throw new Error('room capacity reached');
    }

    rooms.set(id, {
      id,
      players: [],
      jackpotPool: 0,
      history: [],
      pendingRounds: Object.create(null),
      updatedAt: Date.now()
    });
  }

  rooms.get(id).updatedAt = Date.now();
  return rooms.get(id);
}

function joinRoom(id, playerId) {
  const room = createRoom(id);
  if (!room.players.includes(playerId)) {
    room.players.push(playerId);
  }
  room.updatedAt = Date.now();
  return room;
}

function spinRoom(id, playerId, bet = 1, multiplier = 1) {
  if (!Number.isFinite(bet) || bet <= 0) {
    throw new TypeError('bet must be a finite positive number');
  }
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new TypeError('multiplier must be a finite positive number');
  }

  const room = createRoom(id);
  if (!room.players.includes(playerId)) {
    room.players.push(playerId);
  }

  room.jackpotPool += bet * JACKPOT_CONTRIBUTION_RATE;
  const grid = spinGrid();
  const outcome = evaluateSpin(grid, bet, multiplier, room.jackpotPool * JACKPOT_THRESHOLD_MULTIPLIER);

  const event = {
    playerId,
    grid,
    outcome,
    roomJackpotPool: Number(room.jackpotPool.toFixed(4)),
    at: new Date().toISOString()
  };

  room.history.push(event);
  if (room.history.length > ROOM_HISTORY_LIMIT) {
    room.history.shift();
  }
  room.updatedAt = Date.now();

  return event;
}

function prepareSyncedRound(id, clientSeed, roundId = crypto.randomUUID()) {
  const room = createRoom(id);
  const serverSeed = crypto.randomBytes(32).toString('hex');
  const commitHash = createCommit(serverSeed);

  room.pendingRounds[roundId] = {
    roundId,
    serverSeed,
    clientSeed: String(clientSeed || ''),
    commitHash,
    createdAt: Date.now()
  };
  room.updatedAt = Date.now();

  return { roomId: id, roundId, commitHash };
}

function resolveSyncedRound(id, roundId, playerBets = {}, multiplier = 1) {
  const room = createRoom(id);
  const pendingRound = room.pendingRounds[roundId];
  if (!pendingRound) {
    throw new Error('pending round not found');
  }

  if (!verifyCommit(pendingRound.serverSeed, pendingRound.commitHash)) {
    throw new Error('round commit verification failed');
  }

  const participantEntries = Object.entries(playerBets).filter(([, bet]) => Number.isFinite(bet) && bet > 0);
  if (participantEntries.length === 0) {
    throw new TypeError('playerBets must include at least one positive bet');
  }

  for (const [playerId] of participantEntries) {
    if (!room.players.includes(playerId)) {
      room.players.push(playerId);
    }
  }

  const grid = spinGrid({
    commitReveal: {
      serverSeed: pendingRound.serverSeed,
      clientSeed: pendingRound.clientSeed,
      nonce: Math.floor(pendingRound.createdAt / 1000)
    }
  });

  let totalContribution = 0;
  const playerOutcomes = participantEntries.map(([playerId, bet]) => {
    totalContribution += bet * JACKPOT_CONTRIBUTION_RATE;
    const outcome = evaluateSpin(grid, bet, multiplier, Number.POSITIVE_INFINITY);
    return {
      playerId,
      bet,
      ...outcome
    };
  });

  room.jackpotPool += totalContribution;

  const topWin = playerOutcomes.reduce((max, item) => (item.totalWin > max ? item.totalWin : max), 0);
  const jackpotTriggered = topWin >= room.jackpotPool * JACKPOT_THRESHOLD_MULTIPLIER;
  const jackpotPayout = jackpotTriggered ? Number(room.jackpotPool.toFixed(4)) : 0;
  if (jackpotTriggered) {
    room.jackpotPool = 0;
  }

  const event = {
    roomId: id,
    roundId,
    mode: 'synced',
    commitHash: pendingRound.commitHash,
    reveal: {
      serverSeed: pendingRound.serverSeed,
      clientSeed: pendingRound.clientSeed
    },
    grid,
    playerOutcomes,
    jackpotTriggered,
    jackpotPayout,
    roomJackpotPool: Number(room.jackpotPool.toFixed(4)),
    at: new Date().toISOString()
  };

  delete room.pendingRounds[roundId];
  room.history.push(event);
  if (room.history.length > ROOM_HISTORY_LIMIT) {
    room.history.shift();
  }
  room.updatedAt = Date.now();

  return event;
}

function getRoom(id) {
  cleanupRooms();
  return rooms.get(id) || null;
}

module.exports = { createRoom, joinRoom, spinRoom, prepareSyncedRound, resolveSyncedRound, getRoom };
