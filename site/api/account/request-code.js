const auth = require('../_lib/account-auth');
const { errorResponse, json, readJson } = require('../_lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'method_not_allowed' });
  }
  try {
    const body = await readJson(req);
    await auth.requestOtp(body.email);
    return json(res, 200, { accepted: true });
  } catch (error) {
    return errorResponse(res, error);
  }
};
