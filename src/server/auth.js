const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || '';
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'local-development-secret';

function assertRuntimeSecret() {
  if (process.env.NODE_ENV === 'production' && !JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in production');
  }
}

function nonceForWallet(wallet) {
  return crypto
    .createHash('sha256')
    .update(`${wallet}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`)
    .digest('hex')
    .slice(0, 16);
}

function issueAuthToken({ userId, wallet, role = 'player' }) {
  assertRuntimeSecret();
  return jwt.sign({ sub: userId, wallet, role }, EFFECTIVE_JWT_SECRET, { expiresIn: '12h', issuer: 'casinoos' });
}

function verifyAuthToken(token) {
  assertRuntimeSecret();
  return jwt.verify(token, EFFECTIVE_JWT_SECRET, { issuer: 'casinoos' });
}

function requireRole(token, role) {
  const payload = verifyAuthToken(token);
  if (payload.role !== role) throw new Error('forbidden');
  return payload;
}

module.exports = {
  nonceForWallet,
  issueAuthToken,
  verifyAuthToken,
  requireRole,
};
