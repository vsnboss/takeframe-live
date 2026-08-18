const crypto = require('crypto');
const db = require('./_lib/supabase');
const revolut = require('./_lib/revolut');
const revolutWebhooks = require('./_lib/revolut-webhooks');

const PLAN_NAME = 'TAKEFRAME SUBSCRIPTION';
const MATCH_PASS_LIST_AMOUNT = 7900;
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

async function upsertLocalCustomer(email, revolutCustomerId = null) {
  const row = { email: email.toLowerCase(), status: 'active' };
  if (revolutCustomerId) row.revolut_customer_id = revolutCustomerId;
  return db.upsert('customers', row, 'email');
}

async function provisionEvaluation(email) {
  const customer = await upsertLocalCustomer(email);
  const existing = await db.selectOne('licenses', { customer_id: customer.id, kind: 'evaluation' });
  if (existing) return existing;

  const validFrom = new Date();
  const validUntil = new Date(validFrom.getTime() + 7 * 24 * 60 * 60 * 1000);
  const license = await db.insert('licenses', {
    customer_id: customer.id,
    kind: 'evaluation',
    plan: 'evaluation',
    status: 'active',
    max_devices: 2,
    max_concurrent_productions: 1,
    clean_output: false,
    watermark_mode: 'evaluation',
    valid_from: validFrom.toISOString(),
    valid_until: validUntil.toISOString(),
  });

  await db.insert('audit_events', {
    actor_type: 'system',
    action: 'evaluation.created',
    entity_type: 'license',
    entity_id: license.id,
    data: { customer_id: customer.id, valid_until: validUntil.toISOString() },
  });
  return license;
}

function variationFor(plan, config) {
  return (plan.variations || []).find((variation) =>
    (variation.phases || []).some((phase) =>
      phase.cycle_duration === config.cycle &&
      Number(phase.amount) === config.amount &&
      phase.currency === 'EUR'));
}

function isExactTakeframePlan(plan) {
  return Boolean(
    plan &&
    plan.name === PLAN_NAME &&
    variationFor(plan, PLAN_CONFIG.monthly) &&
    variationFor(plan, PLAN_CONFIG.annual)
  );
}

async function findExactTakeframePlan() {
  let token = null;
  do {
    const params = new URLSearchParams({ limit: '100' });
    if (token) params.set('page_token', token);
    const page = await revolut.request(`/subscription-plans?${params.toString()}`);
    const exact = (page.subscription_plans || []).find(isExactTakeframePlan);
    if (exact) return exact;
    token = page.next_page_token || null;
  } while (token);
  return null;
}

async function getOrCreateTakeframePlan() {
  const existing = await findExactTakeframePlan();
  if (existing) return existing;

  const created = await revolut.request('/subscription-plans', {
    method: 'POST',
    body: JSON.stringify({
      name: PLAN_NAME,
      variations: [
        { phases: [{ ordinal: 1, cycle_duration: 'P1Y', amount: 169000, currency: 'EUR' }] },
        { phases: [{ ordinal: 1, cycle_duration: 'P1M', amount: 16900, currency: 'EUR' }] },
      ],
    }),
  });
  if (!isExactTakeframePlan(created)) throw new Error('Revolut created an unexpected TAKEFRAME subscription plan');
  return created;
}

