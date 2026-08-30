const API_BASE = 'https://api.stripe.com/v1';

function secretKey() {
  const value = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!value) throw new Error('STRIPE_SECRET_KEY not configured');
  if (!value.startsWith('sk_live_')) throw new Error('TAKEFRAME production requires a live Stripe secret key');
  return value;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  if (!response.ok) {
    const message = payload && payload.error && payload.error.message
      ? payload.error.message
      : text.slice(0, 800);
    throw new Error(`Stripe ${path} failed (${response.status}): ${message}`);
  }
  return payload;
}

function query(params) {
  const values = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') values.set(key, String(value));
  }
  const encoded = values.toString();
  return encoded ? `?${encoded}` : '';
}

async function retrieveCheckoutSession(id) {
  return request(`/checkout/sessions/${encodeURIComponent(id)}`);
}

async function retrieveCheckoutSessionLineItems(id) {
  return request(`/checkout/sessions/${encodeURIComponent(id)}/line_items${query({ limit: 100 })}`);
}

async function retrieveCustomer(id) {
  return request(`/customers/${encodeURIComponent(id)}`);
}

async function retrieveInvoice(id) {
  return request(`/invoices/${encodeURIComponent(id)}${query({ 'expand[]': 'lines.data' })}`);
}

async function retrieveSubscription(id) {
  return request(`/subscriptions/${encodeURIComponent(id)}${query({ 'expand[]': 'items.data.price.product' })}`);
}

module.exports = {
  request,
  retrieveCheckoutSession,
  retrieveCheckoutSessionLineItems,
  retrieveCustomer,
  retrieveInvoice,
  retrieveSubscription,
};
