const test = require('node:test');
const assert = require('node:assert/strict');
const { spinGrid, evaluateSpin } = require('../src/engine/slotEngine');

test('spinGrid returns 5x4 grid', () => {
  const grid = spinGrid();
  assert.equal(grid.length, 4);
  for (const row of grid) {
    assert.equal(row.length, 5);
  }
});

test('spinGrid supports deterministic commit-reveal mode', () => {
  const commitReveal = {
    serverSeed: 'server-seed-deterministic',
    clientSeed: 'client-seed-deterministic',
    nonce: 12
  };

  const gridA = spinGrid({ commitReveal });
  const gridB = spinGrid({ commitReveal });
  assert.deepEqual(gridA, gridB);
});

test('evaluateSpin triggers free spins at 3+ scatter', () => {
  const grid = [
    ['SCATTER', 'SCATTER', 'SCATTER', 'ACE', 'KING'],
    ['JACK', 'QUEEN', 'WILD', 'ACE', 'KING'],
    ['JACK', 'QUEEN', 'WILD', 'ACE', 'KING'],
    ['JACK', 'QUEEN', 'WILD', 'ACE', 'KING']
  ];

  const result = evaluateSpin(grid, 1, 1, 999);
  assert.equal(result.freeSpinsTriggered, true);
  assert.ok(result.totalWin > 0);
});

test('evaluateSpin ignores unknown symbols', () => {
  const grid = [
    ['ACE', 'KING', 'UNKNOWN', 'JACK', 'QUEEN'],
    ['SCATTER', 'SCATTER', 'SCATTER', 'ACE', 'KING'],
    ['JACK', 'QUEEN', 'WILD', 'ACE', 'KING'],
    ['JACK', 'QUEEN', 'WILD', 'ACE', 'KING']
  ];

  const result = evaluateSpin(grid, 1, 1, 999);
  assert.equal(Number.isFinite(result.totalWin), true);
  assert.equal(result.symbolCounts.UNKNOWN, undefined);
});

test('evaluateSpin rejects non-5x4 grid', () => {
  assert.throws(() => evaluateSpin([['ACE']]), /4x5/);
});

test('evaluateSpin rejects invalid bet or multiplier', () => {
  const grid = spinGrid();
  assert.throws(() => evaluateSpin(grid, 0, 1), /bet must be a finite positive number/);
  assert.throws(() => evaluateSpin(grid, 1, -1), /multiplier must be a finite positive number/);
});
