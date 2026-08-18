const crypto = require('crypto');

const API_VERSION = '2026-04-20';
const PLAN_NAME = 'TAKEFRAME SUBSCRIPTION';
const PLAN_CONFIG = {
  annual: { cycle: 'P1Y', amount: 169000 },
  monthly: { cycle: 'P1M', amount: 16900 },
};

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

async function api(secret, path, options = {}) {
  const response = await fetch(`${revolutBaseUrl()}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${secret}`,
      'Revolut-Api-Version': API_VERSION,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Revolut ${path} failed (${response.status}): ${body.slice(0, 500)}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function findCustomerByEmail(secret, email) {
  let token = null;
  do {
    const params = new URLSearchParams({ limit: '100' });
    if (token) params.set('page_token', token);
    const page = await api(secret, `/customers?${params.toString()}`);
    const customer = (page.customers || []).find((item) =>
      String(item.email || '').toLowerCase() === email.toLowerCase());
    if (customer) return customer;
    token = page.next_page_token || null;
  } while (token);
  return null;
}

async function getOrCreateCustomer(secret, email) {
  const existing = await findCustomerByEmail(secret, email);
  if (existing) return existing;
  return api(secret, '/customers', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

function variationFor(plan, config) {
  return (plan.variations || []).find((variation) =>
    (variation.phases || []).some((phase) =>
      phase.cycle_duration === config.cycle &&
      Number(phase.amount) === config.amount &&
      phase.currency === 'EUR'));
}

async function getOrCreateTakeframePlan(secret) {
  let token = null;
  do {
    const params = new URLSearchParams({ limit: '100' });
    if (token) params.set('page_token', token);
    const page = await api(secret, `/subscription-plans?${params.toString()}`);
    const existing = (page.subscription_plans || []).find((item) => item.name === PLAN_NAME);
    if (existing) return existing;
    token = page.next_page_token || null;
  } while (token);

  return api(secret, '/subscription-plans', {
    method: 'POST',
    body: JSON.stringify({
      name: PLAN_NAME,
      variations: [
        { phases: [{ ordinal: 1, cycle_duration: 'P1Y', amount: 169000, currency: 'EUR' }] },
        { phases: [{ ordinal: 1, cycle_duration: 'P1M', amount: 16900, currency: 'EUR' }] },
      ],
    }),
  });
}

async function readForm(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  const secret = process.env.REVOLUT_SECRET_KEY;
  if (!secret) return redirect(res, '/pricing?checkout=unavailable');

  try {
    const form = await readForm(req);
    const planKey = String(form.get('plan') || '').toLowerCase();
    const email = String(form.get('email') || '').trim().toLowerCase();
    const config = PLAN_CONFIG[planKey];

    if (!config) return redirect(res, '/pricing?checkout=unknown-plan');
    if (!/^\S+@\S+\.\S+$/.test(email)) return redirect(res, `/subscribe?plan=${planKey}&error=email`);

    const [customer, subscriptionPlan] = await Promise.all([
      getOrCreateCustomer(secret, email),
      getOrCreateTakeframePlan(secret),
    ]);

    const variation = variationFor(subscriptionPlan, config);
    if (!variation) throw new Error(`TAKEFRAME subscription plan is missing ${planKey} variation`);

    const origin = originFor(req);
    const subscription = await api(secret, '/subscriptions', {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({
        plan_variation_id: variation.id,
        customer_id: customer.id,
        setup_order_redirect_url: `${origin}/welcome?plan=${encodeURIComponent(planKey)}`,
        external_reference: `takeframe-${planKey}-${crypto.randomUUID()}`,
      }),
    });

    if (!subscription.setup_order_id) throw new Error('Subscription response missing setup_order_id');
    const setupOrder = await api(secret, `/orders/${encodeURIComponent(subscription.setup_order_id)}`);
    if (!setupOrder.checkout_url) throw new Error('Setup order response missing checkout_url');

    return redirect(res, setupOrder.checkout_url);
  } catch (error) {
    console.error('revolut subscription checkout error', error);
    return redirect(res, '/pricing?checkout=error');
  }
};

module.exports.config = { api: { bodyParser: false } };
