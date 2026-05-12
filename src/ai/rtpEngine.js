let rtp = 96;

function clampRtp(value) {
  return Math.max(90, Math.min(98, Number(value.toFixed(2))));
}

function adjustRTP(metrics = {}) {
  const { profitDelta = 0, retentionDelta = 0, volatilityDelta = 0 } = metrics;

  if (profitDelta > 0) rtp -= 0.2;
  if (retentionDelta < 0) rtp += 0.35;

  if (Math.abs(volatilityDelta) > 0.7) {
    rtp -= 0.15;
  }

  rtp = clampRtp(rtp);
  return rtp;
}

function setRTP(next) {
  rtp = clampRtp(next);
  return rtp;
}

function getRTP() {
  return rtp;
}

module.exports = { adjustRTP, setRTP, getRTP };
