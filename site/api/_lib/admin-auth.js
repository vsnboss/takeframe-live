const db = require('./supabase');
const auth = require('./account-auth');
const { httpError } = require('./http');

async function adminForEmail(emailValue) {
  const email = auth.normalizeEmail(emailValue);
  return db.selectOne('commerce_admins', { email, active: true });
}

async function requestOtp(emailValue) {
  const email = auth.normalizeEmail(emailValue);
  const admin = await adminForEmail(email);
  // Do not disclose whether an address is an administrator.
  if (!admin) return { accepted: true };
  await auth.requestOtpSession(email);
  return { accepted: true };
}

async function verifyOtp(emailValue, tokenValue, res) {
  const email = auth.normalizeEmail(emailValue);
  const admin = await adminForEmail(email);
  if (!admin) throw httpError(401, 'invalid_login', 'Invalid or expired login code');
  await auth.verifyOtpSession(email, tokenValue, res);
  return { email };
}

async function currentAdmin(req, res) {
  const user = await auth.currentUser(req, res);
  const email = String(user.email || '').trim().toLowerCase();
  if (!email) throw httpError(401, 'not_authenticated', 'Sign in to TAKEFRAME Commerce Admin');
  const admin = await adminForEmail(email);
  if (!admin) throw httpError(403, 'not_admin', 'Commerce Admin access required');
  return { user, admin };
}

function requireSameOrigin(req) {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) throw httpError(403, 'origin_required', 'Same-origin request required');
  let parsed;
  try { parsed = new URL(origin); } catch { throw httpError(403, 'invalid_origin', 'Invalid request origin'); }
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  if (!host || parsed.host.toLowerCase() !== host) {
    throw httpError(403, 'invalid_origin', 'Cross-origin request rejected');
  }
}

module.exports = { adminForEmail, currentAdmin, requestOtp, requireSameOrigin, verifyOtp };
