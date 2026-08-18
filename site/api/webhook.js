/**
 * Revolut Merchant webhook receiver.
 *
 * WP3 responsibilities:
 * - read the exact raw request body
 * - reject stale/replayed requests outside Revolut's 5-minute tolerance
 * - verify Revolut-Signature using the webhook signing secret
 * - support multiple v1 signatures during signing-secret rotation
 * - derive a deterministic event key for durable idempotency in the commercial DB
 * - never grant an entitlement directly from a webhook/browser redirect
 *
 * Durable webhook_events persistence is connected in WP4. Until then this
 * endpoint has no commercial side effects, so duplicate verified deliveries are
 * harmless. The deterministic event key is the future DB idempotency key.
 *
 * Environment:
 *   REVOLUT_WEBHOOK_SIGNING_SECRET   (secret; returned when webhook is created)
 */

const crypto = require('crypto');

const SIGNATURE_VERSION = 'v1';
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

const RELEVANT_EVENTS = new Set([
  'ORDER_AUTHORISED',
  'ORDER_COMPLETED',
  'ORDER_CANCELLED',
  'ORDER_FAILED',
  'ORDER_PAYMENT_DECLINED',
  'ORDER_PAYMENT_FAILED',
  'SUBSCRIPTION_INITIATED',
  'SUBSCRIPTION_FINISHED',
  'SUBSCRIPTION_CANCELLED',
  'SUBSCRIPTION_OVERDUE',
]);

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function timingSafeStringEqual(left, right) {
  const a = Buffer.from(String(left), 'utf8');
  const b = Buffer.from(String(right), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseV1Signatures(header) {
  return String(header || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.startsWith(`${SIGNATURE_VERSION}=`));
}

function verifyRevolutSignature({ secret, timestamp, signatureHeader, rawBody, now = Date.now() }) {
  if (!secret || !timestamp || !signatureHeader || !Buffer.isBuffer(rawBody)) {
    return { ok: false, reason: 'missing-verification-input' };
  }

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs)) {
    return { ok: false, reason: 'invalid-timestamp' };
  }

  if (Math.abs(now - timestampMs) > MAX_TIMESTAMP_SKEW_MS) {
    return { ok: false, reason: 'stale-timestamp' };
  }

  const payloadToSign = `${SIGNATURE_VERSION}.${timestamp}.${rawBody.toString('utf8')}`;
  const digest = crypto
    .createHmac('sha256', secret)
    .update(payloadToSign, 'utf8')
    .digest('hex');
  const expected = `${SIGNATURE_VERSION}=${digest}`;

  const signatures = parseV1Signatures(signatureHeader);
  const matched = signatures.some((signature) => timingSafeStringEqual(signature, expected));
  return matched ? { ok: true } : { ok: false, reason: 'signature-mismatch' };
}

function objectIdFor(event) {
  return event && (
    event.order_id ||
    event.subscription_id ||
    event.payment_id ||
    event.payout_id ||
    event.dispute_id ||
    null
  );
}

function eventKeyFor(event, rawBody) {
  const name = String((event && event.event) || 'UNKNOWN');
  const objectId = String(objectIdFor(event) || 'NO_OBJECT_ID');
  return crypto
    .createHash('sha256')
    .update(name, 'utf8')
    .update('\n', 'utf8')
    .update(objectId, 'utf8')
    .update('\n', 'utf8')
    .update(rawBody)
    .digest('hex');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end('Method Not Allowed');
  }

  const secret = process.env.REVOLUT_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    console.error('REVOLUT_WEBHOOK_SIGNING_SECRET is not configured');
    res.statusCode = 503;
    return res.end('Webhook not configured');
  }

  let rawBody;
  try {
    rawBody = await readRaw(req);
  } catch (error) {
    console.error('failed to read Revolut webhook body', error);
    res.statusCode = 400;
    return res.end('Bad payload');
  }

  const verification = verifyRevolutSignature({
    secret,
    timestamp: req.headers['revolut-request-timestamp'],
    signatureHeader: req.headers['revolut-signature'],
    rawBody,
  });

  if (!verification.ok) {
    console.warn('rejected Revolut webhook', verification.reason);
    res.statusCode = 401;
    return res.end('Invalid webhook signature');
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    res.statusCode = 400;
    return res.end('Bad payload');
  }

  const eventName = String(event && event.event || '');
  if (!eventName) {
    res.statusCode = 400;
    return res.end('Missing event');
  }

  if (RELEVANT_EVENTS.has(eventName)) {
    const eventKey = eventKeyFor(event, rawBody);

    // WP4 persists this key with a UNIQUE constraint in webhook_events before
    // applying any commercial state change. Never infer entitlement here.
    console.log('verified Revolut commercial event', JSON.stringify({
      event: eventName,
      eventKey,
      objectId: objectIdFor(event),
      merchantOrderReference: event.merchant_order_ext_ref || null,
    }));
  }

  // Revolut recommends 204 for successful webhook delivery acknowledgement.
  res.statusCode = 204;
  return res.end();
};

module.exports.config = { api: { bodyParser: false } };

module.exports._test = {
  MAX_TIMESTAMP_SKEW_MS,
  RELEVANT_EVENTS,
  eventKeyFor,
  objectIdFor,
  parseV1Signatures,
  timingSafeStringEqual,
  verifyRevolutSignature,
};
