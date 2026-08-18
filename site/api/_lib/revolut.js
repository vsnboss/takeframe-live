const API_VERSION = '2026-04-20';

function environment() {
  const value = String(process.env.REVOLUT_ENV || '').trim().toLowerCase();
  if (value !== 'production' && value !== 'sandbox') {
    throw new Error('REVOLUT_ENV must be explicitly set to production or sandbox');
  }
  if (process.env.VERCEL_ENV === 'production' && value !== 'production') {
    throw new Error('Refusing to use Revolut Sandbox from a production Vercel deployment');
  }
  return value;
}

function baseUrl() {
  return environment() === 'sandbox'
    ? 'https://sandbox-merchant.revolut.com/api'
    : 'https://merchant.revolut.com/api';
}

async function request(path, options = {}) {
  const secret = String(process.env.REVOLUT_SECRET_KEY || '').trim();
  if (!secret) throw new Error('REVOLUT_SECRET_KEY not configured');

  const response = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Revolut-Api-Version': API_VERSION,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Revolut ${path} failed (${response.status}): ${text.slice(0, 800)}`);
  }
  if (!text) return null;
  return JSON.parse(text);
}

async function retrieveOrder(id) {
  return request(`/orders/${encodeURIComponent(id)}`);
}

async function retrieveSubscription(id) {
  return request(`/subscriptions/${encodeURIComponent(id)}`);
}

async function retrieveCurrentCycle(subscription) {
  if (!subscription || !subscription.id || !subscription.current_cycle_id) return null;
  return request(`/subscriptions/${encodeURIComponent(subscription.id)}/cycles/${encodeURIComponent(subscription.current_cycle_id)}`);
}

async function retrieveCustomer(id) {
  return request(`/customers/${encodeURIComponent(id)}`);
}

module.exports = {
  API_VERSION,
  baseUrl,
  environment,
  request,
  retrieveCustomer,
  retrieveCurrentCycle,
  retrieveOrder,
  retrieveSubscription,
};
