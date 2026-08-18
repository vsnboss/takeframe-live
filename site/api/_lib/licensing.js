const crypto = require('crypto');
const db = require('./supabase');
const { httpError } = require('./http');

function signingConfig() {
  const pem = String(process.env.TAKEFRAME_ENTITLEMENT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const keyId = String(process.env.TAKEFRAME_ENTITLEMENT_KEY_ID || '').trim();
  if (!pem || !keyId) throw new Error('Entitlement signing key is not configured');
  return { privateKey: crypto.createPrivateKey(pem), keyId };
}

function offlineHours() {
  const hours = Number(process.env.TAKEFRAME_OFFLINE_HOURS);
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error('TAKEFRAME_OFFLINE_HOURS must be configured to a positive number');
  }
  return hours;
}

function minIso(...values) {
  const valid = values
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => Number.isFinite(date.getTime()));
  if (!valid.length) return null;
  return new Date(Math.min(...valid.map((date) => date.getTime()))).toISOString();
}

function signedWindow(validUntil, now = new Date()) {
  const requestedOfflineUntil = new Date(now.getTime() + offlineHours() * 60 * 60 * 1000).toISOString();
  return {
    issuedAt: now.toISOString(),
    offlineUntil: minIso(requestedOfflineUntil, validUntil) || requestedOfflineUntil,
  };
}

function licenseEntitlementPayload({ license, device, matchId = null, now = new Date() }) {
  const window = signedWindow(license.valid_until, now);
  return {
    version: 1,
    product: 'takeframe',
    licenseId: license.id,
    plan: license.plan,
    deviceId: device.device_id,
    maxDevices: license.max_devices,
    maxConcurrentProductions: license.max_concurrent_productions,
    cleanOutput: Boolean(license.clean_output),
    watermarkMode: license.watermark_mode,
    matchId,
    issuedAt: window.issuedAt,
    validUntil: license.valid_until,
    offlineUntil: window.offlineUntil,
    keyId: signingConfig().keyId,
  };
}

function matchPassEntitlementPayload({ pass, device, now = new Date() }) {
  const window = signedWindow(pass.expires_at, now);
  return {
    version: 1,
    product: 'takeframe',
    licenseId: pass.id,
    plan: 'match-pass',
    deviceId: device.device_id,
    maxDevices: 2,
    maxConcurrentProductions: 1,
    cleanOutput: true,
    watermarkMode: 'none',
    matchId: pass.match_id,
    issuedAt: window.issuedAt,
    validUntil: pass.expires_at,
    offlineUntil: window.offlineUntil,
    keyId: signingConfig().keyId,
  };
}

function signPayload(payload) {
  const { privateKey, keyId } = signingConfig();
  if (payload.keyId !== keyId) throw new Error('Entitlement key id mismatch');
  const serialized = JSON.stringify(payload);
  const signature = crypto.sign(null, Buffer.from(serialized, 'utf8'), privateKey).toString('base64url');
  return { payload, signature };
}

function assertLicenseAuthority(license) {
  if (!license) throw httpError(404, 'license_not_found', 'TAKEFRAME licence not found');
  if (['revoked', 'suspended', 'expired'].includes(license.status)) {
    throw httpError(403, 'license_inactive', 'TAKEFRAME licence is not active');
  }
  if (license.valid_until && Date.parse(license.valid_until) <= Date.now()) {
    throw httpError(403, 'license_expired', 'TAKEFRAME licence has expired');
  }
}

async function licenseByKey(licenseKey) {
  const key = String(licenseKey || '').trim().toUpperCase();
  if (!/^TF-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(key)) {
    throw httpError(401, 'invalid_license_key', 'Invalid TAKEFRAME licence key');
  }
  const license = await db.selectOne('licenses', { license_key: key });
  assertLicenseAuthority(license);
  return license;
}

async function matchPassByKey(passKey) {
  const key = String(passKey || '').trim().toUpperCase();
  if (!/^TFM-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(key)) {
    throw httpError(401, 'invalid_match_pass_key', 'Invalid TAKEFRAME Match Pass key');
  }
  const pass = await db.selectOne('match_passes', { pass_key: key });
  if (!pass) throw httpError(404, 'match_pass_not_found', 'TAKEFRAME Match Pass not found');
  return pass;
}

function validateDeviceId(value) {
  const deviceId = String(value || '').trim();
  if (deviceId.length < 8 || deviceId.length > 256) {
    throw httpError(400, 'invalid_device_id', 'deviceId must be between 8 and 256 characters');
  }
  return deviceId;
}

