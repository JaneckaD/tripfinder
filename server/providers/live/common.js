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
  let lastPurge = 0;
  return async function cached(key, ttlMs, load) {
    const now = Date.now();
    if (now - lastPurge > 3600000) { lastPurge = now; await db.run('DELETE FROM api_cache WHERE expires_at <= ?', now); }
    const hit = await db.get('SELECT value FROM api_cache WHERE key = ? AND expires_at > ?', key, now);
    if (hit) return JSON.parse(hit.value);
    const value = await load();
    await db.run('INSERT OR REPLACE INTO api_cache (key, value, expires_at) VALUES (?, ?, ?)', key, JSON.stringify(value), now + ttlMs);
    return value;
  };
}

// Měsíční počítadlo volání; vyhodí chybu, když by se překročil limit.
export function makeQuota(db) {
  const month = () => new Date().toISOString().slice(0, 7);
  const used = async (provider) => (await db.get('SELECT count FROM api_usage WHERE provider = ? AND month = ?', provider, month()))?.count || 0;
  return {
    used,
    async take(provider, limit) {
      if ((await used(provider)) >= limit) throw new ProviderError(`Vyčerpán měsíční limit (${limit} hledání).`);
      await db.run(`INSERT INTO api_usage (provider, month, count) VALUES (?, ?, 1)
        ON CONFLICT(provider, month) DO UPDATE SET count = count + 1`, provider, month());
    },
  };
}

export const round10 = (n) => Math.round(n / 10) * 10;
