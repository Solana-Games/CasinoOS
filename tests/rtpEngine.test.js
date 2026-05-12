const test = require('node:test');
const assert = require('node:assert/strict');
const { adjustRTP, setRTP, getRTP } = require('../src/ai/rtpEngine');

test('rtp adjusts based on profit and retention', () => {
  setRTP(96);
  const afterProfit = adjustRTP({ profitDelta: 500, retentionDelta: 0, volatilityDelta: 0 });
  assert.ok(afterProfit < 96);

  const afterRetentionDrop = adjustRTP({ profitDelta: 0, retentionDelta: -5, volatilityDelta: 0 });
  assert.ok(afterRetentionDrop > afterProfit);
  assert.ok(getRTP() <= 98);
  setRTP(96);
});
