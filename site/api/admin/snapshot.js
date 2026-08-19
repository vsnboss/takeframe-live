const adminAuth = require('../_lib/admin-auth');
const db = require('../_lib/supabase');
const { errorResponse, json } = require('../_lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'method_not_allowed' });
  }
  try {
    const { admin } = await adminAuth.currentAdmin(req, res);
    const snapshot = await db.rpc('get_commerce_admin_snapshot');
    return json(res, 200, { admin: { email: admin.email }, ...(snapshot || {}) });
  } catch (error) {
    return errorResponse(res, error);
  }
};
