const licensing = require('../../_lib/licensing');
const { errorResponse, json, readJson } = require('../../_lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  try {
    const body = await readJson(req);
    const result = await licensing.activateMatchPass({
      passKey: body.passKey,
      matchId: body.matchId,
      deviceId: body.deviceId,
      deviceName: body.deviceName,
    });
    return json(res, 200, {
      matchPassId: result.pass.id,
      matchId: result.pass.match_id,
      activatedAt: result.pass.activated_at,
      expiresAt: result.pass.expires_at,
      deviceId: result.device.device_id,
      entitlement: result.entitlement,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

module.exports.config = { api: { bodyParser: false } };
