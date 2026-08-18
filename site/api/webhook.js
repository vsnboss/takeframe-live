/**
 * Revolut Merchant webhook -> TAKEFRAME commercial source of truth.
 *
 * Browser redirects never grant entitlement. Every relevant delivery is first
 * signature-verified, then atomically claimed in webhook_events. Authoritative
 * order/subscription state is re-read from Revolut before local state changes.
 */

const crypto = require('crypto');
const db = require('./_lib/supabase');
const revolut = require('./_lib/revolut');
const revolutWebhooks = require('./_lib/revolut-webhooks');

const SIGNATURE_VERSION = 'v1';
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

const ORDER_EVENTS = new Set([
  'ORDER_AUTHORISED',
  'ORDER_COMPLETED',
  'ORDER_CANCELLED',
  'ORDER_FAILED',
  'ORDER_PAYMENT_DECLINED',
  'ORDER_PAYMENT_FAILED',
]);

const SUBSCRIPTION_EVENTS = new Set([
  'SUBSCRIPTION_INITIATED',
  'SUBSCRIPTION_FINISHED',
  'SUBSCRIPTION_CANCELLED',
  'SUBSCRIPTION_OVERDUE',
]);

const RELEVANT_EVENTS = new Set([...ORDER_EVENTS, ...SUBSCRIPTION_EVENTS]);

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
  if (!Number.isFinite(timestampMs)) return { ok: false, reason: 'invalid-timestamp' };
  if (Math.abs(now - timestampMs) > MAX_TIMESTAMP_SKEW_MS) {
    return { ok: false, reason: 'stale-timestamp' };
  }

  const payloadToSign = `${SIGNATURE_VERSION}.${timestamp}.${rawBody.toString('utf8')}`;
  const digest = crypto.createHmac('sha256', secret).update(payloadToSign, 'utf8').digest('hex');
  const expected = `${SIGNATURE_VERSION}=${digest}`;
  const matched = parseV1Signatures(signatureHeader)
    .some((signature) => timingSafeStringEqual(signature, expected));

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
  return crypto
    .createHash('sha256')
    .update(String(event && event.event || 'UNKNOWN'), 'utf8')
    .update('\n', 'utf8')
    .update(String(objectIdFor(event) || 'NO_OBJECT_ID'), 'utf8')
    .update('\n', 'utf8')
    .update(rawBody)
    .digest('hex');
}

function subscriptionPlanFrom(reference, existing) {
  if (existing && (existing.plan === 'monthly' || existing.plan === 'annual')) return existing.plan;
  const value = String(reference || '');
  if (value.startsWith('tf-sub-monthly-')) return 'monthly';
  if (value.startsWith('tf-sub-annual-')) return 'annual';
  return null;
}

function orderPlanFrom(order, existing) {
  if (existing && existing.plan) return existing.plan;
  if (order && order.metadata && order.metadata.plan) return order.metadata.plan;
  if (String(order && order.merchant_order_ext_ref || '').startsWith('tf-mp-')) return 'match-pass';
  return null;
}

async function syncCustomer(revolutCustomerId) {
  if (!revolutCustomerId) return null;
  const remote = await revolut.retrieveCustomer(revolutCustomerId);
  const email = String(remote.email || '').trim().toLowerCase();
  if (!email) return db.selectOne('customers', { revolut_customer_id: revolutCustomerId });
  return db.upsert('customers', {
    email,
    revolut_customer_id: remote.id,
    status: 'active',
  }, 'email');
}

