const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function nonceForWallet(wallet) {
  return crypto.createHash('sha256').update(`${wallet}:${Date.now()}`).digest('hex').slice(0, 16);
}

function issueAuthToken({ userId, wallet, role = 'player' }) {
  return jwt.sign({ sub: userId, wallet, role }, JWT_SECRET, { expiresIn: '12h', issuer: 'casinoos' });
}

function verifyAuthToken(token) {
  return jwt.verify(token, JWT_SECRET, { issuer: 'casinoos' });
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
