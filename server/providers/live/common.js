// Společné pomůcky pro skutečné (live) poskytovatele: HTTP, mezipaměť a měsíční limity.

export class ProviderError extends Error {}

export async function getJson(url, { method = 'GET', headers = {}, body, timeoutMs = 15000 } = {}) {
  const res = await fetch(url, {
    method,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || data?.message || text.slice(0, 200);
    throw new ProviderError(`HTTP ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
  }
  if (data === null) throw new ProviderError('Odpověď není JSON.');
  return data;
}

// Mezipaměť v SQLite. ttlMs = jak dlouho výsledek platí.
export function makeCache(db) {
  const get = db.prepare('SELECT value FROM api_cache WHERE key = ? AND expires_at > ?');
  const put = db.prepare('INSERT OR REPLACE INTO api_cache (key, value, expires_at) VALUES (?, ?, ?)');
  const purge = db.prepare('DELETE FROM api_cache WHERE expires_at <= ?');
  let lastPurge = 0;
  return async function cached(key, ttlMs, load) {
    const now = Date.now();
    if (now - lastPurge > 3600000) { purge.run(now); lastPurge = now; }
    const hit = get.get(key, now);
    if (hit) return JSON.parse(hit.value);
    const value = await load();
    put.run(key, JSON.stringify(value), now + ttlMs);
    return value;
  };
}

// Měsíční počítadlo volání; vyhodí chybu, když by se překročil limit.
export function makeQuota(db) {
  const read = db.prepare('SELECT count FROM api_usage WHERE provider = ? AND month = ?');
  const bump = db.prepare(`INSERT INTO api_usage (provider, month, count) VALUES (?, ?, 1)
    ON CONFLICT(provider, month) DO UPDATE SET count = count + 1`);
  const month = () => new Date().toISOString().slice(0, 7);
  return {
    used: (provider) => read.get(provider, month())?.count || 0,
    take(provider, limit) {
      const used = read.get(provider, month())?.count || 0;
      if (used >= limit) throw new ProviderError(`Vyčerpán měsíční limit (${limit} hledání).`);
      bump.run(provider, month());
    },
  };
}

export const round10 = (n) => Math.round(n / 10) * 10;