function validateMatchId(value) {
  const matchId = String(value || '').trim();
  if (matchId.length < 4 || matchId.length > 256) {
    throw httpError(400, 'invalid_match_id', 'matchId must be between 4 and 256 characters');
  }
  return matchId;
}

async function activeDevicesFor(field, authorityId) {
  const params = new URLSearchParams({
    select: '*',
    [field]: `eq.${authorityId}`,
    deactivated_at: 'is.null',
    limit: '100',
  });
  const rows = await db.request(`/devices?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

async function ensureAuthorityDevice({ field, authorityId, maxDevices, deviceId, deviceName }) {
  const normalizedId = validateDeviceId(deviceId);
  const existing = await db.selectOne('devices', {
    [field]: authorityId,
    device_id: normalizedId,
  });

  if (existing && !existing.deactivated_at) {
    const updated = await db.patch('devices', { id: existing.id }, {
      device_name: deviceName || existing.device_name || null,
      last_seen_at: new Date().toISOString(),
    });
    return updated[0] || existing;
  }

  const active = await activeDevicesFor(field, authorityId);
  if (active.length >= maxDevices) {
    throw httpError(409, 'device_limit_reached', `This entitlement allows ${maxDevices} registered devices`);
  }

  if (existing) {
    const rows = await db.patch('devices', { id: existing.id }, {
      device_name: deviceName || existing.device_name || null,
      deactivated_at: null,
      last_seen_at: new Date().toISOString(),
    });
    return rows[0];
  }

  return db.insert('devices', {
    [field]: authorityId,
    device_id: normalizedId,
    device_name: deviceName || null,
    platform: 'windows',
    last_seen_at: new Date().toISOString(),
  });
}

async function ensureLicenseDevice(license, input) {
  return ensureAuthorityDevice({
    field: 'license_id', authorityId: license.id, maxDevices: license.max_devices, ...input,
  });
}

async function ensureMatchPassDevice(pass, input) {
  return ensureAuthorityDevice({
    field: 'match_pass_id', authorityId: pass.id, maxDevices: 2, ...input,
  });
}

async function issueLicenseEntitlement(license, device, matchId = null) {
  assertLicenseAuthority(license);
  const signed = signPayload(licenseEntitlementPayload({ license, device, matchId }));
  await db.insert('entitlements', {
    license_id: license.id,
    device_id: device.id,
    key_id: signed.payload.keyId,
    payload: signed.payload,
    signature: signed.signature,
    issued_at: signed.payload.issuedAt,
    valid_until: signed.payload.validUntil,
    offline_until: signed.payload.offlineUntil,
  });
  await db.patch('devices', { id: device.id }, { last_seen_at: new Date().toISOString() });
  return signed;
}

async function issueMatchPassEntitlement(pass, device) {
  if (pass.status !== 'activated') {
    throw httpError(403, 'match_pass_inactive', 'Match Pass is not activated');
  }
  if (!pass.expires_at || Date.parse(pass.expires_at) <= Date.now()) {
    await db.patch('match_passes', { id: pass.id }, { status: 'expired' });
    throw httpError(403, 'match_pass_expired', 'Match Pass has expired');
  }
  const signed = signPayload(matchPassEntitlementPayload({ pass, device }));
  await db.insert('entitlements', {
    match_pass_id: pass.id,
    device_id: device.id,
    key_id: signed.payload.keyId,
    payload: signed.payload,
    signature: signed.signature,
    issued_at: signed.payload.issuedAt,
    valid_until: signed.payload.validUntil,
    offline_until: signed.payload.offlineUntil,
  });
  await db.patch('devices', { id: device.id }, { last_seen_at: new Date().toISOString() });
  return signed;
}

async function activateLicense({ licenseKey, deviceId, deviceName }) {
  const license = await licenseByKey(licenseKey);
  const device = await ensureLicenseDevice(license, { deviceId, deviceName });
  const entitlement = await issueLicenseEntitlement(license, device);
  await db.insert('audit_events', {
    actor_type: 'device', actor_id: device.device_id,
    action: 'license.activated', entity_type: 'license', entity_id: license.id,
    data: { device_record_id: device.id },
  });
  return { license, device, entitlement };
}

async function refreshLicense({ licenseKey, deviceId }) {
  const license = await licenseByKey(licenseKey);
  const normalizedId = validateDeviceId(deviceId);
  const device = await db.selectOne('devices', { license_id: license.id, device_id: normalizedId });
  if (!device || device.deactivated_at) {
    throw httpError(403, 'device_not_registered', 'This device is not registered for the licence');
  }
  return { license, device, entitlement: await issueLicenseEntitlement(license, device) };
}

async function deactivateLicense({ licenseKey, deviceId }) {
  const license = await licenseByKey(licenseKey);
  const normalizedId = validateDeviceId(deviceId);
  const device = await db.selectOne('devices', { license_id: license.id, device_id: normalizedId });
  if (!device || device.deactivated_at) return { license, deactivated: false };
  await db.patch('devices', { id: device.id }, { deactivated_at: new Date().toISOString() });
  await db.insert('audit_events', {
    actor_type: 'device', actor_id: normalizedId,
    action: 'license.device_deactivated', entity_type: 'license', entity_id: license.id,
    data: { device_record_id: device.id },
  });
  return { license, deactivated: true };
}

async function licenseStatus({ licenseKey, deviceId }) {
  const license = await licenseByKey(licenseKey);
  let device = null;
  if (deviceId) {
    device = await db.selectOne('devices', { license_id: license.id, device_id: validateDeviceId(deviceId) });
  }
  const devices = await activeDevicesFor('license_id', license.id);
  return {
    licenseId: license.id,
    plan: license.plan,
    status: license.status,
    validUntil: license.valid_until,
    maxDevices: license.max_devices,
    registeredDevices: devices.length,
    maxConcurrentProductions: license.max_concurrent_productions,
    deviceRegistered: Boolean(device && !device.deactivated_at),
  };
}

async function activateMatchPass({ passKey, matchId, deviceId, deviceName }) {
  let pass = await matchPassByKey(passKey);
  const canonicalMatchId = validateMatchId(matchId);
  const now = new Date();

  if (pass.status === 'unused') {
    const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();
    const rows = await db.patch('match_passes', { id: pass.id }, {
      status: 'activated',
      match_id: canonicalMatchId,
      activated_at: now.toISOString(),
      expires_at: expiresAt,
    });
    pass = rows[0];
  } else if (pass.status === 'activated') {
    if (pass.match_id !== canonicalMatchId) {
      throw httpError(409, 'match_pass_locked', 'Match Pass is already bound to another match');
    }
  } else {
    throw httpError(403, 'match_pass_inactive', `Match Pass is ${pass.status}`);
  }

  if (!pass || Date.parse(pass.expires_at) <= Date.now()) {
    if (pass) await db.patch('match_passes', { id: pass.id }, { status: 'expired' });
    throw httpError(403, 'match_pass_expired', 'Match Pass has expired');
  }

  const device = await ensureMatchPassDevice(pass, { deviceId, deviceName });
  const entitlement = await issueMatchPassEntitlement(pass, device);
  await db.insert('audit_events', {
    actor_type: 'device', actor_id: device.device_id,
    action: 'match_pass.activated', entity_type: 'match_pass', entity_id: pass.id,
    data: { match_id: canonicalMatchId, expires_at: pass.expires_at, device_record_id: device.id },
  });
  return { pass, device, entitlement };
}

async function authorityFromKey(key, deviceId) {
  const value = String(key || '').trim().toUpperCase();
  const normalizedDeviceId = validateDeviceId(deviceId);

  if (value.startsWith('TFM-')) {
    const pass = await matchPassByKey(value);
    if (pass.status !== 'activated' || !pass.expires_at || Date.parse(pass.expires_at) <= Date.now()) {
      throw httpError(403, 'match_pass_inactive', 'Match Pass is not active');
    }
    const device = await db.selectOne('devices', { match_pass_id: pass.id, device_id: normalizedDeviceId });
    if (!device || device.deactivated_at) throw httpError(403, 'device_not_registered', 'Device is not registered');
    return { type: 'match-pass', pass, device, maxConcurrentProductions: 1, matchId: pass.match_id };
  }

  const license = await licenseByKey(value);
  const device = await db.selectOne('devices', { license_id: license.id, device_id: normalizedDeviceId });
  if (!device || device.deactivated_at) throw httpError(403, 'device_not_registered', 'Device is not registered');
  return {
    type: 'license', license, device,
    maxConcurrentProductions: license.max_concurrent_productions,
    matchId: null,
  };
}

module.exports = {
  activateLicense,
  activateMatchPass,
  authorityFromKey,
  deactivateLicense,
  issueLicenseEntitlement,
  issueMatchPassEntitlement,
  licenseByKey,
  licenseStatus,
  matchPassByKey,
  refreshLicense,
};
