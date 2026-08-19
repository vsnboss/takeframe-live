const adminAuth = require('../_lib/admin-auth');
const db = require('../_lib/supabase');
const { errorResponse, httpError, json, readJson } = require('../_lib/http');

function code(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(normalized)) {
    throw httpError(400, 'invalid_code', 'Use 3-32 uppercase letters, numbers, dashes or underscores');
  }
  return normalized;
}

function optionalEmail(value) {
  const raw = String(value || '').trim();
  return raw ? require('../_lib/account-auth').normalizeEmail(raw) : null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'method_not_allowed' });
  }
  try {
    adminAuth.requireSameOrigin(req);
    const { admin } = await adminAuth.currentAdmin(req, res);
    const body = await readJson(req);
    const finalPriceCents = Number(body.final_price_cents);
    const maxRedemptions = Number(body.max_redemptions || 1);
    const perEmail = Number(body.max_redemptions_per_email || 1);
    if (!Number.isInteger(finalPriceCents) || finalPriceCents < 100 || finalPriceCents > 7900) {
      throw httpError(400, 'invalid_price', 'Final Match Pass price must be between €1 and €79');
    }
    if (!Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 10000) {
      throw httpError(400, 'invalid_limit', 'Invalid redemption limit');
    }
    if (!Number.isInteger(perEmail) || perEmail < 1 || perEmail > maxRedemptions) {
      throw httpError(400, 'invalid_email_limit', 'Invalid per-email redemption limit');
    }
    let expiresAt = null;
    if (body.expires_at) {
      const parsed = new Date(body.expires_at);
      if (!Number.isFinite(parsed.getTime()) || parsed <= new Date()) {
        throw httpError(400, 'invalid_expiry', 'Expiry must be in the future');
      }
      expiresAt = parsed.toISOString();
    }
    const promotion = await db.insert('promotions', {
      code: code(body.code),
      description: String(body.description || '').trim().slice(0, 240) || null,
      plan: 'match-pass',
      final_price_cents: finalPriceCents,
      allowed_email: optionalEmail(body.allowed_email),
      max_redemptions: maxRedemptions,
      max_redemptions_per_email: perEmail,
      expires_at: expiresAt,
      active: true,
      created_by_email: admin.email,
    });
    await db.insert('audit_events', {
      actor_type: 'commerce_admin',
      actor_id: admin.email,
      action: 'promotion.created',
      entity_type: 'promotion',
      entity_id: promotion.id,
      data: { code: promotion.code, final_price_cents: promotion.final_price_cents },
    });
    return json(res, 201, { promotion });
  } catch (error) {
    if (/duplicate key/i.test(String(error && error.message || ''))) {
      return json(res, 409, { error: 'promotion_exists', message: 'That promo code already exists' });
    }
    return errorResponse(res, error);
  }
};
