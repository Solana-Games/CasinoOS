const test = require('node:test');
const assert = require('node:assert/strict');
const { gameRegistry, registerGame, getGame } = require('../src/games/registry');

test('registerGame rejects unsafe names', () => {
  assert.throws(() => registerGame('__proto__', { id: 'bad' }), /game name/);
});

test('dice and roulette ranges are valid', () => {
  const dice = getGame('dice').play();
  assert.ok(dice.roll >= 1 && dice.roll <= 6);

  const roulette = getGame('roulette').play();
  assert.ok(roulette.number >= 0 && roulette.number <= 36);

  assert.equal(Object.getPrototypeOf(gameRegistry), null);
});
