const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

class AdaptiveRtpEngine {
  constructor({ minRtp = 90, maxRtp = 98, defaultRtp = 95 } = {}) {
    this.minRtp = minRtp;
    this.maxRtp = maxRtp;
    this.defaultRtp = clamp(defaultRtp, minRtp, maxRtp);
    this.roomState = new Map();
  }

  evaluate({ roomId = 'default', rollingProfit = 0, volatilityIndex = 0.5, jackpotPressure = 0.5 }) {
    const prev = this.roomState.get(roomId) ?? this.defaultRtp;

    const profitBias = clamp(rollingProfit / 100, -2, 2);
    const volatilityBias = clamp((0.5 - volatilityIndex) * 3, -1.5, 1.5);
    const jackpotBias = clamp((0.5 - jackpotPressure) * 1.5, -1, 1);

    const target = prev + profitBias + volatilityBias + jackpotBias;
    const bounded = Number(clamp(target, this.minRtp, this.maxRtp).toFixed(2));

    this.roomState.set(roomId, bounded);

    return {
      roomId,
      targetRtp: bounded,
      floor: this.minRtp,
      ceiling: this.maxRtp,
      reasoning: {
        profitBias,
        volatilityBias,
        jackpotBias,
      },
    };
  }
}

module.exports = {
  AdaptiveRtpEngine,
};
