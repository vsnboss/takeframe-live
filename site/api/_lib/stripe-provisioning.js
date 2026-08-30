const db = require('./supabase');
const stripe = require('./stripe');

function objectId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.id || null;
}

function epochIso(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  return new Date(value * 1000).toISOString();
}

function customerEmail(object) {
  return String(
    object && object.customer_details && object.customer_details.email ||
    object && object.customer_email ||
    object && object.email ||
    ''
  ).trim().toLowerCase();
}

function priceIdFromLine(line) {
  return objectId(line && line.price) ||
    objectId(line && line.pricing && line.pricing.price_details && line.pricing.price_details.price) ||
    objectId(line && line.plan) ||
    null;
}

function productIdFromLine(line) {
  const price = line && line.price;
  return objectId(price && price.product) ||
    objectId(line && line.pricing && line.pricing.price_details && line.pricing.price_details.product) ||
    null;
}

function subscriptionIdFromInvoice(invoice) {
  return objectId(invoice && invoice.subscription) ||
    objectId(invoice && invoice.parent && invoice.parent.subscription_details && invoice.parent.subscription_details.subscription) ||
    null;
}

async function mappingForPrice(priceId) {
  if (!priceId) throw new Error('Stripe object has no price id');
  const mapping = await db.selectOne('stripe_plan_mappings', { price_id: priceId, active: true });
  if (!mapping) throw new Error(`Stripe price ${priceId} is not authorised for TAKEFRAME licensing`);
  return mapping;
}

function assertMetadata(metadata, mapping, source) {
  const values = metadata || {};
  if (
    values.product !== 'takeframe' ||
    values.plan !== mapping.plan ||
    values.licensing_action !== mapping.licensing_action
  ) {
    throw new Error(`${source} metadata does not match TAKEFRAME licensing authority`);
  }
}

async function assertProduct(mapping) {
  const product = await stripe.retrieveProduct(mapping.product_id);
  if (!product || product.id !== mapping.product_id || !product.active) {
    throw new Error(`Stripe product ${mapping.product_id} is not active TAKEFRAME authority`);
  }
  assertMetadata(product.metadata, mapping, `Stripe product ${mapping.product_id}`);
  return product;
}

async function syncCustomer(stripeCustomerId, fallbackEmail) {
  let remote = null;
  if (stripeCustomerId) remote = await stripe.retrieveCustomer(stripeCustomerId);
  const email = customerEmail(remote) || String(fallbackEmail || '').trim().toLowerCase();
  if (!email) throw new Error('Stripe payment has no customer email');

  return db.upsert('customers', {
    email,
    stripe_customer_id: stripeCustomerId || (remote && remote.id) || null,
    status: 'active',
  }, 'email');
}

async function checkoutAuthority(session) {
  const items = await stripe.retrieveCheckoutSessionLineItems(session.id);
  const lines = Array.isArray(items && items.data) ? items.data : [];
  if (lines.length !== 1) throw new Error(`TAKEFRAME Checkout Session ${session.id} must contain exactly one line item`);
  const line = lines[0];
  const mapping = await mappingForPrice(priceIdFromLine(line));
  const productId = productIdFromLine(line) || objectId(line.price && line.price.product);
  if (productId && productId !== mapping.product_id) throw new Error('Stripe line-item product/price mapping mismatch');
  if (Number(line.quantity || 1) !== 1) throw new Error('TAKEFRAME public Stripe checkout requires quantity 1');
  await assertProduct(mapping);
  assertMetadata(session.metadata, mapping, `Checkout Session ${session.id}`);
  return { mapping, line };
}

