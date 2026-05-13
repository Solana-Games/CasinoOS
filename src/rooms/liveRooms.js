const { spinGrid } = require('../engine/slotEngine');

const rooms = new Map();

function ensureRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      players: new Set(),
      pooledJackpotSol: 0,
      rounds: [],
      createdAt: Date.now(),
    });
  }
  return rooms.get(roomId);
}

function joinRoom(roomId, playerId) {
  const room = ensureRoom(roomId);
  room.players.add(playerId);
  return room;
}

function leaveRoom(roomId, playerId) {
  const room = ensureRoom(roomId);
  room.players.delete(playerId);
  return room;
}

function prepareSyncedRound({ roomId, players, betSol, commitPayloadByPlayer, rtpTarget }) {
  const room = ensureRoom(roomId);
  for (const playerId of players) room.players.add(playerId);

  const round = {
    id: `${roomId}:${Date.now()}`,
    roomId,
    players,
    betSol,
    commitPayloadByPlayer,
    createdAt: Date.now(),
    status: 'prepared',
    rtpTarget,
  };

  room.rounds.push(round);
  return round;
}

function resolveSyncedRound({ roomId, roundId }) {
  const room = ensureRoom(roomId);
  const round = room.rounds.find((r) => r.id === roundId);
  if (!round) throw new Error('round not found');

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

  const jackpotTriggered = playerResults.some((r) => r.megaWin && r.scatters >= 3);
  const jackpotPayout = jackpotTriggered ? Number((room.pooledJackpotSol * 0.3).toFixed(4)) : 0;
  if (jackpotPayout > 0) room.pooledJackpotSol = Number((room.pooledJackpotSol - jackpotPayout).toFixed(4));

  round.status = 'resolved';
  round.results = playerResults;
  round.jackpotPayout = jackpotPayout;

  return round;
}

module.exports = {
  joinRoom,
  leaveRoom,
  prepareSyncedRound,
  resolveSyncedRound,
};
