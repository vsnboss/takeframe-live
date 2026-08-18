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

function entitlementPayload({ license, device, matchId = null, now = new Date() }) {
  const issuedAt = now.toISOString();
  const requestedOfflineUntil = new Date(now.getTime() + offlineHours() * 60 * 60 * 1000).toISOString();
  const offlineUntil = minIso(requestedOfflineUntil, license.valid_until) || requestedOfflineUntil;

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
    issuedAt,
    validUntil: license.valid_until,
    offlineUntil,
    keyId: signingConfig().keyId,
  };
}

function signPayload(payload) {
  const { privateKey, keyId } = signingConfig();
  if (payload.keyId !== keyId) throw new Error('Entitlement key id mismatch');
  const serialized = JSON.stringify(payload);
  const signature = crypto.sign(null, Buffer.from(serialized, 'utf8'), privateKey).toString('base64url');
  return { payload, signature, serialized };
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

function validateDeviceId(value) {
  const deviceId = String(value || '').trim();
  if (deviceId.length < 8 || deviceId.length > 256) {
    throw httpError(400, 'invalid_device_id', 'deviceId must be between 8 and 256 characters');
  }
  return deviceId;
}

async function activeDevices(licenseId) {
  const params = new URLSearchParams({
    select: '*',
    license_id: `eq.${licenseId}`,
    deactivated_at: 'is.null',
    limit: '100',
  });
  const rows = await db.request(`/devices?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

async function ensureDevice(license, { deviceId, deviceName }) {
  const normalizedId = validateDeviceId(deviceId);
  const existing = await db.selectOne('devices', {
    license_id: license.id,
    device_id: normalizedId,
  });

  if (existing && !existing.deactivated_at) {
    const updated = await db.patch('devices', { id: existing.id }, {
      device_name: deviceName || existing.device_name || null,
      last_seen_at: new Date().toISOString(),
    });
    return updated[0] || existing;
  }

  const active = await activeDevices(license.id);
  if (active.length >= license.max_devices) {
    throw httpError(409, 'device_limit_reached', `This licence allows ${license.max_devices} registered devices`);
  }

  // A previously deactivated identity is reactivated rather than duplicated.
  if (existing) {
    const rows = await db.patch('devices', { id: existing.id }, {
      device_name: deviceName || existing.device_name || null,
      deactivated_at: null,
      last_seen_at: new Date().toISOString(),
    });
    return rows[0];
  }

  return db.insert('devices', {
    license_id: license.id,
    device_id: normalizedId,
    device_name: deviceName || null,
    platform: 'windows',
    last_seen_at: new Date().toISOString(),
  });
}

async function issueEntitlement(license, device, matchId = null) {
  assertLicenseAuthority(license);
  const signed = signPayload(entitlementPayload({ license, device, matchId }));
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
  return { payload: signed.payload, signature: signed.signature };
}

async function activateLicense({ licenseKey, deviceId, deviceName }) {
  const license = await licenseByKey(licenseKey);
  const device = await ensureDevice(license, { deviceId, deviceName });
  const entitlement = await issueEntitlement(license, device);
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
  return { license, device, entitlement: await issueEntitlement(license, device) };
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
  const devices = await activeDevices(license.id);
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

module.exports = {
  activateLicense,
  deactivateLicense,
  issueEntitlement,
  licenseByKey,
  licenseStatus,
  refreshLicense,
};
