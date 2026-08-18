const licensing = require('../../_lib/licensing');
const { bearer, errorResponse, json } = require('../../_lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
  try {
    const status = await licensing.licenseStatus({
      licenseKey: bearer(req),
      deviceId: req.query && req.query.deviceId,
    });
    return json(res, 200, status);
  } catch (error) {
    return errorResponse(res, error);
  }
};
