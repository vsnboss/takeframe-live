const crypto = require('crypto');

const API_VERSION = '2026-04-20';
const EVENTS = [
  'ORDER_AUTHORISED',
  'ORDER_COMPLETED',
  'ORDER_CANCELLED',
  'ORDER_FAILED',
  'ORDER_PAYMENT_DECLINED',
  'ORDER_PAYMENT_FAILED',
  'SUBSCRIPTION_INITIATED',
  'SUBSCRIPTION_FINISHED',
  'SUBSCRIPTION_CANCELLED',
  'SUBSCRIPTION_OVERDUE',
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function originFor(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

async function readForm(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function page(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Referrer-Policy', 'no-referrer');
  return res.end(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TAKEFRAME Sandbox Webhook Setup</title>
<style>body{font-family:system-ui,sans-serif;background:#05080d;color:#eef4fa;margin:0;padding:48px}main{max-width:760px;margin:auto}code,input{font-family:ui-monospace,monospace}input{width:100%;box-sizing:border-box;padding:14px;background:#0c121b;color:#fff;border:1px solid #273346}button{margin-top:14px;padding:13px 18px;background:#00b0f0;border:0;font-weight:700}.box{background:#0c121b;border:1px solid #273346;padding:20px;margin:18px 0;overflow-wrap:anywhere}.warn{color:#f0a81e}</style></head><body><main>${body}</main></body></html>`);
}

function setupForm(res, message = '') {
  return page(res, 200, `
<h1>TAKEFRAME Sandbox Webhook Setup</h1>
<p>This route is enabled only for the Revolut Sandbox preview deployment.</p>
${message ? `<p class="warn">${escapeHtml(message)}</p>` : ''}
<form method="post" autocomplete="off">
<label for="token">Temporary setup token</label>
<input id="token" name="token" type="password" required autocomplete="off">
<button type="submit">Create Revolut Sandbox webhook</button>
</form>`);
}

module.exports = async (req, res) => {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.REVOLUT_ENV !== 'sandbox') {
    return page(res, 404, '<h1>Not Found</h1>');
  }

  const apiSecret = process.env.REVOLUT_SECRET_KEY;
  const setupToken = process.env.TAKEFRAME_SETUP_TOKEN;
  if (!apiSecret || !setupToken) {
    return page(res, 503, '<h1>Setup unavailable</h1><p>Required Preview environment variables are not configured.</p>');
  }

  if (process.env.REVOLUT_WEBHOOK_SIGNING_SECRET) {
    return page(res, 409, '<h1>Webhook already configured</h1><p>REVOLUT_WEBHOOK_SIGNING_SECRET is already present. Remove this temporary setup route after verification.</p>');
  }

  if (req.method === 'GET') return setupForm(res);
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, POST');
    return res.end('Method Not Allowed');
  }

  const form = await readForm(req);
  if (!safeEqual(form.get('token'), setupToken)) {
    return setupForm(res, 'Invalid setup token.');
  }

  const webhookUrl = `${originFor(req)}/api/webhook`;

  try {
    const response = await fetch('https://sandbox-merchant.revolut.com/api/webhooks', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiSecret}`,
        'Content-Type': 'application/json',
        'Revolut-Api-Version': API_VERSION,
      },
      body: JSON.stringify({ url: webhookUrl, events: EVENTS }),
    });

    const text = await response.text();
    if (!response.ok) {
      console.error('Revolut webhook creation failed', response.status, text.slice(0, 1000));
      return page(res, 502, `<h1>Revolut rejected webhook creation</h1><div class="box">HTTP ${response.status}<br>${escapeHtml(text.slice(0, 1200))}</div>`);
    }

    const webhook = JSON.parse(text);
    if (!webhook.id || !webhook.signing_secret) {
      return page(res, 502, '<h1>Unexpected Revolut response</h1><p>The webhook was created but the expected id/signing_secret fields were missing.</p>');
    }

    return page(res, 200, `
<h1>Sandbox webhook created</h1>
<p><strong>Webhook ID</strong></p><div class="box"><code>${escapeHtml(webhook.id)}</code></div>
<p><strong>Webhook URL</strong></p><div class="box"><code>${escapeHtml(webhook.url || webhookUrl)}</code></div>
<p class="warn"><strong>Copy the signing secret now.</strong> Do not paste it into chat or GitHub.</p>
<div class="box"><code>${escapeHtml(webhook.signing_secret)}</code></div>
<p>Add it to Vercel Preview as <code>REVOLUT_WEBHOOK_SIGNING_SECRET</code>, mark it Sensitive, then redeploy this branch.</p>
<p>After redeploy, this setup route disables itself automatically because the signing-secret environment variable is present.</p>`);
  } catch (error) {
    console.error('Revolut webhook setup error', error);
    return page(res, 502, '<h1>Webhook setup failed</h1><p>Check Vercel logs for the server-side error.</p>');
  }
};
