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
