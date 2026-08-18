const auth = require('../_lib/account-auth');
const { json } = require('../_lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'method_not_allowed' });
  }
  auth.clearSessionCookies(res);
  return json(res, 200, { authenticated: false });
};
