const test = require('node:test');
const assert = require('node:assert/strict');
const { login, verify } = require('../src/server/auth');

test('admin login and token verify', () => {
  const token = login('admin@admin.com', 'admin123');
  assert.ok(token);

  const payload = verify(token);
  assert.equal(payload.role, 'admin');
});

test('invalid token returns null', () => {
  assert.equal(verify('not-a-token'), null);
});
