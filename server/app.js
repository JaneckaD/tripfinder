import express from 'express';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { COOKIE, createSession, hashPassword, loadUser, requireUser, sessionCookie, verifyPassword } from './auth.js';
import { CONTINENTS, TAGS, findDestination, searchDestinations } from './data/destinations.js';
import { listProviders, searchOffers } from './providers/index.js';

const PUBLIC_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'public');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createApp(db, { secureCookies = process.env.NODE_ENV === 'production' } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));
  app.use(loadUser(db));

  const api = express.Router();
  const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

  // ---------- Přihlášení ----------
  api.post('/auth/register', (req, res) => {
    const { email, password, name } = req.body || {};
    if (!EMAIL_RE.test(email || '')) return bad(res, 'Zadej platný e-mail.');
    if (!password || password.length < 8) return bad(res, 'Heslo musí mít aspoň 8 znaků.');
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return bad(res, 'Účet s tímto e-mailem už existuje.', 409);
    const { lastInsertRowid: id } = db
      .prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)')
      .run(email.trim(), (name || email.split('@')[0]).trim().slice(0, 80), hashPassword(password));
    // Připojí pozvánky na výlety, které čekaly na tento e-mail.
    db.prepare('UPDATE trip_members SET user_id = ? WHERE email = ? AND user_id IS NULL').run(id, email.trim());
    const s = createSession(db, id);
    res.setHeader('Set-Cookie', sessionCookie(s.token, s.expires, secureCookies));
    res.status(201).json({ user: db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(id) });
  });

  api.post('/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email || '');
    if (!user || !verifyPassword(password || '', user.password_hash)) return bad(res, 'Špatný e-mail nebo heslo.', 401);
    const s = createSession(db, user.id);
    res.setHeader('Set-Cookie', sessionCookie(s.token, s.expires, secureCookies));
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  });

  api.post('/auth/logout', (req, res) => {
    if (req.sessionToken) db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
    res.setHeader('Set-Cookie', sessionCookie('', null, secureCookies));
    res.json({ ok: true });
  });

  api.get('/auth/me', (req, res) => res.json({ user: req.user }));

  // ---------- Vyhledávání ----------
  api.get('/meta', (_req, res) => res.json({ continents: CONTINENTS, tags: TAGS, providers: listProviders() }));

  api.get('/destinations', (req, res) => {
    const { continent, q, tags, maxBudget, persons, nights, month, sort } = req.query;
    res.json({ results: searchDestinations({ continent, q, tags, maxBudget, persons, nights, month, sort }) });
  });

  api.get('/destinations/:id', (req, res) => {
    const dest = findDestination(req.params.id);
    if (!dest) return bad(res, 'Destinace nenalezena.', 404);
    res.json({ destination: dest, continentName: CONTINENTS[dest.continent], tagNames: dest.tags.map((t) => TAGS[t]) });
  });

  api.get('/destinations/:id/offers', async (req, res) => {
    const dest = findDestination(req.params.id);
    if (!dest) return bad(res, 'Destinace nenalezena.', 404);
    const { from, to, persons, origin } = req.query;
    if (from && to && new Date(to) <= new Date(from)) return bad(res, 'Datum návratu musí být po datu odjezdu.');
    res.json(await searchOffers(dest, { from, to, persons, origin }));
  });

  // ---------- Výlety ----------
  const tripRole = (tripId, userId) => {
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) return { trip: null, role: null };
    if (trip.owner_id === userId) return { trip, role: 'owner' };
    const m = db.prepare('SELECT role FROM trip_members WHERE trip_id = ? AND user_id = ?').get(tripId, userId);
    return { trip, role: m?.role || null };
  };

  const withTrip = (minRole) => (req, res, next) => {
    const { trip, role } = tripRole(Number(req.params.id), req.user.id);
    if (!trip || !role) return bad(res, 'Výlet nenalezen.', 404);
    const rank = { viewer: 1, editor: 2, owner: 3 };
    if (rank[role] < rank[minRole]) return bad(res, 'Na tuto akci nemáš oprávnění.', 403);
    req.trip = trip;
    req.role = role;
    next();
  };

  const tripDetail = (trip, role) => {
    const items = db.prepare('SELECT * FROM trip_items WHERE trip_id = ? ORDER BY created_at, id').all(trip.id)
      .map((it) => ({ ...it, data: JSON.parse(it.data) }));
    const members = db.prepare(`
      SELECT m.id, m.email, m.role, m.user_id, u.name FROM trip_members m
      LEFT JOIN users u ON u.id = m.user_id WHERE m.trip_id = ? ORDER BY m.id`).all(trip.id);
    const owner = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(trip.owner_id);
    const total = items.reduce((sum, it) => sum + (it.price || 0), 0);
    return { trip: { ...trip, share_token: role === 'owner' ? trip.share_token : undefined }, role, owner, items, members, total };
  };

  api.get('/trips', requireUser, (req, res) => {
    const trips = db.prepare(`
      SELECT t.*, CASE WHEN t.owner_id = ? THEN 'owner' ELSE m.role END AS role,
        (SELECT COUNT(*) FROM trip_items i WHERE i.trip_id = t.id) AS item_count,
        (SELECT COALESCE(SUM(price), 0) FROM trip_items i WHERE i.trip_id = t.id) AS total,
        (SELECT COUNT(*) FROM trip_members mm WHERE mm.trip_id = t.id) AS member_count
      FROM trips t LEFT JOIN trip_members m ON m.trip_id = t.id AND m.user_id = ?
      WHERE t.owner_id = ? OR m.user_id = ?
      ORDER BY t.updated_at DESC`).all(req.user.id, req.user.id, req.user.id, req.user.id);
    res.json({ trips });
  });

  api.post('/trips', requireUser, (req, res) => {
    const { title, note = '', start_date = null, end_date = null, persons = 2 } = req.body || {};
    if (!title?.trim()) return bad(res, 'Výlet potřebuje název.');
    const { lastInsertRowid } = db
      .prepare('INSERT INTO trips (owner_id, title, note, start_date, end_date, persons) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, title.trim().slice(0, 120), String(note).slice(0, 2000), start_date || null, end_date || null, Number(persons) || 2);
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(lastInsertRowid);
    res.status(201).json(tripDetail(trip, 'owner'));
  });

  api.get('/trips/:id', requireUser, withTrip('viewer'), (req, res) => res.json(tripDetail(req.trip, req.role)));

  api.patch('/trips/:id', requireUser, withTrip('editor'), (req, res) => {
    const t = { ...req.trip, ...pickFields(req.body, ['title', 'note', 'start_date', 'end_date', 'persons']) };
    if (!String(t.title || '').trim()) return bad(res, 'Výlet potřebuje název.');
    db.prepare(`UPDATE trips SET title = ?, note = ?, start_date = ?, end_date = ?, persons = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(String(t.title).trim().slice(0, 120), String(t.note || '').slice(0, 2000), t.start_date || null, t.end_date || null, Number(t.persons) || 1, t.id);
    res.json(tripDetail(db.prepare('SELECT * FROM trips WHERE id = ?').get(t.id), req.role));
  });

  api.delete('/trips/:id', requireUser, withTrip('owner'), (req, res) => {
    db.prepare('DELETE FROM trips WHERE id = ?').run(req.trip.id);
    res.json({ ok: true });
  });

  // Položky výletu (uložená destinace / doprava / ubytování / poznámka)
  api.post('/trips/:id/items', requireUser, withTrip('editor'), (req, res) => {
    const { kind, data } = req.body || {};
    if (!['destination', 'transport', 'lodging', 'note'].includes(kind)) return bad(res, 'Neznámý typ položky.');
    if (!data || typeof data !== 'object') return bad(res, 'Chybí data položky.');
    const price = Number.isFinite(Number(data.price)) && kind !== 'destination' ? Number(data.price) : null;
    db.prepare('INSERT INTO trip_items (trip_id, kind, data, price, currency, added_by) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.trip.id, kind, JSON.stringify(data).slice(0, 20000), price, data.currency || (price != null ? 'CZK' : null), req.user.id);
    db.prepare(`UPDATE trips SET updated_at = datetime('now') WHERE id = ?`).run(req.trip.id);
    res.status(201).json(tripDetail(req.trip, req.role));
  });

  api.delete('/trips/:id/items/:itemId', requireUser, withTrip('editor'), (req, res) => {
    db.prepare('DELETE FROM trip_items WHERE id = ? AND trip_id = ?').run(Number(req.params.itemId), req.trip.id);
    res.json(tripDetail(req.trip, req.role));
  });

  // Spolucestující
  api.post('/trips/:id/members', requireUser, withTrip('owner'), (req, res) => {
    const { email, role = 'editor' } = req.body || {};
    if (!EMAIL_RE.test(email || '')) return bad(res, 'Zadej platný e-mail spolucestujícího.');
    if (!['editor', 'viewer'].includes(role)) return bad(res, 'Neplatná role.');
    if (email.trim().toLowerCase() === req.user.email.toLowerCase()) return bad(res, 'Sebe přidávat nemusíš, výlet je tvůj.');
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim());
    db.prepare(`INSERT INTO trip_members (trip_id, user_id, email, role) VALUES (?, ?, ?, ?)
      ON CONFLICT(trip_id, email) DO UPDATE SET role = excluded.role`).run(req.trip.id, existing?.id ?? null, email.trim(), role);
    res.status(201).json(tripDetail(req.trip, req.role));
  });

  api.delete('/trips/:id/members/:memberId', requireUser, withTrip('viewer'), (req, res) => {
    const m = db.prepare('SELECT * FROM trip_members WHERE id = ? AND trip_id = ?').get(Number(req.params.memberId), req.trip.id);
    if (!m) return bad(res, 'Spolucestující nenalezen.', 404);
    // Vlastník může odebrat kohokoli, člen může odejít sám.
    if (req.role !== 'owner' && m.user_id !== req.user.id) return bad(res, 'Na tuto akci nemáš oprávnění.', 403);
    db.prepare('DELETE FROM trip_members WHERE id = ?').run(m.id);
    res.json(req.role === 'owner' ? tripDetail(req.trip, req.role) : { ok: true, left: true });
  });

  // Sdílení odkazem (jen ke čtení)
  api.post('/trips/:id/share', requireUser, withTrip('owner'), (req, res) => {
    const enabled = req.body?.enabled !== false;
    const token = enabled ? req.trip.share_token || randomBytes(12).toString('base64url') : null;
    db.prepare('UPDATE trips SET share_token = ? WHERE id = ?').run(token, req.trip.id);
    res.json({ share_token: token });
  });

  api.get('/shared/:token', (req, res) => {
    const trip = db.prepare('SELECT * FROM trips WHERE share_token = ?').get(req.params.token);
    if (!trip) return bad(res, 'Sdílený výlet neexistuje nebo už není sdílený.', 404);
    const detail = tripDetail(trip, 'viewer');
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
