/**
 * Creates a Lemon Squeezy checkout server-side and redirects the buyer to it.
 *
 * The browser only ever sends a plan slug. Store and variant identifiers, and
 * the API key, stay on the server — nothing commercial is exposed client-side.
 *
 * Environment:
 *   LEMONSQUEEZY_API_KEY            (secret)
 *   LEMONSQUEEZY_STORE_ID
 *   LEMONSQUEEZY_VARIANT_ANNUAL
 *   LEMONSQUEEZY_VARIANT_MONTHLY
 *   LEMONSQUEEZY_VARIANT_MATCH_PASS
 *   LEMONSQUEEZY_VARIANT_EVALUATION
 */

const PLANS = {
  'annual':     { env: 'LEMONSQUEEZY_VARIANT_ANNUAL' },
  'monthly':    { env: 'LEMONSQUEEZY_VARIANT_MONTHLY' },
  'match-pass': { env: 'LEMONSQUEEZY_VARIANT_MATCH_PASS' },
  'evaluation': { env: 'LEMONSQUEEZY_VARIANT_EVALUATION' },
};

module.exports = async (req, res) => {
  const plan = String((req.query && req.query.plan) || '').toLowerCase();

  // allowlist only — never pass user input through to the commerce API
  if (!Object.prototype.hasOwnProperty.call(PLANS, plan)) {
    res.writeHead(302, { Location: '/pricing?checkout=unknown-plan' });
    return res.end();
  }

  const apiKey  = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const variant = process.env[PLANS[plan].env];

  if (!apiKey || !storeId || !variant) {
    res.writeHead(302, { Location: '/pricing?checkout=unavailable' });
    return res.end();
  }

  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;

  try {
    const r = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: { custom: { plan } },
            product_options: {
              redirect_url: `${origin}/welcome?plan=${encodeURIComponent(plan)}`,
              enabled_variants: [Number(variant)],
            },
            checkout_options: { embed: false, dark: true },
          },
          relationships: {
            store:   { data: { type: 'stores',   id: String(storeId) } },
            variant: { data: { type: 'variants', id: String(variant) } },
          },
        },
      }),
    });

    if (!r.ok) {
      console.error('lemonsqueezy checkout failed', r.status, await r.text());
      res.writeHead(302, { Location: '/pricing?checkout=error' });
      return res.end();
    }

    const json = await r.json();
    const url = json && json.data && json.data.attributes && json.data.attributes.url;
    if (!url) {
      res.writeHead(302, { Location: '/pricing?checkout=error' });
      return res.end();
    }

    res.writeHead(302, { Location: url, 'Cache-Control': 'no-store' });
    return res.end();
  } catch (err) {
    console.error('checkout error', err);
    res.writeHead(302, { Location: '/pricing?checkout=error' });
    return res.end();
  }
};
