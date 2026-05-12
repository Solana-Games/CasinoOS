const { spinGrid, evaluateSpin } = require('../engine/slotEngine');

const rooms = new Map();
const parsedMaxRooms = Number(process.env.MAX_ROOMS || 1000);
const parsedRoomTtl = Number(process.env.ROOM_TTL_MS || 30 * 60 * 1000);
const MAX_ROOMS = Number.isFinite(parsedMaxRooms) && parsedMaxRooms > 0 ? parsedMaxRooms : 1000;
const ROOM_TTL_MS = Number.isFinite(parsedRoomTtl) && parsedRoomTtl > 0 ? parsedRoomTtl : 30 * 60 * 1000;
const JACKPOT_THRESHOLD_MULTIPLIER = 50;

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
  const room = createRoom(id);
  if (!room.players.includes(playerId)) {
    room.players.push(playerId);
  }

  room.jackpotPool += bet * 0.01;
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
  if (room.history.length > 50) {
    room.history.shift();
  }
  room.updatedAt = Date.now();

  return event;
}

function getRoom(id) {
  cleanupRooms();
  return rooms.get(id) || null;
}

module.exports = { createRoom, joinRoom, spinRoom, getRoom };
