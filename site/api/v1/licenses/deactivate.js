const licensing = require('../../_lib/licensing');
const { bearer, errorResponse, json, readJson } = require('../../_lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  try {
    const body = await readJson(req);
    const result = await licensing.deactivateLicense({
      licenseKey: bearer(req),
      deviceId: body.deviceId,
    });
    return json(res, 200, { deactivated: result.deactivated });
  } catch (error) {
    return errorResponse(res, error);
  }
};

module.exports.config = { api: { bodyParser: false } };
