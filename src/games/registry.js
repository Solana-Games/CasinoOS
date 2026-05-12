const crypto = require('node:crypto');
const { spinGrid, evaluateSpin } = require('../engine/slotEngine');

const gameRegistry = Object.assign(Object.create(null), {
  slots: {
    id: 'slots',
    play: ({ bet = 1, multiplier = 1, commitReveal } = {}) => {
      const grid = commitReveal ? spinGrid({ commitReveal }) : spinGrid();
      return { grid, outcome: evaluateSpin(grid, bet, multiplier) };
    }
  },
  dice: {
    id: 'dice',
    play: () => ({ roll: crypto.randomInt(1, 7) })
  },
  roulette: {
    id: 'roulette',
    play: () => ({ number: crypto.randomInt(0, 37) })
  },
  crash: {
    id: 'crash',
    play: () => ({ crashPoint: Number((1 + crypto.randomInt(0, 1001) / 100).toFixed(2)) })
  },
  blackjack: {
    id: 'blackjack',
    play: () => ({ dealer: crypto.randomInt(16, 27) })
  }
});

function registerGame(name, module) {
  if (!/^[a-z0-9-]{2,32}$/i.test(String(name))) {
    throw new TypeError('game name must be 2-32 chars [a-z0-9-]');
  }
  gameRegistry[name] = module;
}

function getGame(name) {
  return gameRegistry[name] || null;
}

module.exports = { gameRegistry, registerGame, getGame };
