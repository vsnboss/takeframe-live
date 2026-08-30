const db = require('./_lib/supabase');
const stripeProvisioning = require('./_lib/stripe-provisioning');
const stripeWebhooks = require('./_lib/stripe-webhooks');

const RELEVANT_EVENTS = new Set(stripeWebhooks.WEBHOOK_EVENTS);

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function providerObjectId(event) {
  return event && event.data && event.data.object && event.data.object.id || null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end('Method Not Allowed');
  }

  let rawBody;
  try {
    rawBody = await readRaw(req);
  } catch {
    res.statusCode = 400;
    return res.end('Bad payload');
  }

  let secret;
  try {
    secret = await stripeWebhooks.signingSecret();
  } catch (error) {
    console.error('Stripe webhook signing secret unavailable', error);
    res.statusCode = 503;
    return res.end('Webhook not configured');
  }

  const verification = stripeWebhooks.verifySignature({
    secret,
    signatureHeader: req.headers['stripe-signature'],
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

  if (!event || !event.id || !event.type) {
    res.statusCode = 400;
    return res.end('Missing Stripe event identity');
  }
  if (event.livemode !== true) {
    res.statusCode = 400;
    return res.end('TAKEFRAME production accepts live Stripe events only');
  }
  if (!RELEVANT_EVENTS.has(event.type)) {
    res.statusCode = 204;
    return res.end();
  }

  let eventId = null;
  try {
    const claimRows = await db.rpc('claim_payment_webhook_event', {
      p_provider: 'stripe',
      p_event_key: `stripe:${event.id}`,
      p_event_type: event.type,
      p_provider_object_id: providerObjectId(event),
      p_external_reference: null,
      p_payload: event,
    });
    const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
    if (!claim || !claim.event_id) throw new Error('Stripe webhook event claim returned no event id');
    eventId = claim.event_id;
    if (!claim.should_process) {
      res.statusCode = 200;
      return res.end('Already processed');
    }

    const result = await stripeProvisioning.processEvent(event);
    await db.rpc('finish_webhook_event', {
      p_event_id: eventId,
      p_status: result && result.result === 'ignored' ? 'ignored' : 'processed',
      p_error: null,
    });
    res.statusCode = 200;
    return res.end('OK');
  } catch (error) {
    console.error('Stripe TAKEFRAME webhook failed', event && event.id, error);
    if (eventId) {
      try {
        await db.rpc('finish_webhook_event', {
          p_event_id: eventId,
          p_status: 'failed',
          p_error: String(error && error.message || error).slice(0, 2000),
        });
      } catch (finishError) {
        console.error('Could not mark Stripe webhook failed', finishError);
      }
    }
    res.statusCode = 500;
    return res.end('Webhook processing failed');
  }
};
