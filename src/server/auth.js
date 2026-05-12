const crypto = require('node:crypto');

const DEFAULT_ADMIN_EMAIL = 'admin@admin.com';
const DEFAULT_ADMIN_PASSWORD = 'admin123';
const DEFAULT_SECRET = 'scatter-secret';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
const SECRET = process.env.ADMIN_SECRET || DEFAULT_SECRET;

function enforceSecureProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;

  if (
    ADMIN_EMAIL === DEFAULT_ADMIN_EMAIL ||
    ADMIN_PASSWORD === DEFAULT_ADMIN_PASSWORD ||
    SECRET === DEFAULT_SECRET
  ) {
    throw new Error(
      'Production requires ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_SECRET to be set securely.'
    );
  }
}

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
  enforceSecureProductionConfig();
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) return null;
  return sign({ role: 'admin', email, issuedAt: Date.now() });
}

module.exports = { login, verify };
