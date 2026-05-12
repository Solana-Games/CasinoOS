const test = require('node:test');
const assert = require('node:assert/strict');
const { createRoom, joinRoom, spinRoom, getRoom } = require('../src/rooms/liveRooms');

test('room lifecycle create/join/spin works', () => {
  createRoom('alpha');
  joinRoom('alpha', 'p1');
  const event = spinRoom('alpha', 'p1', 2, 2);

  assert.equal(event.playerId, 'p1');
  assert.equal(event.grid.length, 4);

  const room = getRoom('alpha');
  assert.equal(room.players.includes('p1'), true);
  assert.ok(room.jackpotPool > 0);
});
