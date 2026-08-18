const PLANS = new Set(['annual', 'monthly', 'match-pass', 'evaluation']);

function redirect(res, location) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  return res.end();
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  const plan = String((req.query && req.query.plan) || '').toLowerCase();
  if (!PLANS.has(plan)) return redirect(res, '/pricing?checkout=unknown-plan');

  // Evaluation never touches the payment provider. WP6 owns provisioning.
  if (plan === 'evaluation') {
    return redirect(res, '/subscribe?plan=evaluation');
  }

  // Every paid checkout first resolves the TAKEFRAME customer identity. This
  // lets the commercial database own the order/subscription/licence chain while
  // preserving the frozen public /api/checkout?plan=... contract.
  return redirect(res, `/subscribe?plan=${encodeURIComponent(plan)}`);
};
