const crypto = require('crypto');

const API_VERSION = '2026-04-20';
const PLANS = new Set(['annual', 'monthly', 'match-pass', 'evaluation']);

function revolutBaseUrl() {
  return process.env.REVOLUT_ENV === 'sandbox'
    ? 'https://sandbox-merchant.revolut.com/api'
    : 'https://merchant.revolut.com/api';
}

function originFor(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

function redirect(res, location) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  return res.end();
}

async function createMatchPassOrder(secret, origin) {
  const idempotencyKey = crypto.randomUUID();
  const response = await fetch(`${revolutBaseUrl()}/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secret}`,
      'Content-Type': 'application/json',
      'Revolut-Api-Version': API_VERSION,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      amount: 7900,
      currency: 'EUR',
      description: 'TAKEFRAME Match Pass',
      redirect_url: `${origin}/welcome?plan=match-pass`,
      metadata: {
        product: 'takeframe',
        plan: 'match-pass',
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Revolut order creation failed (${response.status}): ${body.slice(0, 500)}`);
  }

  const order = await response.json();
  if (!order.checkout_url) throw new Error('Revolut order response did not contain checkout_url');
  return order.checkout_url;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  const plan = String((req.query && req.query.plan) || '').toLowerCase();
  if (!PLANS.has(plan)) return redirect(res, '/pricing?checkout=unknown-plan');

  // Evaluation is intentionally not a payment flow. WP6 will provision the
  // TAKEFRAME account and seven-day evaluation licence before redirecting.
  if (plan === 'evaluation') return redirect(res, '/pricing?checkout=evaluation-pending');

  // Recurring plans require a Revolut customer and subscription. Keep the
  // public /api/checkout?plan=... contract, then collect account identity on a
  // dedicated hand-off page without changing the frozen pricing page.
  if (plan === 'annual' || plan === 'monthly') {
    return redirect(res, `/subscribe?plan=${encodeURIComponent(plan)}`);
  }

  const secret = process.env.REVOLUT_SECRET_KEY;
  if (!secret) return redirect(res, '/pricing?checkout=unavailable');

  try {
    const checkoutUrl = await createMatchPassOrder(secret, originFor(req));
    return redirect(res, checkoutUrl);
  } catch (error) {
    console.error('revolut checkout error', error);
    return redirect(res, '/pricing?checkout=error');
  }
};
