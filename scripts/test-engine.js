const assert = require('node:assert/strict');
const { spinGrid } = require('../src/engine/slotEngine');

const grid = spinGrid();
assert.equal(grid.length, 4);
assert.equal(grid[0].length, 5);
console.log('✔ Slot grid valid');
