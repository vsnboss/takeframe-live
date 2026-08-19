const auth = require('../_lib/account-auth');
const adminAuth = require('../_lib/admin-auth');
const { errorResponse, json } = require('../_lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'method_not_allowed' });
  }
  try {
    adminAuth.requireSameOrigin(req);
    auth.clearSessionCookies(res);
    return json(res, 200, { logged_out: true });
  } catch (error) {
    return errorResponse(res, error);
  }
};
