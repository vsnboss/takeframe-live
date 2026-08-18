const productions = require('../../_lib/productions');
const { bearer, errorResponse, json } = require('../../_lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  try {
    return json(res, 200, await productions.heartbeat(bearer(req)));
  } catch (error) {
    return errorResponse(res, error);
  }
};