async function createSubscriptionCheckout({ planKey, customer, localCustomer, origin }) {
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

function promoRow(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

async function reservePromotion(code, email) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return null;
  try {
    const reservation = promoRow(await db.rpc('reserve_promotion', {
      p_code: normalized,
      p_email: email,
      p_plan: 'match-pass',
      p_original_amount_cents: MATCH_PASS_LIST_AMOUNT,
      p_reservation_key: crypto.randomUUID(),
    }));
    if (!reservation || !reservation.redemption_id) throw new Error('Promotion reservation returned no id');
    return reservation;
  } catch (error) {
    const promoError = new Error('promotion_invalid');
    promoError.code = 'promotion_invalid';
    promoError.cause = error;
    throw promoError;
  }
}

async function releasePromotion(reservation) {
  if (!reservation || !reservation.redemption_id) return;
  try {
    await db.rpc('release_promotion_reservation', { p_redemption_id: reservation.redemption_id });
  } catch (error) {
    console.error('TAKEFRAME promotion release failed', error);
  }
}

async function createMatchPassCheckout({ customer, localCustomer, origin, promotion }) {
  const externalReference = `tf-mp-${crypto.randomUUID()}`;
  const amount = promotion ? Number(promotion.final_amount_cents) : MATCH_PASS_LIST_AMOUNT;
  const discount = promotion ? Number(promotion.discount_cents) : 0;
  const promoCode = promotion ? promotion.promotion_code : null;

  const order = await revolut.request('/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({
      amount,
      currency: 'EUR',
      customer: { id: customer.id },
      merchant_order_data: { reference: externalReference },
      description: 'TAKEFRAME Match Pass',
      redirect_url: `${origin}/welcome?plan=match-pass`,
      metadata: {
        product: 'takeframe',
        plan: 'match-pass',
        ...(promoCode ? { promotion_code: promoCode } : {}),
      },
    }),
  });

  const localOrder = await db.upsert('orders', {
    customer_id: localCustomer.id,
    provider: 'revolut',
    provider_order_id: order.id,
    external_reference: externalReference,
    plan: 'match-pass',
    amount_cents: amount,
    list_amount_cents: MATCH_PASS_LIST_AMOUNT,
    discount_cents: discount,
    promotion_code: promoCode,
    currency: 'EUR',
    status: order.state || 'pending',
    provider_payload: order,
  }, 'provider_order_id');

  if (promotion) {
    await db.rpc('bind_promotion_redemption', {
      p_redemption_id: promotion.redemption_id,
      p_customer_id: localCustomer.id,
      p_order_id: localOrder.id,
      p_provider_order_id: order.id,
    });
  }

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

  let promotion = null;
  let planKey = '';
  try {
    const form = await readForm(req);
    planKey = String(form.get('plan') || '').toLowerCase();
    const email = String(form.get('email') || '').trim().toLowerCase();
    const promoCode = String(form.get('promo') || '').trim();

    if (!PLAN_CONFIG[planKey] && planKey !== 'match-pass' && planKey !== 'evaluation') {
      return redirect(res, '/pricing?checkout=unknown-plan');
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return redirect(res, `/subscribe?plan=${encodeURIComponent(planKey)}&error=email`);
    }
    if (promoCode && planKey !== 'match-pass') {
      return redirect(res, `/subscribe?plan=${encodeURIComponent(planKey)}&error=promo`);
    }

    if (planKey === 'evaluation') {
      await provisionEvaluation(email);
      return redirect(res, '/welcome?plan=evaluation');
    }

    if (planKey === 'match-pass' && promoCode) promotion = await reservePromotion(promoCode, email);

    const origin = originFor(req);
    await revolutWebhooks.ensureWebhook(origin);

    const customer = await getOrCreateRevolutCustomer(email);
    const localCustomer = await upsertLocalCustomer(email, customer.id);

    const checkoutUrl = planKey === 'match-pass'
      ? await createMatchPassCheckout({ customer, localCustomer, origin, promotion })
      : await createSubscriptionCheckout({ planKey, customer, localCustomer, origin });

    return redirect(res, checkoutUrl);
  } catch (error) {
    await releasePromotion(promotion);
    if (error && error.code === 'promotion_invalid') {
      return redirect(res, `/subscribe?plan=${encodeURIComponent(planKey || 'match-pass')}&error=promo`);
    }
    console.error('TAKEFRAME commercial checkout error', error);
    return redirect(res, '/pricing?checkout=error');
  }
};

module.exports.config = { api: { bodyParser: false } };
