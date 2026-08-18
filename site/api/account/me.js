const auth = require('../_lib/account-auth');
const db = require('../_lib/supabase');
const { errorResponse, json } = require('../_lib/http');

function newest(rows) {
  return [...rows].sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0))[0] || null;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const { user, customer } = await auth.currentAccount(req, res);
    const [subscriptions, licenses, matchPasses] = await Promise.all([
      db.selectMany('subscriptions', { customer_id: customer.id }, '*', 100),
      db.selectMany('licenses', { customer_id: customer.id }, '*', 100),
      db.selectMany('match_passes', { customer_id: customer.id }, '*', 100),
    ]);

    const devices = [];
    for (const license of licenses) {
      const rows = await db.selectMany('devices', { license_id: license.id }, '*', 100);
      for (const device of rows) devices.push({ ...device, authority: 'license', authorityId: license.id });
    }
    for (const pass of matchPasses) {
      const rows = await db.selectMany('devices', { match_pass_id: pass.id }, '*', 100);
      for (const device of rows) devices.push({ ...device, authority: 'match-pass', authorityId: pass.id });
    }

    const preferredSubscription = newest(subscriptions.filter((item) => ['active', 'pending', 'overdue'].includes(item.status))) || newest(subscriptions);
    const preferredLicense = preferredSubscription
      ? licenses.find((item) => item.subscription_id === preferredSubscription.id) || newest(licenses)
      : newest(licenses);

    const activeDevices = devices.filter((item) => !item.deactivated_at);
    const unusedPasses = matchPasses.filter((item) => item.status === 'unused');

    return json(res, 200, {
      account: {
        email: user.email,
        customerId: customer.id,
      },
      plan: preferredSubscription ? {
        type: preferredSubscription.plan,
        status: preferredSubscription.status,
        paidThrough: preferredSubscription.paid_through,
        startedAt: preferredSubscription.start_date,
      } : (preferredLicense && preferredLicense.kind === 'evaluation' ? {
        type: 'evaluation',
        status: preferredLicense.status,
        paidThrough: preferredLicense.valid_until,
        startedAt: preferredLicense.valid_from,
      } : null),
      license: preferredLicense ? {
        id: preferredLicense.id,
        key: preferredLicense.license_key,
        kind: preferredLicense.kind,
        plan: preferredLicense.plan,
        status: preferredLicense.status,
        validUntil: preferredLicense.valid_until,
        maxDevices: preferredLicense.max_devices,
        maxConcurrentProductions: preferredLicense.max_concurrent_productions,
        watermarkMode: preferredLicense.watermark_mode,
      } : null,
      matchPasses: {
        unused: unusedPasses.length,
        credits: matchPasses.map((pass) => ({
          id: pass.id,
          key: pass.pass_key,
          status: pass.status,
          matchId: pass.match_id,
          activatedAt: pass.activated_at,
          expiresAt: pass.expires_at,
        })),
      },
      devices: activeDevices.map((device) => ({
        id: device.id,
        name: device.device_name,
        platform: device.platform,
        registeredAt: device.registered_at,
        lastSeenAt: device.last_seen_at,
        authority: device.authority,
      })),
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};
