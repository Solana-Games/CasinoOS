const { spinGrid, evaluateSpin } = require('../engine/slotEngine');

const rooms = new Map();

function createRoom(id) {
  if (!rooms.has(id)) {
    rooms.set(id, {
      id,
      players: [],
      jackpotPool: 0,
      history: []
    });
  }

  return rooms.get(id);
}

function joinRoom(id, playerId) {
  const room = createRoom(id);
  if (!room.players.includes(playerId)) {
    room.players.push(playerId);
  }
  return room;
}

function spinRoom(id, playerId, bet = 1, multiplier = 1) {
  const room = createRoom(id);
  if (!room.players.includes(playerId)) {
    room.players.push(playerId);
  }

  room.jackpotPool += bet * 0.01;
  const grid = spinGrid();
  const outcome = evaluateSpin(grid, bet, multiplier, room.jackpotPool * 50);

  const event = {
    playerId,
    grid,
    outcome,
    roomJackpotPool: Number(room.jackpotPool.toFixed(4)),
    at: new Date().toISOString()
  };

  room.history.push(event);
  if (room.history.length > 50) {
    room.history.shift();
  }

  return event;
}

function getRoom(id) {
  return rooms.get(id) || null;
}

module.exports = { createRoom, joinRoom, spinRoom, getRoom };
