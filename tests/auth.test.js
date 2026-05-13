const test = require('node:test');
const assert = require('node:assert/strict');
const { issueAuthToken, verifyAuthToken, nonceForWallet } = require('../src/server/auth');

test('token issue and verify', () => {
  const token = issueAuthToken({ userId: 'u1', wallet: 'wallet1', role: 'player' });
  const payload = verifyAuthToken(token);
  assert.equal(payload.wallet, 'wallet1');
});

test('wallet nonce generation', () => {
  const nonce = nonceForWallet('wallet1');
  assert.equal(typeof nonce, 'string');
  assert.equal(nonce.length, 16);
});
