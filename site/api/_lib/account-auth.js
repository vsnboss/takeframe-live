const db = require('./supabase');
const { httpError } = require('./http');

const ACCESS_COOKIE = 'tf_access';
const REFRESH_COOKIE = 'tf_refresh';

function config() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new Error('Supabase auth is not configured');
  return { url, key };
}

function authHeaders(key, accessToken) {
  const headers = { apikey: key };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (key.startsWith('eyJ')) {
    // Legacy service_role keys are JWTs. Modern sb_secret_* server keys are
    // API keys and must not be sent as Bearer JWTs.
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

async function authRequest(path, { method = 'GET', body, accessToken } = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/auth/v1${path}`, {
    method,
    headers: {
      ...authHeaders(key, accessToken),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = data && (data.msg || data.message || data.error_description || data.error) || `Auth request failed (${response.status})`;
    const error = new Error(String(message));
    error.status = response.status;
    throw error;
  }
  return data;
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw httpError(400, 'invalid_email', 'Enter a valid email address');
  return email;
}

function parseCookies(req) {
  const result = {};
  for (const item of String(req.headers.cookie || '').split(';')) {
    const index = item.indexOf('=');
    if (index <= 0) continue;
    result[item.slice(0, index).trim()] = decodeURIComponent(item.slice(index + 1).trim());
  }
  return result;
}

function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function setSessionCookies(res, session) {
  const accessAge = Math.max(60, Number(session.expires_in || 3600));
  res.setHeader('Set-Cookie', [
    cookie(ACCESS_COOKIE, session.access_token, accessAge),
    cookie(REFRESH_COOKIE, session.refresh_token, 60 * 60 * 24 * 30),
  ]);
  res.setHeader('Cache-Control', 'private, no-store');
}

function clearSessionCookies(res) {
  res.setHeader('Set-Cookie', [
    cookie(ACCESS_COOKIE, '', 0),
    cookie(REFRESH_COOKIE, '', 0),
  ]);
  res.setHeader('Cache-Control', 'private, no-store');
}

async function customerForEmail(email) {
  return db.selectOne('customers', { email: normalizeEmail(email) });
}

async function requestOtp(emailValue) {
  const email = normalizeEmail(emailValue);
  const customer = await customerForEmail(email);
  // Do not disclose whether an address has a TAKEFRAME account.
  if (!customer) return { accepted: true };

  await authRequest('/otp', {
    method: 'POST',
    body: { email, create_user: true },
  });
  return { accepted: true };
}

async function verifyOtp(emailValue, tokenValue, res) {
  const email = normalizeEmail(emailValue);
  const customer = await customerForEmail(email);
  if (!customer) throw httpError(401, 'invalid_login', 'Invalid or expired login code');
  const token = String(tokenValue || '').trim();
  if (!/^\d{6}$/.test(token)) throw httpError(400, 'invalid_code', 'Enter the six-digit login code');

  let session;
  try {
    session = await authRequest('/verify', {
      method: 'POST',
      body: { email, token, type: 'email' },
    });
  } catch {
    throw httpError(401, 'invalid_login', 'Invalid or expired login code');
  }
  if (!session || !session.access_token || !session.refresh_token) {
    throw new Error('Supabase Auth returned no session');
  }
  setSessionCookies(res, session);
  return { email, customerId: customer.id };
}

async function userForAccessToken(accessToken) {
  if (!accessToken) return null;
  try {
    return await authRequest('/user', { accessToken });
  } catch {
    return null;
  }
}

async function currentAccount(req, res) {
  const cookies = parseCookies(req);
  let accessToken = cookies[ACCESS_COOKIE];
  let user = await userForAccessToken(accessToken);

  if (!user && cookies[REFRESH_COOKIE]) {
    try {
      const session = await authRequest('/token?grant_type=refresh_token', {
        method: 'POST',
        body: { refresh_token: cookies[REFRESH_COOKIE] },
      });
      if (session && session.access_token) {
        setSessionCookies(res, session);
        accessToken = session.access_token;
        user = await userForAccessToken(accessToken);
      }
    } catch {
      clearSessionCookies(res);
    }
  }

  const email = user && String(user.email || '').trim().toLowerCase();
  if (!email) throw httpError(401, 'not_authenticated', 'Sign in to My TAKEFRAME');
  const customer = await customerForEmail(email);
  if (!customer) throw httpError(403, 'account_not_found', 'No TAKEFRAME commercial account is linked to this email');
  return { user, customer };
}

module.exports = {
  clearSessionCookies,
  currentAccount,
  normalizeEmail,
  requestOtp,
  setSessionCookies,
  verifyOtp,
};
