const games = new Map();

function registerGame(id, game) {
  if (!id || typeof id !== 'string') throw new Error('game id is required');
  if (!game || typeof game.spin !== 'function') throw new Error('game.spin is required');
  games.set(id, game);
  return game;
}

function getGame(id) {
  return games.get(id);
}

function listGames() {
  return Array.from(games.keys()).map((id) => ({ id, enabled: games.get(id).enabled !== false }));
}

function toggleGame(id, enabled) {
  const game = games.get(id);
  if (!game) throw new Error(`Unknown game: ${id}`);
  game.enabled = enabled;
  return game;
}

module.exports = {
  registerGame,
  getGame,
  listGames,
  toggleGame,
};
