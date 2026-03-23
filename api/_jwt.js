const crypto = require('crypto');
const { jwt } = require('./config');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function b64(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function sign(payload) {
  const h = b64({ alg: 'HS256' });
  const p = b64({ ...payload, iat: Date.now(), exp: Date.now() + 7 * 86400000 });
  const s = crypto.createHmac('sha256', jwt.secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}

function verify(token) {
  try {
    const [h, p, s] = (token || '').split('.');
    const ok = crypto.createHmac('sha256', jwt.secret).update(`${h}.${p}`).digest('base64url');
    if (s !== ok) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function requireAuth(req) {
  const auth  = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) throw new Error('Unauthorized');
  const payload = verify(token);
  if (!payload) throw new Error('Token tidak valid atau expired');
  return payload;
}

module.exports = { sha256, sign, verify, requireAuth };
