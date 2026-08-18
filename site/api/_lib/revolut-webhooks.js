const db = require('./supabase');
const revolut = require('./revolut');

const WEBHOOK_EVENTS = [
  'ORDER_AUTHORISED',
  'ORDER_COMPLETED',
  'ORDER_CANCELLED',
];

function webhookUrlFor(origin) {
  return revolut.environment() === 'production'
    ? 'https://takeframe.live/api/webhook'
    : `${origin.replace(/\/$/, '')}/api/webhook`;
}

function sameEvents(left, right) {
  const a = [...(left || [])].sort();
  const b = [...(right || [])].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

async function storedConfig() {
  const rows = await db.rpc('get_revolut_webhook_config');
  return Array.isArray(rows) ? rows[0] || null : rows || null;
}

async function persistWebhook(webhook) {
  await db.rpc('store_revolut_webhook', {
    p_webhook_id: webhook.id,
    p_url: webhook.url,
    p_events: webhook.events || WEBHOOK_EVENTS,
    p_signing_secret: webhook.signing_secret,
    p_environment: revolut.environment(),
  });
}

async function ensureWebhook(origin) {
  const targetUrl = webhookUrlFor(origin);
  const env = revolut.environment();

  const local = await storedConfig();
  if (
    local &&
    local.environment === env &&
    local.url === targetUrl &&
    sameEvents(local.events, WEBHOOK_EVENTS) &&
    local.signing_secret
  ) {
    return { id: local.provider_webhook_id, url: local.url, events: local.events };
  }

  const list = await revolut.request('/webhooks');
  const existing = (list && list.webhooks || []).find((item) => item.url === targetUrl);

  let webhook;
  if (existing) {
    if (!sameEvents(existing.events, WEBHOOK_EVENTS)) {
      webhook = await revolut.request(`/webhooks/${encodeURIComponent(existing.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ url: targetUrl, events: WEBHOOK_EVENTS }),
      });
    } else {
      webhook = await revolut.request(`/webhooks/${encodeURIComponent(existing.id)}`);
    }
  } else {
    webhook = await revolut.request('/webhooks', {
      method: 'POST',
      body: JSON.stringify({ url: targetUrl, events: WEBHOOK_EVENTS }),
    });
  }

  if (!webhook || !webhook.id || !webhook.signing_secret) {
    throw new Error('Revolut webhook response did not include id/signing_secret');
  }

  await persistWebhook(webhook);
  return webhook;
}

async function signingSecret() {
  const config = await storedConfig();
  if (!config || !config.signing_secret) {
    throw new Error('Revolut webhook signing secret is not configured');
  }
  if (config.environment !== revolut.environment()) {
    throw new Error('Revolut webhook environment mismatch');
  }
  return config.signing_secret;
}

module.exports = { WEBHOOK_EVENTS, ensureWebhook, signingSecret, webhookUrlFor };
