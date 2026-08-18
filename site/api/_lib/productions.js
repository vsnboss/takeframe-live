const crypto = require('crypto');
const db = require('./supabase');
const licensing = require('./licensing');
const { httpError } = require('./http');

function ttlSeconds() {
  const configured = Number(process.env.TAKEFRAME_LEASE_TTL_SECONDS || 90);
  if (!Number.isInteger(configured) || configured < 15 || configured > 300) {
    throw new Error('TAKEFRAME_LEASE_TTL_SECONDS must be an integer from 15 to 300');
  }
  return configured;
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}

function validateMatchId(value) {
  const matchId = String(value || '').trim();
  if (matchId.length < 4 || matchId.length > 256) {
    throw httpError(400, 'invalid_match_id', 'matchId must be between 4 and 256 characters');
  }
  return matchId;
}

async function acquire({ authorityKey, deviceId, matchId }) {
  const authority = await licensing.authorityFromKey(authorityKey, deviceId);
  const canonicalMatchId = validateMatchId(matchId);
  if (authority.type === 'match-pass' && authority.matchId !== canonicalMatchId) {
    throw httpError(409, 'match_pass_locked', 'Match Pass is bound to another match');
  }

  const leaseToken = crypto.randomBytes(32).toString('base64url');
  try {
    const rows = await db.rpc('acquire_production_lease', {
      p_license_id: authority.type === 'license' ? authority.license.id : null,
      p_match_pass_id: authority.type === 'match-pass' ? authority.pass.id : null,
      p_device_id: authority.device.id,
      p_match_id: canonicalMatchId,
      p_lease_token_hash: tokenHash(leaseToken),
      p_ttl_seconds: ttlSeconds(),
      p_max_concurrent: authority.maxConcurrentProductions,
    });
    const lease = Array.isArray(rows) ? rows[0] : rows;
    if (!lease || !lease.lease_id) throw new Error('Production lease RPC returned no lease');

    await db.insert('audit_events', {
      actor_type: 'device', actor_id: authority.device.device_id,
      action: 'production.acquired', entity_type: 'production_lease', entity_id: lease.lease_id,
      data: { match_id: canonicalMatchId, authority_type: authority.type },
    });

    return {
      leaseId: lease.lease_id,
      leaseToken,
      expiresAt: lease.expires_at,
      heartbeatAfterSeconds: Math.max(5, Math.floor(ttlSeconds() / 3)),
    };
  } catch (error) {
    if (String(error.message).includes('production concurrency limit reached')) {
      throw httpError(409, 'production_limit_reached', 'The concurrent production limit is already in use');
    }
    throw error;
  }
}

async function heartbeat(leaseToken) {
  if (!leaseToken || leaseToken.length < 32) throw httpError(401, 'invalid_lease_token', 'Invalid production lease token');
  try {
    const rows = await db.rpc('heartbeat_production_lease', {
      p_lease_token_hash: tokenHash(leaseToken),
      p_ttl_seconds: ttlSeconds(),
    });
    const lease = Array.isArray(rows) ? rows[0] : rows;
    return {
      leaseId: lease.lease_id,
      expiresAt: lease.expires_at,
      heartbeatAfterSeconds: Math.max(5, Math.floor(ttlSeconds() / 3)),
    };
  } catch (error) {
    if (String(error.message).includes('production lease not active')) {
      throw httpError(410, 'production_lease_expired', 'Production lease is no longer active');
    }
    throw error;
  }
}

async function release(leaseToken) {
  if (!leaseToken || leaseToken.length < 32) throw httpError(401, 'invalid_lease_token', 'Invalid production lease token');
  const released = await db.rpc('release_production_lease', {
    p_lease_token_hash: tokenHash(leaseToken),
  });
  return { released: Boolean(released) };
}

module.exports = { acquire, heartbeat, release };
