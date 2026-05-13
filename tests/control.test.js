const test = require('node:test');
const assert = require('node:assert/strict');
const { updateRtpOverride, evaluateRtp, updateHouseFeeBps } = require('../src/server/control');

test('rtp override applies', () => {
  updateRtpOverride(94.5);
  const result = evaluateRtp({ roomId: 'x', rollingProfit: 1 });
  assert.equal(result.targetRtp, 94.5);
  updateRtpOverride(null);
});

test('house fee update validates range', () => {
  updateHouseFeeBps(300);
  assert.throws(() => updateHouseFeeBps(1200));
});
