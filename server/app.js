import express from 'express';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { COOKIE, createSession, hashPassword, loadUser, requireUser, sessionCookie, verifyPassword } from './auth.js';
import { CONTINENTS, TAGS, findDestination, searchDestinations } from './data/destinations.js';
import { createProviders } from './providers/index.js';
import { createExtras } from './extras.js';

const PUBLIC_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'public');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createApp(db, { secureCookies = process.env.NODE_ENV === 'production', env = process.env } = {}) {
  const providers = createProviders(db, env);
  const extras = createExtras(db);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));
  app.use(loadUser(db));

  const api = express.Router();
  const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

  // ---------- Přihlášení ----------
  api.post('/auth/register', async (req, res) => {
    const { email, password, name } = req.body || {};
    if (!EMAIL_RE.test(email || '')) return bad(res, 'Zadej platný e-mail.');
    if (!password || password.length < 8) return bad(res, 'Heslo musí mít aspoň 8 znaků.');
    if (await db.get('SELECT 1 FROM users WHERE email = ?', email.trim())) return bad(res, 'Účet s tímto e-mailem už existuje.', 409);
    const { lastInsertRowid: id } = await db.run('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)',
      email.trim(), (name || email.split('@')[0]).trim().slice(0, 80), hashPassword(password));
    // Připojí pozvánky na výlety, které čekaly na tento e-mail.
    await db.run('UPDATE trip_members SET user_id = ? WHERE email = ? AND user_id IS NULL', id, email.trim());
    const s = await createSession(db, id);
    res.setHeader('Set-Cookie', sessionCookie(s.token, s.expires, secureCookies));
    res.status(201).json({ user: await db.get('SELECT id, email, name FROM users WHERE id = ?', id) });
  });

  api.post('/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    const user = await db.get('SELECT * FROM users WHERE email = ?', String(email || '').trim());
    if (!user || !verifyPassword(password || '', user.password_hash)) return bad(res, 'Špatný e-mail nebo heslo.', 401);
    const s = await createSession(db, user.id);
    res.setHeader('Set-Cookie', sessionCookie(s.token, s.expires, secureCookies));
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  });

  api.post('/auth/logout', async (req, res) => {
    if (req.sessionToken) await db.run('DELETE FROM sessions WHERE token = ?', req.sessionToken);
    res.setHeader('Set-Cookie', sessionCookie('', null, secureCookies));
    res.json({ ok: true });
  });

  api.get('/auth/me', (req, res) => res.json({ user: req.user }));

  // ---------- Vyhledávání ----------
  api.get('/meta', async (_req, res) => res.json({ continents: CONTINENTS, tags: TAGS, providers: providers.list(), serpapi: await providers.serpapiUsage() }));

  api.get('/destinations', (req, res) => {
    const { continent, q, tags, maxBudget, persons, nights, month, sort } = req.query;
    res.json({ results: searchDestinations({ continent, q, tags, maxBudget, persons, nights, month, sort }) });
  });

  api.get('/destinations/:id', (req, res) => {
    const dest = findDestination(req.params.id);
    if (!dest) return bad(res, 'Destinace nenalezena.', 404);
    res.json({ destination: dest, continentName: CONTINENTS[dest.continent], tagNames: dest.tags.map((t) => TAGS[t]) });
  });

  // Fotka destinace (přesměrování na obrázek z Wikimedia Commons)
  api.get('/destinations/:id/photo', async (req, res) => {
    const dest = findDestination(req.params.id);
    if (!dest) return bad(res, 'Destinace nenalezena.', 404);
    const photo = await extras.photo(dest).catch(() => null);
    if (!photo) return bad(res, 'Fotka není k dispozici.', 404);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.redirect(302, photo.url);
  });

  api.get('/destinations/:id/weather', async (req, res) => {
    const dest = findDestination(req.params.id);
    if (!dest) return bad(res, 'Destinace nenalezena.', 404);
    try { res.json(await extras.weather(dest)); } catch { bad(res, 'Počasí teď není k dispozici.', 502); }
  });

  api.get('/destinations/:id/offers', async (req, res) => {
    const dest = findDestination(req.params.id);
    if (!dest) return bad(res, 'Destinace nenalezena.', 404);
    const { from, to, persons, origin } = req.query;
    if (from && to && new Date(to) <= new Date(from)) return bad(res, 'Datum návratu musí být po datu odjezdu.');
    res.json(await providers.search(dest, { from, to, persons, origin }));
  });

  // ---------- Výlety ----------
  const tripRole = async (tripId, userId) => {
    const trip = await db.get('SELECT * FROM trips WHERE id = ?', tripId);
    if (!trip) return { trip: null, role: null };
    if (trip.owner_id === userId) return { trip, role: 'owner' };
    const m = await db.get('SELECT role FROM trip_members WHERE trip_id = ? AND user_id = ?', tripId, userId);
    return { trip, role: m?.role || null };
  };

  const withTrip = (minRole) => async (req, res, next) => {
    const { trip, role } = await tripRole(Number(req.params.id) || 0, req.user.id);
    if (!trip || !role) return bad(res, 'Výlet nenalezen.', 404);
    const rank = { viewer: 1, editor: 2, owner: 3 };
    if (rank[role] < rank[minRole]) return bad(res, 'Na tuto akci nemáš oprávnění.', 403);
    req.trip = trip;
    req.role = role;
    next();
  };

  const tripDetail = async (trip, role) => {
    const [itemRows, members, owner] = await Promise.all([
      db.all('SELECT * FROM trip_items WHERE trip_id = ? ORDER BY created_at, id', trip.id),
      db.all(`SELECT m.id, m.email, m.role, m.user_id, u.name FROM trip_members m
        LEFT JOIN users u ON u.id = m.user_id WHERE m.trip_id = ? ORDER BY m.id`, trip.id),
      db.get('SELECT id, name, email FROM users WHERE id = ?', trip.owner_id),
    ]);
    const items = itemRows.map((it) => ({ ...it, data: JSON.parse(it.data) }));
    const total = items.reduce((sum, it) => sum + (it.price || 0), 0);
    return { trip: { ...trip, share_token: role === 'owner' ? trip.share_token : undefined }, role, owner, items, members, total };
  };

  api.get('/trips', requireUser, async (req, res) => {
    const trips = await db.all(`
      SELECT t.*, CASE WHEN t.owner_id = ? THEN 'owner' ELSE m.role END AS role,
        (SELECT COUNT(*) FROM trip_items i WHERE i.trip_id = t.id) AS item_count,
        (SELECT COALESCE(SUM(price), 0) FROM trip_items i WHERE i.trip_id = t.id) AS total,
        (SELECT COUNT(*) FROM trip_members mm WHERE mm.trip_id = t.id) AS member_count,
        (SELECT data FROM trip_items i WHERE i.trip_id = t.id AND i.kind = 'destination' ORDER BY i.id LIMIT 1) AS cover_data
      FROM trips t LEFT JOIN trip_members m ON m.trip_id = t.id AND m.user_id = ?
      WHERE t.owner_id = ? OR m.user_id = ?
      ORDER BY t.updated_at DESC`, req.user.id, req.user.id, req.user.id, req.user.id);
    res.json({ trips: trips.map(({ cover_data, ...t }) => ({ ...t, cover: cover_data ? JSON.parse(cover_data).destinationId || null : null })) });
  });

  api.post('/trips', requireUser, async (req, res) => {
    const { title, note = '', start_date = null, end_date = null, persons = 2, budget = null } = req.body || {};
    if (!title?.trim()) return bad(res, 'Výlet potřebuje název.');
    const { lastInsertRowid } = await db.run('INSERT INTO trips (owner_id, title, note, start_date, end_date, persons, budget) VALUES (?, ?, ?, ?, ?, ?, ?)',
      req.user.id, title.trim().slice(0, 120), String(note).slice(0, 2000), start_date || null, end_date || null, Number(persons) || 2, Number(budget) > 0 ? Number(budget) : null);
    const trip = await db.get('SELECT * FROM trips WHERE id = ?', lastInsertRowid);
    res.status(201).json(await tripDetail(trip, 'owner'));
  });

  api.get('/trips/:id', requireUser, withTrip('viewer'), async (req, res) => res.json(await tripDetail(req.trip, req.role)));

  api.patch('/trips/:id', requireUser, withTrip('editor'), async (req, res) => {
    const t = { ...req.trip, ...pickFields(req.body, ['title', 'note', 'start_date', 'end_date', 'persons', 'budget']) };
    if (!String(t.title || '').trim()) return bad(res, 'Výlet potřebuje název.');
    const budget = Number(t.budget) > 0 ? Number(t.budget) : null;
    await db.run(`UPDATE trips SET title = ?, note = ?, start_date = ?, end_date = ?, persons = ?, budget = ?, updated_at = datetime('now') WHERE id = ?`,
      String(t.title).trim().slice(0, 120), String(t.note || '').slice(0, 2000), t.start_date || null, t.end_date || null, Number(t.persons) || 1, budget, t.id);
    res.json(await tripDetail(await db.get('SELECT * FROM trips WHERE id = ?', t.id), req.role));
  });

  api.delete('/trips/:id', requireUser, withTrip('owner'), async (req, res) => {
    await db.batch([
      ['DELETE FROM trip_items WHERE trip_id = ?', req.trip.id],
      ['DELETE FROM trip_members WHERE trip_id = ?', req.trip.id],
      ['DELETE FROM trips WHERE id = ?', req.trip.id],
    ]);
    res.json({ ok: true });
  });

  // Položky výletu (uložená destinace / doprava / ubytování / poznámka)
  api.post('/trips/:id/items', requireUser, withTrip('editor'), async (req, res) => {
    const { kind, data } = req.body || {};
    if (!['destination', 'transport', 'lodging', 'note'].includes(kind)) return bad(res, 'Neznámý typ položky.');
    if (!data || typeof data !== 'object') return bad(res, 'Chybí data položky.');
    const price = Number.isFinite(Number(data.price)) && kind !== 'destination' ? Number(data.price) : null;
    await db.batch([
      ['INSERT INTO trip_items (trip_id, kind, data, price, currency, added_by) VALUES (?, ?, ?, ?, ?, ?)',
        req.trip.id, kind, JSON.stringify(data).slice(0, 20000), price, data.currency || (price != null ? 'CZK' : null), req.user.id],
      [`UPDATE trips SET updated_at = datetime('now') WHERE id = ?`, req.trip.id],
    ]);
    res.status(201).json(await tripDetail(req.trip, req.role));
  });

  api.delete('/trips/:id/items/:itemId', requireUser, withTrip('editor'), async (req, res) => {
    await db.run('DELETE FROM trip_items WHERE id = ? AND trip_id = ?', Number(req.params.itemId) || 0, req.trip.id);
    res.json(await tripDetail(req.trip, req.role));
  });

  // Spolucestující
  api.post('/trips/:id/members', requireUser, withTrip('owner'), async (req, res) => {
    const { email, role = 'editor' } = req.body || {};
    if (!EMAIL_RE.test(email || '')) return bad(res, 'Zadej platný e-mail spolucestujícího.');
    if (!['editor', 'viewer'].includes(role)) return bad(res, 'Neplatná role.');
    if (email.trim().toLowerCase() === req.user.email.toLowerCase()) return bad(res, 'Sebe přidávat nemusíš, výlet je tvůj.');
    const existing = await db.get('SELECT id FROM users WHERE email = ?', email.trim());
    await db.run(`INSERT INTO trip_members (trip_id, user_id, email, role) VALUES (?, ?, ?, ?)
      ON CONFLICT(trip_id, email) DO UPDATE SET role = excluded.role`, req.trip.id, existing?.id ?? null, email.trim(), role);
    res.status(201).json(await tripDetail(req.trip, req.role));
  });

  api.delete('/trips/:id/members/:memberId', requireUser, withTrip('viewer'), async (req, res) => {
    const m = await db.get('SELECT * FROM trip_members WHERE id = ? AND trip_id = ?', Number(req.params.memberId) || 0, req.trip.id);
    if (!m) return bad(res, 'Spolucestující nenalezen.', 404);
    // Vlastník může odebrat kohokoli, člen může odejít sám.
    if (req.role !== 'owner' && m.user_id !== req.user.id) return bad(res, 'Na tuto akci nemáš oprávnění.', 403);
    await db.run('DELETE FROM trip_members WHERE id = ?', m.id);
    res.json(req.role === 'owner' ? await tripDetail(req.trip, req.role) : { ok: true, left: true });
  });

  // Sdílení odkazem (jen ke čtení)
  api.post('/trips/:id/share', requireUser, withTrip('owner'), async (req, res) => {
    const enabled = req.body?.enabled !== false;
    const token = enabled ? req.trip.share_token || randomBytes(12).toString('base64url') : null;
    await db.run('UPDATE trips SET share_token = ? WHERE id = ?', token, req.trip.id);
    res.json({ share_token: token });
  });

  api.get('/shared/:token', async (req, res) => {
    const trip = await db.get('SELECT * FROM trips WHERE share_token = ?', req.params.token);
    if (!trip) return bad(res, 'Sdílený výlet neexistuje nebo už není sdílený.', 404);
    const detail = await tripDetail(trip, 'viewer');
    detail.members = detail.members.map((m) => ({ name: m.name || m.email.split('@')[0], role: m.role }));
    detail.owner = { name: detail.owner.name };
    res.json(detail);
  });

  api.use((_req, res) => bad(res, 'Neznámý endpoint.', 404));
  app.use('/api', api);

  // ---------- Frontend (PWA) ----------
  app.use(express.static(PUBLIC_DIR, {
    setHeaders(res, path) {
      if (path.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
    },
  }));
  app.get('/{*path}', (_req, res) => res.sendFile(join(PUBLIC_DIR, 'index.html')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status === 400 ? 'Neplatný požadavek.' : 'Něco se pokazilo na serveru.' });
  });

  return app;
}

function pickFields(obj = {}, keys) {
  return Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));
}

export { COOKIE };
