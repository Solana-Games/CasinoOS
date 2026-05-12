const { spinGrid, evaluateSpin } = require('../engine/slotEngine');

const gameRegistry = {
  slots: {
    id: 'slots',
    play: ({ bet = 1, multiplier = 1 } = {}) => {
      const grid = spinGrid();
      return { grid, outcome: evaluateSpin(grid, bet, multiplier) };
    }
  },
  dice: {
    id: 'dice',
    play: () => ({ roll: Math.floor(Math.random() * 6) + 1 })
  },
  roulette: {
    id: 'roulette',
    play: () => ({ number: Math.floor(Math.random() * 37) })
  },
  crash: {
    id: 'crash',
    play: () => ({ crashPoint: Number((1 + Math.random() * 10).toFixed(2)) })
  },
  blackjack: {
    id: 'blackjack',
    play: () => ({ dealer: Math.floor(Math.random() * 11) + 16 })
  }
};

function registerGame(name, module) {
  gameRegistry[name] = module;
}

function getGame(name) {
  return gameRegistry[name] || null;
}

module.exports = { gameRegistry, registerGame, getGame };
