const { spinGrid } = require('../engine/slotEngine');
const { evaluateRtp } = require('../server/control');

function executeSpin({ userId, roomId = 'default', betSol, commitReveal, telemetry = {} }) {
  const rtp = evaluateRtp({
    roomId,
    rollingProfit: telemetry.rollingProfit ?? 0,
    volatilityIndex: telemetry.volatilityIndex ?? 0.5,
    jackpotPressure: telemetry.jackpotPressure ?? 0.5,
  });

  const result = spinGrid({
    betSol,
    commitReveal,
    rtpTarget: rtp.targetRtp,
  });

  return {
    ...result,
    userId,
    roomId,
    rtp,
  };
}

module.exports = { executeSpin };
