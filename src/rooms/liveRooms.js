const { spinGrid } = require('../engine/slotEngine');
const crypto = require('node:crypto');

const rooms = new Map();
const MAX_ROUNDS_PER_ROOM = 200;
const ROOM_TTL_MS = 1000 * 60 * 60;

function cleanupRooms() {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (room.players.size === 0 && now - room.updatedAt > ROOM_TTL_MS) {
      rooms.delete(roomId);
      continue;
    }
    if (room.rounds.length > MAX_ROUNDS_PER_ROOM) {
      room.rounds = room.rounds.slice(room.rounds.length - MAX_ROUNDS_PER_ROOM);
    }
  }
}

function ensureRoom(roomId) {
  cleanupRooms();
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      players: new Set(),
      pooledJackpotSol: 0,
      rounds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  return rooms.get(roomId);
}

function joinRoom(roomId, playerId) {
  const room = ensureRoom(roomId);
  room.players.add(playerId);
  room.updatedAt = Date.now();
  return room;
}

function leaveRoom(roomId, playerId) {
  const room = ensureRoom(roomId);
  room.players.delete(playerId);
  room.updatedAt = Date.now();
  return room;
}

function prepareSyncedRound({ roomId, players, betSol, commitPayloadByPlayer, rtpTarget }) {
  const room = ensureRoom(roomId);
  for (const playerId of players) room.players.add(playerId);

  const round = {
    id: `${roomId}:${Date.now()}:${crypto.randomUUID()}`,
    roomId,
    players,
    betSol,
    commitPayloadByPlayer,
    createdAt: Date.now(),
    status: 'prepared',
    rtpTarget,
  };

  room.rounds.push(round);
  room.updatedAt = Date.now();
  return round;
}

function getRoomRound({ roomId, roundId }) {
  const room = rooms.get(roomId);
  if (!room) return undefined;
  return room.rounds.find((r) => r.id === roundId);
}

function resolveSyncedRound({ roomId, roundId }) {
  const room = ensureRoom(roomId);
  const round = room.rounds.find((r) => r.id === roundId);
  if (!round) throw new Error('round not found');
  if (round.status === 'resolved') return round;

  const playerResults = round.players.map((playerId) => {
    const commitReveal = round.commitPayloadByPlayer[playerId];
    const spin = spinGrid({
      betSol: round.betSol,
      commitReveal: { ...commitReveal, playerId },
      rtpTarget: round.rtpTarget || 95,
      jackpotRate: 0.015,
    });

    room.pooledJackpotSol = Number((room.pooledJackpotSol + spin.jackpotContribution).toFixed(4));

    return { playerId, ...spin };
  });

  const jackpotTriggered = playerResults.some((r) => r.megaWin && Number(r.scatters ?? 0) >= 3);
  const jackpotPayout = jackpotTriggered ? Number((room.pooledJackpotSol * 0.3).toFixed(4)) : 0;
  if (jackpotPayout > 0) room.pooledJackpotSol = Number((room.pooledJackpotSol - jackpotPayout).toFixed(4));

  round.status = 'resolved';
  round.results = playerResults;
  round.jackpotPayout = jackpotPayout;
  room.updatedAt = Date.now();

  return round;
}

module.exports = {
  joinRoom,
  leaveRoom,
  prepareSyncedRound,
  getRoomRound,
  resolveSyncedRound,
};
