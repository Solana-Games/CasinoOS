const { AdaptiveRtpEngine } = require('../ai/rtpEngine');
const { listGames, toggleGame } = require('../games/registry');

const rtpEngine = new AdaptiveRtpEngine();
const controlState = {
  houseFeeBps: 300,
  rtpOverride: null,
  jackpotRates: {
    grand: 1000,
    major: 250,
    minor: 50,
    mini: 10,
  },
};

function updateRtpOverride(value) {
  if (value === null) {
    controlState.rtpOverride = null;
    return controlState;
  }
  if (value < 90 || value > 98) throw new Error('RTP override must be between 90 and 98');
  controlState.rtpOverride = value;
  return controlState;
}

function evaluateRtp(input) {
  if (controlState.rtpOverride !== null) {
    return { targetRtp: controlState.rtpOverride, source: 'override' };
  }
  return { ...rtpEngine.evaluate(input), source: 'adaptive' };
}

function updateHouseFeeBps(feeBps) {
  if (feeBps < 0 || feeBps > 1000) throw new Error('Fee bps out of range');
  controlState.houseFeeBps = feeBps;
  return controlState;
}

function setJackpotTier(name, value) {
  if (!controlState.jackpotRates[name]) throw new Error('Unknown jackpot tier');
  if (value <= 0) throw new Error('Invalid jackpot amount');
  controlState.jackpotRates[name] = value;
  return controlState;
}

function getAdminSnapshot() {
  return {
    ...controlState,
    games: listGames(),
  };
}

function setGameEnabled(id, enabled) {
  return toggleGame(id, enabled);
}

module.exports = {
  updateRtpOverride,
  evaluateRtp,
  updateHouseFeeBps,
  setJackpotTier,
  setGameEnabled,
  getAdminSnapshot,
};
