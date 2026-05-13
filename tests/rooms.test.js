const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareSyncedRound, resolveSyncedRound } = require('../src/rooms/liveRooms');

test('prepare and resolve multiplayer room round', () => {
  const round = prepareSyncedRound({
    roomId: 'alpha',
    players: ['u1', 'u2'],
    betSol: 1,
    commitPayloadByPlayer: {
      u1: { serverSeed: 's1', clientSeed: 'c1', nonce: 1 },
      u2: { serverSeed: 's2', clientSeed: 'c2', nonce: 2 },
    },
    rtpTarget: 95,
  });

  const resolved = resolveSyncedRound({ roomId: 'alpha', roundId: round.id });
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.results.length, 2);
});
