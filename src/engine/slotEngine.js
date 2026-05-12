const SYMBOLS = ['ACE', 'KING', 'QUEEN', 'JACK', 'SCATTER', 'WILD'];
const PAYOUTS = {
  ACE: 20,
  KING: 12,
  QUEEN: 10,
  JACK: 8,
  SCATTER: 5,
  WILD: 15
};

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function spinGrid() {
  return Array.from({ length: 4 }, () =>
    Array.from({ length: 5 }, () => randomSymbol())
  );
}

function countSymbol(grid, symbol) {
  return grid.flat().filter((s) => s === symbol).length;
}

function evaluateSpin(grid, bet = 1, multiplier = 1, jackpotThreshold = 100) {
  const flat = grid.flat();
  const symbolCounts = Object.fromEntries(SYMBOLS.map((symbol) => [symbol, 0]));

  for (const symbol of flat) {
    symbolCounts[symbol] += 1;
  }

  let baseWin = 0;
  for (const [symbol, count] of Object.entries(symbolCounts)) {
    if (count >= 3) {
      baseWin += PAYOUTS[symbol] * (count - 2);
    }
  }

  const totalWin = Number((baseWin * bet * multiplier).toFixed(4));
  const scatterCount = symbolCounts.SCATTER;

  return {
    baseWin,
    totalWin,
    scatterCount,
    freeSpinsTriggered: scatterCount >= 3,
    isJackpot: totalWin >= jackpotThreshold,
    symbolCounts
  };
}

module.exports = {
  SYMBOLS,
  PAYOUTS,
  spinGrid,
  countSymbol,
  evaluateSpin
};