async function provisionMatchPass(session) {
  if (session.payment_status !== 'paid') return { result: 'unpaid' };
  const { mapping } = await checkoutAuthority(session);
  if (mapping.plan !== 'match-pass' || mapping.licensing_action !== 'add_match_pass_credit') {
    throw new Error('Stripe Checkout Session is not a TAKEFRAME Match Pass purchase');
  }

  const stripeCustomerId = objectId(session.customer);
  const customer = await syncCustomer(stripeCustomerId, customerEmail(session));
  const existing = await db.selectOne('orders', { provider_order_id: session.id });
  const order = await db.upsert('orders', {
    customer_id: customer.id,
    provider: 'stripe',
    provider_order_id: session.id,
    external_reference: session.client_reference_id || (existing && existing.external_reference) || null,
    plan: 'match-pass',
    amount_cents: Number.isInteger(session.amount_total) ? session.amount_total : Number(mapping.amount_cents),
    currency: String(session.currency || mapping.currency).toLowerCase(),
    status: 'completed',
    paid_at: existing && existing.paid_at || new Date().toISOString(),
    provider_payload: session,
  }, 'provider_order_id');

  const passRows = await db.rpc('grant_stripe_match_pass_credit', {
    p_customer_id: customer.id,
    p_source_order_id: order.id,
  });
  const pass = Array.isArray(passRows) ? passRows[0] : passRows;
  await db.insert('audit_events', {
    actor_type: 'stripe_webhook',
    actor_id: session.id,
    action: 'match_pass.credit_confirmed',
    entity_type: 'match_pass',
    entity_id: pass && pass.match_pass_id,
    data: { checkout_session_id: session.id, licensing_action: mapping.licensing_action },
  });
  return { result: 'match-pass', order, pass };
}

function invoiceSubscriptionLine(invoice) {
  const lines = Array.isArray(invoice && invoice.lines && invoice.lines.data) ? invoice.lines.data : [];
  const candidates = lines.filter((line) => priceIdFromLine(line));
  if (!candidates.length) throw new Error(`Stripe invoice ${invoice.id} has no priced subscription line`);
  return candidates;
}

async function resolveInvoiceAuthority(invoice) {
  const lines = invoiceSubscriptionLine(invoice);
  let resolved = null;
  for (const line of lines) {
    const priceId = priceIdFromLine(line);
    const mapping = await db.selectOne('stripe_plan_mappings', { price_id: priceId, active: true });
    if (!mapping || mapping.plan === 'match-pass') continue;
    if (resolved && resolved.mapping.price_id !== mapping.price_id) {
      throw new Error(`Stripe invoice ${invoice.id} contains multiple TAKEFRAME subscription plans`);
    }
    resolved = { mapping, line };
  }
  if (!resolved) throw new Error(`Stripe invoice ${invoice.id} has no authorised TAKEFRAME subscription line`);
  await assertProduct(resolved.mapping);
  const lineProductId = productIdFromLine(resolved.line);
  if (lineProductId && lineProductId !== resolved.mapping.product_id) throw new Error('Stripe invoice product/price mapping mismatch');
  return resolved;
}

async function provisionPaidInvoice(invoiceInput) {
  const invoice = invoiceInput && invoiceInput.id ? await stripe.retrieveInvoice(invoiceInput.id) : invoiceInput;
  if (!invoice || invoice.status !== 'paid') return { result: 'unpaid' };
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  if (!subscriptionId) throw new Error(`Paid Stripe invoice ${invoice.id} has no subscription`);
  const subscription = await stripe.retrieveSubscription(subscriptionId);
  const { mapping, line } = await resolveInvoiceAuthority(invoice);
  assertMetadata(subscription.metadata, mapping, `Stripe subscription ${subscription.id}`);

  const paidThrough = epochIso(line && line.period && line.period.end);
  if (!paidThrough || Date.parse(paidThrough) <= Date.now()) {
    throw new Error(`Stripe invoice ${invoice.id} has no future paid-through period`);
  }

  const stripeCustomerId = objectId(invoice.customer) || objectId(subscription.customer);
  const customer = await syncCustomer(stripeCustomerId, customerEmail(invoice));
  const rows = await db.rpc('apply_stripe_subscription_payment', {
    p_customer_id: customer.id,
    p_provider_subscription_id: subscription.id,
    p_provider_product_id: mapping.product_id,
    p_provider_price_id: mapping.price_id,
    p_plan: mapping.plan,
    p_paid_through: paidThrough,
    p_provider_payload: { subscription, invoice },
  });
  const authority = Array.isArray(rows) ? rows[0] : rows;

  await db.insert('audit_events', {
    actor_type: 'stripe_webhook',
    actor_id: invoice.id,
    action: 'subscription.payment_applied',
    entity_type: 'license',
    entity_id: authority && authority.license_id,
    data: {
      stripe_subscription_id: subscription.id,
      stripe_invoice_id: invoice.id,
      plan: mapping.plan,
      paid_through: paidThrough,
      licensing_action: mapping.licensing_action,
    },
  });
  return { result: 'subscription-paid', authority, subscription, invoice };
}