async function syncOrder(orderId) {
  const remote = await revolut.retrieveOrder(orderId);
  const existing = await db.selectOne('orders', { provider_order_id: remote.id });
  let customerId = existing && existing.customer_id;
  const revolutCustomerId = remote.customer_id || (remote.customer && remote.customer.id) || null;
  if (revolutCustomerId) {
    const customer = await syncCustomer(revolutCustomerId);
    if (customer) customerId = customer.id;
  }

  const plan = orderPlanFrom(remote, existing);
  const externalReference = remote.merchant_order_ext_ref || (existing && existing.external_reference) || null;
  const completed = remote.state === 'completed';
  const localOrder = await db.upsert('orders', {
    customer_id: customerId || null,
    provider: 'revolut',
    provider_order_id: remote.id,
    external_reference: externalReference,
    plan,
    amount_cents: Number.isInteger(remote.amount) ? remote.amount : (existing && existing.amount_cents) || null,
    currency: remote.currency || (existing && existing.currency) || null,
    status: remote.state || 'pending',
    paid_at: completed ? (remote.updated_at || new Date().toISOString()) : (existing && existing.paid_at) || null,
    provider_payload: remote,
  }, 'provider_order_id');

  if (completed && plan === 'match-pass') {
    if (!localOrder.customer_id) throw new Error(`Completed Match Pass order ${remote.id} has no TAKEFRAME customer`);
    const credit = await db.upsert('match_passes', {
      customer_id: localOrder.customer_id,
      source_order_id: localOrder.id,
      status: 'unused',
      match_id: null,
      activated_at: null,
      expires_at: null,
      consumed_at: null,
    }, 'source_order_id');
    await db.insert('audit_events', {
      actor_type: 'revolut_webhook',
      actor_id: remote.id,
      action: 'match_pass.credit_created',
      entity_type: 'match_pass',
      entity_id: credit.id,
      data: { order_id: localOrder.id, provider_order_id: remote.id },
    });
  }
  return localOrder;
}

function localLicenseState(subscriptionState, paidThrough) {
  const paidUntilMs = paidThrough ? Date.parse(paidThrough) : NaN;
  const stillPaid = Number.isFinite(paidUntilMs) && paidUntilMs > Date.now();
  if (subscriptionState === 'active' || subscriptionState === 'pending') return 'active';
  if ((subscriptionState === 'cancelled' || subscriptionState === 'finished') && stillPaid) return 'active';
  if (subscriptionState === 'overdue') return stillPaid ? 'active' : 'grace';
  return stillPaid ? 'active' : 'expired';
}

async function syncSubscription(subscriptionId) {
  const remote = await revolut.retrieveSubscription(subscriptionId);
  const existing = await db.selectOne('subscriptions', { provider_subscription_id: remote.id });
  const plan = subscriptionPlanFrom(remote.external_reference, existing);
  if (!plan) throw new Error(`Cannot resolve TAKEFRAME plan for subscription ${remote.id}`);

  let localCustomer = null;
  if (remote.customer_id) localCustomer = await syncCustomer(remote.customer_id);
  if (!localCustomer && existing && existing.customer_id) {
    localCustomer = await db.selectOne('customers', { id: existing.customer_id });
  }
  if (!localCustomer) throw new Error(`Subscription ${remote.id} has no TAKEFRAME customer`);

  let cycle = null;
  if (remote.current_cycle_id) {
    try {
      cycle = await revolut.retrieveCurrentCycle(remote);
    } catch (error) {
      console.warn('could not retrieve subscription cycle', remote.id, error.message);
    }
  }
  const paidThrough = cycle && cycle.end_date ? cycle.end_date : (existing && existing.paid_through) || null;
  const localSubscription = await db.upsert('subscriptions', {
    customer_id: localCustomer.id,
    provider: 'revolut',
    provider_subscription_id: remote.id,
    provider_plan_id: remote.plan_id || (existing && existing.provider_plan_id) || null,
    provider_variation_id: remote.plan_variation_id || (existing && existing.provider_variation_id) || null,
    setup_order_id: remote.setup_order_id || (existing && existing.setup_order_id) || null,
    external_reference: remote.external_reference || (existing && existing.external_reference) || null,
    plan,
    status: remote.state,
    start_date: remote.start_date || null,
    paid_through: paidThrough,
    cancelled_at: remote.state === 'cancelled' ? (remote.updated_at || new Date().toISOString()) : (existing && existing.cancelled_at) || null,
    provider_payload: cycle ? { subscription: remote, current_cycle: cycle } : remote,
  }, 'provider_subscription_id');

  const desiredLicenseState = localLicenseState(remote.state, paidThrough);
  const existingLicense = await db.selectOne('licenses', { subscription_id: localSubscription.id });
  const licenseValues = {
    customer_id: localCustomer.id,
    subscription_id: localSubscription.id,
    kind: 'subscription',
    plan,
    status: desiredLicenseState,
    max_devices: 2,
    max_concurrent_productions: 1,
    clean_output: true,
    watermark_mode: 'none',
    valid_from: remote.start_date || (existingLicense && existingLicense.valid_from) || new Date().toISOString(),
    valid_until: paidThrough,
  };
  const license = existingLicense
    ? (await db.patch('licenses', { id: existingLicense.id }, licenseValues))[0]
    : await db.insert('licenses', licenseValues);

  await db.insert('audit_events', {
    actor_type: 'revolut_webhook',
    actor_id: remote.id,
    action: `subscription.${remote.state}`,
    entity_type: 'license',
    entity_id: license && license.id,
    data: { subscription_id: localSubscription.id, paid_through: paidThrough, licence_status: desiredLicenseState },
  });
  return localSubscription;
}

