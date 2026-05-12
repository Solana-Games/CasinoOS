const crypto = require('node:crypto');

const DEFAULT_ADMIN_EMAIL = 'admin@admin.com';
const DEFAULT_ADMIN_PASSWORD = 'admin123';
const DEFAULT_SECRET = 'scatter-secret';
const DEFAULT_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
const SECRET = process.env.ADMIN_SECRET || DEFAULT_SECRET;
const TOKEN_TTL_MS = Number(process.env.ADMIN_TOKEN_TTL_MS || DEFAULT_TOKEN_TTL_MS);

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
  enforceSecureProductionConfig();
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  return `${data}.${signature}`;
}

function verify(token) {
  enforceSecureProductionConfig();
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;
  if (!/^[a-f0-9]{64}$/i.test(sig)) return null;

  const providedSignatureBuffer = Buffer.from(sig, 'hex');
  const expectedSignatureBuffer = crypto.createHmac('sha256', SECRET).update(data).digest();

  if (providedSignatureBuffer.length !== expectedSignatureBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (typeof payload?.exp === 'number' && Date.now() > payload.exp) return null;
  return payload;
}

function login(email, password) {
  enforceSecureProductionConfig();
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) return null;
  const issuedAt = Date.now();
  const exp = issuedAt + (Number.isFinite(TOKEN_TTL_MS) && TOKEN_TTL_MS > 0 ? TOKEN_TTL_MS : DEFAULT_TOKEN_TTL_MS);
  return sign({ role: 'admin', email, issuedAt, exp });
}

enforceSecureProductionConfig();

module.exports = { login, verify };
