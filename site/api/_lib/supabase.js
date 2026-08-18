function config() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured');
  return { url, key };
}

function authHeaders(key) {
  const headers = { apikey: key };
  // Legacy service_role keys are JWTs and may be sent as Bearer tokens. Modern
  // sb_secret_* keys are not JWTs and Supabase requires them on the apikey
  // header only.
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function request(path, options = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1${path}`, {
    ...options,
    headers: {
      ...authHeaders(key),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${path} failed (${response.status}): ${text.slice(0, 800)}`);
  }
  if (!text) return null;
  return JSON.parse(text);
}

function filterParams(filters, initial = {}) {
  const params = new URLSearchParams(initial);
  for (const [key, value] of Object.entries(filters || {})) {
    params.set(key, `eq.${value}`);
  }
  return params;
}

async function upsert(table, row, conflict) {
  const params = conflict ? `?on_conflict=${encodeURIComponent(conflict)}` : '';
  const rows = await request(`/${table}${params}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function insert(table, row) {
  const rows = await request(`/${table}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function selectOne(table, filters, select = '*') {
  const params = filterParams(filters, { select, limit: '1' });
  const rows = await request(`/${table}?${params.toString()}`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function selectMany(table, filters, select = '*', limit = 100) {
  const params = filterParams(filters, { select, limit: String(limit) });
  const rows = await request(`/${table}?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

async function patch(table, filters, changes) {
  const params = filterParams(filters);
  const rows = await request(`/${table}?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(changes),
  });
  return Array.isArray(rows) ? rows : [];
}

async function rpc(name, args) {
  return request(`/rpc/${name}`, {
    method: 'POST',
    body: JSON.stringify(args || {}),
  });
}

module.exports = { insert, patch, request, rpc, selectMany, selectOne, upsert };
