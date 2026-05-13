const test = require('node:test');
const assert = require('node:assert/strict');
const { createRoom, joinRoom, spinRoom, prepareSyncedRound, resolveSyncedRound, getRoom } = require('../src/rooms/liveRooms');

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

test('spinRoom rejects invalid bets and multipliers', () => {
  createRoom('alpha-invalid');
  assert.throws(() => spinRoom('alpha-invalid', 'p1', 0, 1), /bet must be a finite positive number/);
  assert.throws(() => spinRoom('alpha-invalid', 'p1', 1, Infinity), /multiplier must be a finite positive number/);
});

test('synced rounds use commit-reveal and shared outcomes', () => {
  createRoom('sync-alpha');
  const prepared = prepareSyncedRound('sync-alpha', 'client-seed-1', 'round-1');
  const event = resolveSyncedRound('sync-alpha', 'round-1', { p1: 2, p2: 3 }, 1);

  assert.equal(event.mode, 'synced');
  assert.equal(event.roundId, 'round-1');
  assert.equal(event.commitHash, prepared.commitHash);
  assert.equal(event.playerOutcomes.length, 2);
  assert.deepEqual(event.playerOutcomes.map((entry) => entry.playerId).sort(), ['p1', 'p2']);
  assert.equal(event.grid.length, 4);
  assert.equal(event.grid[0].length, 5);
});

test('synced round requires positive bets and existing pending round', () => {
  createRoom('sync-beta');
  assert.throws(() => resolveSyncedRound('sync-beta', 'missing-round', { p1: 1 }), /pending round/);

  prepareSyncedRound('sync-beta', 'client-seed-2', 'round-2');
  assert.throws(() => resolveSyncedRound('sync-beta', 'round-2', { p1: 0 }), /positive bet/);
});
