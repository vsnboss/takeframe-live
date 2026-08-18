const crypto = require('crypto');
const db = require('./_lib/supabase');
const revolut = require('./_lib/revolut');

const PLAN_NAME = 'TAKEFRAME SUBSCRIPTION';
const PLAN_CONFIG = {
  annual: { cycle: 'P1Y', amount: 169000 },
  monthly: { cycle: 'P1M', amount: 16900 },
};

function originFor(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

function redirect(res, location) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  return res.end();
}

async function findCustomerByEmail(email) {
  let token = null;
  do {
    const params = new URLSearchParams({ limit: '100' });
    if (token) params.set('page_token', token);
    const page = await revolut.request(`/customers?${params.toString()}`);
    const customer = (page.customers || []).find((item) =>
      String(item.email || '').toLowerCase() === email.toLowerCase());
    if (customer) return customer;
    token = page.next_page_token || null;
  } while (token);
  return null;
}

async function getOrCreateRevolutCustomer(email) {
  const existing = await findCustomerByEmail(email);
  if (existing) return existing;
  return revolut.request('/customers', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

async function syncLocalCustomer(customer, email) {
  return db.upsert('customers', {
    email: email.toLowerCase(),
    revolut_customer_id: customer.id,
    status: 'active',
  }, 'email');
}

function variationFor(plan, config) {
  return (plan.variations || []).find((variation) =>
    (variation.phases || []).some((phase) =>
      phase.cycle_duration === config.cycle &&
      Number(phase.amount) === config.amount &&
      phase.currency === 'EUR'));
}

async function getOrCreateTakeframePlan() {
  let token = null;
  do {
    const params = new URLSearchParams({ limit: '100' });
    if (token) params.set('page_token', token);
    const page = await revolut.request(`/subscription-plans?${params.toString()}`);
    const existing = (page.subscription_plans || []).find((item) => item.name === PLAN_NAME);
    if (existing) return existing;
    token = page.next_page_token || null;
  } while (token);

  return revolut.request('/subscription-plans', {
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

async function createSubscriptionCheckout({ planKey, email, customer, localCustomer, origin }) {
  const config = PLAN_CONFIG[planKey];
  const subscriptionPlan = await getOrCreateTakeframePlan();
  const variation = variationFor(subscriptionPlan, config);
  if (!variation) throw new Error(`TAKEFRAME subscription plan is missing ${planKey} variation`);

  const externalReference = `tf-sub-${planKey}-${crypto.randomUUID()}`;
  const subscription = await revolut.request('/subscriptions', {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({
      plan_variation_id: variation.id,
      customer_id: customer.id,
      setup_order_redirect_url: `${origin}/welcome?plan=${encodeURIComponent(planKey)}`,
      external_reference: externalReference,
    }),
  });

  await db.upsert('subscriptions', {
    customer_id: localCustomer.id,
    provider: 'revolut',
    provider_subscription_id: subscription.id,
    provider_plan_id: subscription.plan_id || subscriptionPlan.id,
    provider_variation_id: subscription.plan_variation_id || variation.id,
    setup_order_id: subscription.setup_order_id || null,
    external_reference: externalReference,
    plan: planKey,
    status: subscription.state || 'pending',
    start_date: subscription.start_date || null,
    provider_payload: subscription,
  }, 'provider_subscription_id');

  if (!subscription.setup_order_id) throw new Error('Subscription response missing setup_order_id');
  const setupOrder = await revolut.retrieveOrder(subscription.setup_order_id);
  if (!setupOrder.checkout_url) throw new Error('Setup order response missing checkout_url');
  return setupOrder.checkout_url;
}

async function createMatchPassCheckout({ customer, localCustomer, origin }) {
  const externalReference = `tf-mp-${crypto.randomUUID()}`;
  const order = await revolut.request('/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({
      amount: 7900,
      currency: 'EUR',
      customer_id: customer.id,
      merchant_order_ext_ref: externalReference,
      description: 'TAKEFRAME Match Pass',
      redirect_url: `${origin}/welcome?plan=match-pass`,
      metadata: { product: 'takeframe', plan: 'match-pass' },
    }),
  });

  await db.upsert('orders', {
    customer_id: localCustomer.id,
    provider: 'revolut',
    provider_order_id: order.id,
    external_reference: externalReference,
    plan: 'match-pass',
    amount_cents: 7900,
    currency: 'EUR',
    status: order.state || 'pending',
    provider_payload: order,
  }, 'provider_order_id');

  if (!order.checkout_url) throw new Error('Revolut order response missing checkout_url');
  return order.checkout_url;
}

async function readForm(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  try {
    const form = await readForm(req);
    const planKey = String(form.get('plan') || '').toLowerCase();
    const email = String(form.get('email') || '').trim().toLowerCase();

    if (!PLAN_CONFIG[planKey] && planKey !== 'match-pass') {
      return redirect(res, '/pricing?checkout=unknown-plan');
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return redirect(res, `/subscribe?plan=${encodeURIComponent(planKey)}&error=email`);
    }

    const customer = await getOrCreateRevolutCustomer(email);
    const localCustomer = await syncLocalCustomer(customer, email);
    const origin = originFor(req);

    const checkoutUrl = planKey === 'match-pass'
      ? await createMatchPassCheckout({ customer, localCustomer, origin })
      : await createSubscriptionCheckout({ planKey, email, customer, localCustomer, origin });

    return redirect(res, checkoutUrl);
  } catch (error) {
    console.error('TAKEFRAME commercial checkout error', error);
    return redirect(res, '/pricing?checkout=error');
  }
};

module.exports.config = { api: { bodyParser: false } };
