const crypto = require('crypto');
const db = require('./supabase');

const SIGNATURE_TOLERANCE_SECONDS = 300;
const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
];

function webhookUrl() {
  return 'https://takeframe.live/api/stripe-webhook';
}

async function storedConfig() {
  const rows = await db.rpc('get_stripe_webhook_config');
  return Array.isArray(rows) ? rows[0] || null : rows || null;
}

async function signingSecret() {
  const config = await storedConfig();
  if (!config || !config.signing_secret) throw new Error('Stripe webhook signing secret is not configured');
  if (config.environment !== 'production') throw new Error('Stripe webhook environment mismatch');
  return config.signing_secret;
}

function parseSignatureHeader(header) {
  const values = String(header || '').split(',').map((value) => value.trim());
  let timestamp = null;
  const signatures = [];
  for (const value of values) {
    const index = value.indexOf('=');
    if (index < 1) continue;
    const key = value.slice(0, index);
    const val = value.slice(index + 1);
    if (key === 't') timestamp = val;
    if (key === 'v1') signatures.push(val);
  }
  return { timestamp, signatures };
}

function timingSafeEqualHex(left, right) {
  const a = Buffer.from(String(left), 'hex');
  const b = Buffer.from(String(right), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifySignature({ secret, signatureHeader, rawBody, nowSeconds = Math.floor(Date.now() / 1000) }) {
  if (!secret || !signatureHeader || !Buffer.isBuffer(rawBody)) return { ok: false, reason: 'missing-verification-input' };
  const parsed = parseSignatureHeader(signatureHeader);
  const timestamp = Number(parsed.timestamp);
  if (!Number.isFinite(timestamp)) return { ok: false, reason: 'invalid-timestamp' };
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return { ok: false, reason: 'stale-timestamp' };
  const digest = crypto.createHmac('sha256', secret)
    .update(`${parsed.timestamp}.${rawBody.toString('utf8')}`, 'utf8')
    .digest('hex');
  return parsed.signatures.some((signature) => timingSafeEqualHex(signature, digest))
    ? { ok: true }
    : { ok: false, reason: 'signature-mismatch' };
}

module.exports = {
  WEBHOOK_EVENTS,
  signingSecret,
  verifySignature,
  webhookUrl,
};
