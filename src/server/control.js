const { getRTP, setRTP } = require('../ai/rtpEngine');
const { gameRegistry } = require('../games/registry');

function getControlSnapshot() {
  return {
    status: 'active',
    rtp: getRTP(),
    games: Object.keys(gameRegistry),
    timestamp: new Date().toISOString()
  };
}

function overrideRTP(nextRtp) {
  return {
    rtp: setRTP(nextRtp),
    overridden: true
  };
}

module.exports = { getControlSnapshot, overrideRTP };