async function processCommercialEvent(event) {
  if (ORDER_EVENTS.has(event.event)) {
    if (!event.order_id) throw new Error(`${event.event} missing order_id`);
    await syncOrder(event.order_id);
    return 'processed';
  }
  if (SUBSCRIPTION_EVENTS.has(event.event)) {
    if (!event.subscription_id) throw new Error(`${event.event} missing subscription_id`);
    await syncSubscription(event.subscription_id);
    return 'processed';
  }
  return 'ignored';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end('Method Not Allowed');
  }

  let secret;
  try {
    secret = await revolutWebhooks.signingSecret();
  } catch (error) {
    console.error('Revolut webhook signing secret unavailable', error);
    res.statusCode = 503;
    return res.end('Webhook not configured');
  }

  let rawBody;
  try {
    rawBody = await readRaw(req);
  } catch {
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
  if (!RELEVANT_EVENTS.has(eventName)) {
    res.statusCode = 204;
    return res.end();
  }

  const eventKey = eventKeyFor(event, rawBody);
  let eventId = null;
  try {
    const claimRows = await db.rpc('claim_webhook_event', {
      p_event_key: eventKey,
      p_event_type: eventName,
      p_provider_object_id: objectIdFor(event),
      p_external_reference: event.merchant_order_ext_ref || null,
      p_payload: event,
    });
    const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
    if (!claim || !claim.event_id) throw new Error('Webhook event claim returned no id');
    eventId = claim.event_id;
    if (!claim.should_process) {
      res.statusCode = 204;
      return res.end();
    }

    const status = await processCommercialEvent(event);
    await db.rpc('finish_webhook_event', { p_event_id: eventId, p_status: status, p_error: null });
    res.statusCode = 204;
    return res.end();
  } catch (error) {
    console.error('TAKEFRAME commercial webhook processing failed', eventName, error);
    if (eventId) {
      try {
        await db.rpc('finish_webhook_event', {
          p_event_id: eventId,
          p_status: 'failed',
          p_error: String(error && error.message || error).slice(0, 2000),
        });
      } catch (finishError) {
        console.error('failed to mark webhook event failed', finishError);
      }
    }
    res.statusCode = 500;
    return res.end('Commercial sync failed');
  }
};

module.exports.config = { api: { bodyParser: false } };

module.exports._test = {
  MAX_TIMESTAMP_SKEW_MS,
  RELEVANT_EVENTS,
  eventKeyFor,
  localLicenseState,
  objectIdFor,
  orderPlanFrom,
  parseV1Signatures,
  subscriptionPlanFrom,
  timingSafeStringEqual,
  verifyRevolutSignature,
};