function localSubscriptionStatus(status) {
  switch (String(status || '')) {
    case 'active':
    case 'trialing': return 'active';
    case 'past_due':
    case 'unpaid': return 'overdue';
    case 'paused': return 'paused';
    case 'canceled': return 'cancelled';
    case 'incomplete_expired': return 'finished';
    case 'incomplete':
    default: return 'pending';
  }
}

async function syncSubscriptionState(subscriptionInput, forcedStatus = null) {
  const subscription = subscriptionInput && subscriptionInput.id
    ? await stripe.retrieveSubscription(subscriptionInput.id)
    : subscriptionInput;
  if (!subscription || !subscription.id) throw new Error('Stripe subscription authority missing');

  const items = Array.isArray(subscription.items && subscription.items.data) ? subscription.items.data : [];
  if (items.length) {
    const priceId = priceIdFromLine(items[0]);
    if (priceId) {
      const mapping = await mappingForPrice(priceId);
      await assertProduct(mapping);
      assertMetadata(subscription.metadata, mapping, `Stripe subscription ${subscription.id}`);
    }
  }

  const status = forcedStatus || localSubscriptionStatus(subscription.status);
  const rows = await db.rpc('mark_stripe_subscription_state', {
    p_provider_subscription_id: subscription.id,
    p_status: status,
    p_provider_payload: subscription,
  });
  return { result: 'subscription-state', status, authority: Array.isArray(rows) ? rows[0] || null : rows };
}

async function processCheckoutSession(sessionId, failed = false) {
  const session = await stripe.retrieveCheckoutSession(sessionId);
  if (failed) {
    if (session.mode === 'payment') {
      const { mapping } = await checkoutAuthority(session);
      if (mapping.plan === 'match-pass') {
        const customer = await syncCustomer(objectId(session.customer), customerEmail(session));
        await db.upsert('orders', {
          customer_id: customer.id,
          provider: 'stripe',
          provider_order_id: session.id,
          external_reference: session.client_reference_id || null,
          plan: 'match-pass',
          amount_cents: Number.isInteger(session.amount_total) ? session.amount_total : Number(mapping.amount_cents),
          currency: String(session.currency || mapping.currency).toLowerCase(),
          status: 'failed',
          paid_at: null,
          provider_payload: session,
        }, 'provider_order_id');
      }
    }
    return { result: 'checkout-failed' };
  }

  if (session.mode === 'payment') return provisionMatchPass(session);
  if (session.mode === 'subscription') {
    const { mapping } = await checkoutAuthority(session);
    if (!['monthly','annual'].includes(mapping.plan)) throw new Error('Unexpected TAKEFRAME subscription plan');
    const subscriptionId = objectId(session.subscription);
    if (!subscriptionId) throw new Error(`Checkout Session ${session.id} has no subscription`);
    const subscription = await stripe.retrieveSubscription(subscriptionId);
    assertMetadata(subscription.metadata, mapping, `Stripe subscription ${subscription.id}`);
    const latestInvoiceId = objectId(subscription.latest_invoice);
    if (!latestInvoiceId) return { result: 'subscription-awaiting-invoice' };
    return provisionPaidInvoice({ id: latestInvoiceId });
  }
  return { result: 'ignored-checkout-mode' };
}

async function processEvent(event) {
  const object = event && event.data && event.data.object || {};
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return processCheckoutSession(object.id, false);
    case 'checkout.session.async_payment_failed':
      return processCheckoutSession(object.id, true);
    case 'invoice.paid':
      return provisionPaidInvoice(object);
    case 'invoice.payment_failed': {
      const invoice = await stripe.retrieveInvoice(object.id);
      const subscriptionId = subscriptionIdFromInvoice(invoice);
      if (!subscriptionId) return { result: 'failed-invoice-without-subscription' };
      return syncSubscriptionState({ id: subscriptionId }, 'overdue');
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      return syncSubscriptionState(object);
    case 'customer.subscription.deleted':
      return syncSubscriptionState(object, 'cancelled');
    default:
      return { result: 'ignored' };
  }
}

module.exports = {
  assertMetadata,
  checkoutAuthority,
  epochIso,
  localSubscriptionStatus,
  mappingForPrice,
  processEvent,
  provisionPaidInvoice,
  subscriptionIdFromInvoice,
};
