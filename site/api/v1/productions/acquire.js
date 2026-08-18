const productions = require('../../_lib/productions');
const { bearer, errorResponse, json, readJson } = require('../../_lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  try {
    const body = await readJson(req);
    const lease = await productions.acquire({
      authorityKey: bearer(req),
      deviceId: body.deviceId,
      matchId: body.matchId,
    });
    return json(res, 201, lease);
  } catch (error) {
    return errorResponse(res, error);
  }
};

module.exports.config = { api: { bodyParser: false } };
