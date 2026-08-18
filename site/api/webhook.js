/**
 * Lemon Squeezy webhook receiver.
 *
 * Verifies the signature over the RAW body, then hands the entitlement off to
 * the VSN licensing service. Licence generation happens there, never here and
 * never in the browser. This endpoint is deliberately outside the live
 * graphics/playout path.
 *
 * Environment:
 *   LEMONSQUEEZY_WEBHOOK_SECRET  (secret)
 *   LICENSING_SERVICE_URL
 *   LICENSING_SERVICE_TOKEN      (secret)
 */

const crypto = require('crypto');

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('webhook secret not configured');
    res.statusCode = 500;
    return res.end('Not configured');
  }

  const raw = await readRaw(req);
  const expected = crypto.createHmac('sha256', secret).update(raw).digest();
  const got = Buffer.from(String(req.headers['x-signature'] || ''), 'hex');

  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) {
    res.statusCode = 401;
    return res.end('Invalid signature');
  }

  let event;
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    res.statusCode = 400;
    return res.end('Bad payload');
  }

  const name = event?.meta?.event_name;
  const plan = event?.meta?.custom_data?.plan || null;

  // Entitlement changes we care about. Anything else is acknowledged and ignored.
  const RELEVANT = new Set([
    'order_created',
    'subscription_created', 'subscription_updated',
    'subscription_cancelled', 'subscription_expired',
    'subscription_payment_success', 'subscription_payment_failed',
  ]);

  if (RELEVANT.has(name)) {
    const url = process.env.LICENSING_SERVICE_URL;
    const token = process.env.LICENSING_SERVICE_TOKEN;
    if (url && token) {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ event: name, plan, payload: event }),
        });
      } catch (err) {
        // Acknowledge to the provider and let its retry policy handle transport failures.
        console.error('licensing service handoff failed', name, err);
      }
    } else {
      console.warn('licensing service not configured; skipped handoff for', name);
    }
  }

  res.statusCode = 200;
  return res.end('ok');
};

module.exports.config = { api: { bodyParser: false } };
