const { createRng, createCommit } = require('./commitRevealRng');

const REELS = 5;
const ROWS = 4;
const SYMBOLS = ['K', 'Q', 'J', 'A', '🟪', '👑', '⚔️', '🟡'];
const SCATTER = '🟪';
const WILD = '👑';

function randomSymbol(rand) {
  const weighted = [
    ['K', 22], ['Q', 20], ['J', 18], ['A', 18], ['⚔️', 10], ['🟡', 7], ['👑', 3], ['🟪', 2],
  ];
  const roll = rand() * 100;
  let cumulative = 0;
  for (const [symbol, weight] of weighted) {
    cumulative += weight;
    if (roll <= cumulative) return symbol;
  }
  return 'K';
}

function buildGrid(rand) {
  const grid = [];
  for (let row = 0; row < ROWS; row += 1) {
    const line = [];
    for (let reel = 0; reel < REELS; reel += 1) {
      line.push(randomSymbol(rand));
    }
    grid.push(line);
  }
  return grid;
}

function countSymbol(grid, symbol) {
  return grid.flat().filter((item) => item === symbol).length;
}

function evaluateLines(grid, betSol, rtpTarget) {
  let payout = 0;
  const hits = [];

  for (let row = 0; row < ROWS; row += 1) {
    const rowSymbols = grid[row];
    const primary = rowSymbols.find((s) => s !== WILD) ?? WILD;
    let streak = 0;

    for (const symbol of rowSymbols) {
      if (symbol === primary || symbol === WILD || primary === WILD) streak += 1;
      else break;
    }

    if (streak >= 3) {
      const multiplier = streak === 5 ? 20 : streak === 4 ? 8 : 3;
      const lineWin = betSol * multiplier * (rtpTarget / 100);
      payout += lineWin;
      hits.push({ row, streak, primary, lineWin: Number(lineWin.toFixed(4)) });
    }
  }

  const scatters = countSymbol(grid, SCATTER);
  const freeSpins = scatters >= 3 ? 12 : scatters === 2 ? 4 : 0;
  const scatterWin = scatters >= 3 ? betSol * scatters * 2 : 0;
  payout += scatterWin;

  const bigWin = payout >= betSol * 25;
  const megaWin = payout >= betSol * 75;

  return {
    payoutSol: Number(payout.toFixed(4)),
    hits,
    scatters,
    freeSpins,
    scatterWin: Number(scatterWin.toFixed(4)),
    bigWin,
    megaWin,
  };
}

function spinGrid({ betSol, commitReveal, rtpTarget = 95, jackpotRate = 0.02 }) {
  if (!commitReveal || !commitReveal.serverSeed || !commitReveal.clientSeed) {
    throw new Error('commitReveal is required');
  }

  const rng = createRng(commitReveal);
  const grid = buildGrid(rng);
  const evaluation = evaluateLines(grid, betSol, rtpTarget);
  const jackpotContribution = Number((betSol * jackpotRate).toFixed(4));

  return {
    grid,
    symbols: SYMBOLS,
    ...evaluation,
    jackpotContribution,
    outcomeHash: createCommit(
      commitReveal.serverSeed,
      commitReveal.clientSeed,
      commitReveal.nonce,
      commitReveal.playerId || ''
    ),
  };
}

module.exports = {
  REELS,
  ROWS,
  SYMBOLS,
  WILD,
  SCATTER,
  spinGrid,
};
