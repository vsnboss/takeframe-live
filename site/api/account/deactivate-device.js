const auth = require('../_lib/account-auth');
const db = require('../_lib/supabase');
const { errorResponse, httpError, json, readJson } = require('../_lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const { customer } = await auth.currentAccount(req, res);
    const body = await readJson(req);
    const deviceId = String(body.deviceId || '').trim();
    if (!deviceId) throw httpError(400, 'invalid_device', 'deviceId is required');

    const device = await db.selectOne('devices', { id: deviceId });
    if (!device || device.deactivated_at) return json(res, 200, { deactivated: false });

    let owned = false;
    if (device.license_id) {
      const license = await db.selectOne('licenses', { id: device.license_id });
      owned = Boolean(license && license.customer_id === customer.id);
    }
    if (device.match_pass_id) {
      const pass = await db.selectOne('match_passes', { id: device.match_pass_id });
      owned = Boolean(pass && pass.customer_id === customer.id);
    }
    if (!owned) throw httpError(404, 'device_not_found', 'Device not found');

    await db.patch('devices', { id: device.id }, { deactivated_at: new Date().toISOString() });
    await db.insert('audit_events', {
      actor_type: 'customer',
      actor_id: customer.id,
      action: 'account.device_deactivated',
      entity_type: 'device',
      entity_id: device.id,
      data: {},
    });
    return json(res, 200, { deactivated: true });
  } catch (error) {
    return errorResponse(res, error);
  }
};
