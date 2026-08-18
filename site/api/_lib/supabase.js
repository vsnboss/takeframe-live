function config() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured');
  return { url, key };
}

async function request(path, options = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
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
  const params = new URLSearchParams({ select, limit: '1' });
  for (const [key, value] of Object.entries(filters || {})) {
    params.set(key, `eq.${value}`);
  }
  const rows = await request(`/${table}?${params.toString()}`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function rpc(name, args) {
  return request(`/rpc/${name}`, {
    method: 'POST',
    body: JSON.stringify(args || {}),
  });
}

module.exports = { insert, request, rpc, selectOne, upsert };
