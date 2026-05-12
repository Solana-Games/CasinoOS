const crypto = require('node:crypto');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@admin.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SECRET = process.env.ADMIN_SECRET || 'scatter-secret';

function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  return `${data}.${sig}`;
}

function verify(token) {
  const [data, sig] = String(token).split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
}

function login(email, password) {
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) return null;
  return sign({ role: 'admin', email, issuedAt: Date.now() });
}

module.exports = { login, verify };
