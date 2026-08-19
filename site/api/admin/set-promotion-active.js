const adminAuth = require('../_lib/admin-auth');
const db = require('../_lib/supabase');
const { errorResponse, httpError, json, readJson } = require('../_lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'method_not_allowed' });
  }
  try {
    adminAuth.requireSameOrigin(req);
    const { admin } = await adminAuth.currentAdmin(req, res);
    const body = await readJson(req);
    const id = String(body.id || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw httpError(400, 'invalid_id', 'Invalid promotion id');
    if (typeof body.active !== 'boolean') throw httpError(400, 'invalid_active', 'Active must be true or false');

    const rows = await db.patch('promotions', { id }, { active: body.active });
    const promotion = rows[0];
    if (!promotion) throw httpError(404, 'promotion_not_found', 'Promotion not found');

    await db.insert('audit_events', {
      actor_type: 'commerce_admin',
      actor_id: admin.email,
      action: body.active ? 'promotion.activated' : 'promotion.deactivated',
      entity_type: 'promotion',
      entity_id: promotion.id,
      data: { code: promotion.code },
    });
    return json(res, 200, { promotion });
  } catch (error) {
    return errorResponse(res, error);
  }
};
