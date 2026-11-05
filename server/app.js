import express from 'express';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { COOKIE, createSession, hashPassword, loadUser, requireUser, sessionCookie, verifyPassword } from './auth.js';
import { CONTINENTS, TAGS, searchDestinations } from './data/destinations.js';
import { LIVE_META } from './data/live-meta.js';
import { countryInfo, geoId, makePlaceSearch, placeDestination, resolveDestination, resolveOrigin } from './geo.js';
import { createDeals } from './deals.js';
import { createDirections, createExplore, createGems, createTrending } from './explore.js';
import { makeCache } from './providers/live/common.js';
import { createProviders } from './providers/index.js';
import { createExtras } from './extras.js';
import { profileOf, socialRouter } from './social.js';
import { plannerRoutes } from './planner.js';
import { indexHtml } from './icons.js';
import { mediaRoutes } from './media.js';
import compression from 'compression';
import { liveMiddleware, liveRoutes } from './live.js';
import { countries } from 'countries-list';

const PUBLIC_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'public');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createApp(db, { secureCookies = process.env.NODE_ENV === 'production', env = process.env } = {}) {
  const providers = createProviders(db, env);
  const extras = createExtras(db);
  const cached = makeCache(db);
  const searchPlaces = makePlaceSearch(cached);
  const deals = createDeals({ env, cached });
  const explore = createExplore({ cached });
  const directions = createDirections({ cached });
  const gems = createGems({ cached });
  const trending = createTrending({ cached });
  const point = (v) => {
    const [lat, lng] = String(v || '').split(',').map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  };
  const app = express();
  app.disable('x-powered-by');
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(loadUser(db));
  app.use(liveMiddleware(db));

  const api = express.Router();
  liveRoutes(api);
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

  api.get('/auth/me', async (req, res) => {
    if (!req.user) return res.json({ user: null });
    res.json({ user: req.user, profile: profileOf(await db.get('SELECT * FROM users WHERE id = ?', req.user.id)) });
  });
  api.use(socialRouter(db));
  // Seznam zemí pro profil (česky, s vlajkou)
  const COUNTRY_LIST = Object.entries(countries).map(([cc, c]) => ({ cc, name: countryInfo(cc).name || c.name, langs: c.languages || [] }))
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  api.get('/countries', (_req, res) => { res.setHeader('Cache-Control', 'public, max-age=86400'); res.json({ countries: COUNTRY_LIST }); });

  // ---------- Vyhledávání ----------
  api.get('/meta', async (_req, res) => res.json({ continents: CONTINENTS, tags: TAGS, providers: providers.list(), serpapi: await providers.serpapiUsage() }));

  api.get('/destinations', (req, res) => {
    const { continent, q, tags, maxBudget, persons, nights, month, sort } = req.query;
    res.json({ results: searchDestinations({ continent, q, tags, maxBudget, persons, nights, month, sort }).map((d) => ({ ...d, cc: LIVE_META[d.id]?.cc || '' })) });
  });

  api.get('/destinations/:id', (req, res) => {
    const dest = resolveDestination(req.params.id);
    if (!dest) return bad(res, 'Destinace nenalezena.', 404);
    res.json({ destination: dest, langCodes: countries[dest.cc]?.languages || [], continentName: CONTINENTS[dest.continent], tagNames: dest.tags.map((t) => TAGS[t]) });
  });

  // Našeptávač míst po celém světě (města, adresy, památky)
  api.get('/places', async (req, res) => {
    const q = String(req.query.q || '').slice(0, 120);
    res.json({ results: await searchPlaces(q, { limit: Math.min(10, Number(req.query.limit) || 8) }) });
  });

  // Prozkoumat: zajímavá místa s fotkami v okolí bodu
  api.get('/explore', async (req, res) => {
    const p = point(`${req.query.lat},${req.query.lng}`);
    if (!p) return bad(res, 'Chybí souřadnice.');
    try { res.json({ places: await explore.nearby(p.lat, p.lng, Number(req.query.radius) || 10000) }); } catch { bad(res, 'Místa v okolí teď nejdou načíst.', 502); }
  });
  // Hidden gems: méně známá místa z OpenStreetMap s fotkami z Wikimedia Commons
  api.get('/explore/gems', async (req, res) => {
    const p = point(`${req.query.lat},${req.query.lng}`);
    if (!p) return bad(res, 'Chybí souřadnice.');
    try { res.json({ places: await gems(p.lat, p.lng, Number(req.query.radius) || 8000) }); } catch { bad(res, 'Hidden gems teď nejdou načíst.', 502); }
  });
  // Co je teď trendy na sociálních sítích (Reddit) v okolí nebo u místa
  api.get('/explore/trending', async (req, res) => {
    const p = point(`${req.query.lat},${req.query.lng}`);
    if (!p && !req.query.q) return bad(res, 'Chybí místo.');
    try { res.json(await trending({ ...(p || {}), q: String(req.query.q || '').slice(0, 80) })); } catch { res.json({ place: String(req.query.q || ''), posts: [], unavailable: true }); }
  });
  api.get('/explore/place', async (req, res) => {
    if (!req.query.title) return bad(res, 'Chybí název místa.');
    try { res.json(await explore.place(String(req.query.lang || 'cs'), String(req.query.title).slice(0, 200))); } catch { bad(res, 'Detail místa teď nejde načíst.', 502); }
  });
  // Trasa pěšky / autem s navigací po krocích
  api.get('/directions', async (req, res) => {
    const from = point(req.query.from); const to = point(req.query.to);
    if (!from || !to) return bad(res, 'Chybí odkud nebo kam.');
    res.json(await directions(from, to, req.query.mode === 'foot' ? 'foot' : 'car'));
  });
  // Odkazy na fotky katalogových destinací, které už server zná (prohlížeč je pak načte rovnou).
  api.get('/photos', async (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(await extras.knownPhotos());
  });

  // Akční letenky a ubytování na 6 měsíců dopředu
  api.get('/deals', async (req, res) => res.json(await deals(req.query.origin)));

  // Okružní cesta přes více měst: doprava mezi zastávkami + ubytování v každé z nich
  api.post('/route-plan', async (req, res) => {
    const { origin = 'PRG', start, persons = 2, stops = [], returnHome = true } = req.body || {};
    if (!Array.isArray(stops) || !stops.length) return bad(res, 'Přidej aspoň jednu zastávku.');
    if (stops.length > 8) return bad(res, 'Okružní cesta může mít nejvýš 8 zastávek.');
    const o = resolveOrigin(origin);
    const home = resolveDestination(o.id) || placeDestination(geoId(o));
    const places = stops.map((s) => ({ dest: resolveDestination(s.id), nights: Math.min(30, Math.max(1, Number(s.nights) || 2)) }));
    if (places.some((p) => !p.dest)) return bad(res, 'Některou zastávku se nepodařilo najít.');
    const day0 = start && !Number.isNaN(Date.parse(start)) ? new Date(start) : new Date(Date.now() + 30 * 86400000);
    const iso = (d) => d.toISOString().slice(0, 10);
    const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
    const pt = (d) => ({ id: d.id, name: d.name, country: d.country, cc: d.cc, lat: d.lat, lng: d.lng, emoji: d.emoji });

    let day = day0;
    let prev = { id: o.id, point: { name: o.name, lat: o.lat, lng: o.lng, cc: o.cc } };
    const legJobs = []; const stayJobs = [];
    for (const p of places) {
      legJobs.push({ from: prev, to: p.dest, date: iso(day) });
      stayJobs.push({ dest: p.dest, from: iso(day), to: iso(addDays(day, p.nights)), nights: p.nights });
      day = addDays(day, p.nights);
      prev = { id: p.dest.id, point: pt(p.dest) };
    }
    if (returnHome) legJobs.push({ from: prev, to: home, date: iso(day) });

    const top = (list, n = 4) => {
      const cheapest = [...list].sort((a, b) => a.price - b.price);
      const fastest = [...list].filter((x) => x.durationMin).sort((a, b) => a.durationMin - b.durationMin);
      const out = [];
      for (const x of [cheapest[0], fastest[0], ...cheapest]) if (x && !out.includes(x) && out.length < n) out.push(x);
      return out;
    };
    const [legs, stays] = await Promise.all([
      Promise.all(legJobs.map(async (j) => {
        const r = await providers.search(j.to, { origin: j.from.id, from: j.date, to: iso(addDays(new Date(j.date), 1)), persons, oneWay: true }, { kinds: ['transport'], skip: ['google-flights'] });
        return { from: j.from.point, to: pt(j.to), date: j.date, distanceKm: r.context.distanceKm, options: top(r.offers.transport), links: r.links.transport };
      })),
      Promise.all(stayJobs.map(async (j) => {
        const r = await providers.search(j.dest, { origin: o.id, from: j.from, to: j.to, persons }, { kinds: ['lodging'], skip: ['google-hotels'] });
        return { place: pt(j.dest), from: j.from, to: j.to, nights: j.nights, options: top(r.offers.lodging), links: r.links.lodging };
      })),
    ]);
    res.json({ origin: { id: o.id, code: o.code, name: o.name, lat: o.lat, lng: o.lng }, start: iso(day0), end: iso(day), persons: Number(persons) || 2, returnHome: Boolean(returnHome), legs, stays });
  });

  // Cestovatelský pas: země z dokončených výletů
  api.get('/me/stamps', requireUser, async (req, res) => {
    const rows = await db.all(`
      SELECT t.id AS trip_id, t.title, t.end_date, t.completed_at, i.data FROM trips t
      JOIN trip_items i ON i.trip_id = t.id AND i.kind = 'destination'
      LEFT JOIN trip_members m ON m.trip_id = t.id AND m.user_id = ?
      WHERE t.status = 'done' AND (t.owner_id = ? OR m.user_id = ?)
      ORDER BY COALESCE(t.end_date, t.completed_at)`, req.user.id, req.user.id, req.user.id);
    const stamps = new Map();
    for (const r of rows) {
      const data = JSON.parse(r.data);
      const cc = (data.cc || LIVE_META[data.destinationId]?.cc || /^geo:[^,]+,[^,]+,([A-Z]{2}),/.exec(data.destinationId || '')?.[1] || '').toUpperCase();
      if (!cc || stamps.has(cc)) continue;
      stamps.set(cc, { cc, country: countryInfo(cc).name, place: data.name, date: r.end_date || (r.completed_at || '').slice(0, 10), tripId: r.trip_id, tripTitle: r.title });
    }
    res.json({ stamps: [...stamps.values()] });
  });

  // Fotka destinace (přesměrování na obrázek z Wikimedia Commons)
  api.get('/destinations/:id/photo', async (req, res) => {
    const dest = resolveDestination(req.params.id);
    if (!dest) return bad(res, 'Destinace nenalezena.', 404);
    const photo = await extras.photo(dest).catch(() => null);
    if (!photo) return bad(res, 'Fotka není k dispozici.', 404);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.redirect(302, photo.url);
  });

  api.get('/destinations/:id/weather', async (req, res) => {
    const dest = resolveDestination(req.params.id);
    if (!dest) return bad(res, 'Destinace nenalezena.', 404);
    try { res.json(await extras.weather(dest)); } catch { bad(res, 'Počasí teď není k dispozici.', 502); }
  });

  api.get('/destinations/:id/offers', async (req, res) => {
    const dest = resolveDestination(req.params.id);
    if (!dest) return bad(res, 'Destinace nenalezena.', 404);
    const { from, to, persons, origin, oneWay } = req.query;
    if (from && to && new Date(to) <= new Date(from)) return bad(res, 'Datum návratu musí být po datu odjezdu.');
    res.json(await providers.search(dest, { from, to, persons, origin, oneWay }));
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

  const tripDetail = async (trip, role, userId = null) => {
    const [itemRows, members, owner, votes] = await Promise.all([
      db.all('SELECT * FROM trip_items WHERE trip_id = ? ORDER BY created_at, id', trip.id),
      db.all(`SELECT m.id, m.email, m.role, m.user_id, u.name, u.avatar_v FROM trip_members m
        LEFT JOIN users u ON u.id = m.user_id WHERE m.trip_id = ? ORDER BY m.id`, trip.id),
      db.get('SELECT id, name, email, avatar_v FROM users WHERE id = ?', trip.owner_id),
      db.all('SELECT v.item_id, v.user_id, v.value FROM item_votes v JOIN trip_items i ON i.id = v.item_id WHERE i.trip_id = ?', trip.id),
    ]);
    const items = itemRows.map((it) => {
      const mine = votes.filter((v) => v.item_id === it.id);
      const up = mine.filter((v) => v.value !== -1).length;
      return { ...it, data: JSON.parse(it.data), votes: up, up, down: mine.length - up, myVote: mine.find((v) => v.user_id === userId)?.value || 0, voted: mine.some((v) => v.user_id === userId && v.value !== -1) };
    });
    const total = items.reduce((sum, it) => sum + (it.price || 0), 0);
    return { trip: { ...trip, share_token: role === 'owner' ? trip.share_token : undefined, invite_token: role === 'owner' ? trip.invite_token : undefined }, role, owner, items, members, total };
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
    res.json({ trips: trips.map(({ cover_data, cover: coverImage, ...t }) => ({ ...t, cover_image: coverImage || null, cover: cover_data ? JSON.parse(cover_data).destinationId || null : null })) });
  });

  api.post('/trips', requireUser, async (req, res) => {
    const { title, note = '', start_date = null, end_date = null, persons = 2, budget = null, items = [] } = req.body || {};
    if (!title?.trim()) return bad(res, 'Výlet potřebuje název.');
    const { lastInsertRowid } = await db.run('INSERT INTO trips (owner_id, title, note, start_date, end_date, persons, budget) VALUES (?, ?, ?, ?, ?, ?, ?)',
      req.user.id, title.trim().slice(0, 120), String(note).slice(0, 2000), start_date || null, end_date || null, Number(persons) || 2, Number(budget) > 0 ? Number(budget) : null);
    // Volitelně rovnou s položkami (např. uložená okružní cesta)
    const valid = (Array.isArray(items) ? items : []).slice(0, 60).filter((it) => ['destination', 'transport', 'lodging', 'note'].includes(it?.kind) && it.data && typeof it.data === 'object');
    if (valid.length) {
      await db.batch(valid.map(({ kind, data }) => {
        const price = Number.isFinite(Number(data.price)) && kind !== 'destination' ? Number(data.price) : null;
        return ['INSERT INTO trip_items (trip_id, kind, data, price, currency, added_by) VALUES (?, ?, ?, ?, ?, ?)',
          lastInsertRowid, kind, JSON.stringify(data).slice(0, 20000), price, data.currency || (price != null ? 'CZK' : null), req.user.id];
      }));
    }
    const trip = await db.get('SELECT * FROM trips WHERE id = ?', lastInsertRowid);
    res.status(201).json(await tripDetail(trip, 'owner', req.user.id));
  });

  api.get('/trips/:id', requireUser, withTrip('viewer'), async (req, res) => res.json(await tripDetail(req.trip, req.role, req.user.id)));

  api.patch('/trips/:id', requireUser, withTrip('editor'), async (req, res) => {
    const t = { ...req.trip, ...pickFields(req.body, ['title', 'note', 'start_date', 'end_date', 'persons', 'budget', 'cover']) };
    const cover = t.cover && (/^https?:\/\//.test(t.cover) || /^\/api\//.test(t.cover)) ? String(t.cover).slice(0, 600) : null;
    if (!String(t.title || '').trim()) return bad(res, 'Výlet potřebuje název.');
    const budget = Number(t.budget) > 0 ? Number(t.budget) : null;
    await db.run(`UPDATE trips SET title = ?, note = ?, start_date = ?, end_date = ?, persons = ?, budget = ?, cover = ?, updated_at = datetime('now') WHERE id = ?`,
      String(t.title).trim().slice(0, 120), String(t.note || '').slice(0, 2000), t.start_date || null, t.end_date || null, Number(t.persons) || 1, budget, cover, t.id);
    res.json(await tripDetail(await db.get('SELECT * FROM trips WHERE id = ?', t.id), req.role, req.user.id));
  });

  // Dokončit výlet (získáš razítka zemí do pasu) / vrátit mezi plánované
  api.post('/trips/:id/status', requireUser, withTrip('owner'), async (req, res) => {
    const done = req.body?.status === 'done';
    await db.run(`UPDATE trips SET status = ?, completed_at = ${done ? "datetime('now')" : 'NULL'}, updated_at = datetime('now') WHERE id = ?`, done ? 'done' : 'planned', req.trip.id);
    res.json(await tripDetail(await db.get('SELECT * FROM trips WHERE id = ?', req.trip.id), req.role, req.user.id));
  });

  api.delete('/trips/:id', requireUser, withTrip('owner'), async (req, res) => {
    await db.batch([
      ['DELETE FROM item_votes WHERE item_id IN (SELECT id FROM trip_items WHERE trip_id = ?)', req.trip.id],
      ['DELETE FROM trip_items WHERE trip_id = ?', req.trip.id],
      ['DELETE FROM trip_members WHERE trip_id = ?', req.trip.id],
      ['DELETE FROM chat_answers WHERE message_id IN (SELECT id FROM trip_messages WHERE trip_id = ?)', req.trip.id],
      ['DELETE FROM trip_messages WHERE trip_id = ?', req.trip.id],
      ['DELETE FROM trip_files WHERE trip_id = ?', req.trip.id],
      ['DELETE FROM trip_reads WHERE trip_id = ?', req.trip.id],
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
    res.status(201).json(await tripDetail(req.trip, req.role, req.user.id));
  });

  api.delete('/trips/:id/items/:itemId', requireUser, withTrip('editor'), async (req, res) => {
    await db.run('DELETE FROM item_votes WHERE item_id = (SELECT id FROM trip_items WHERE id = ? AND trip_id = ?)', Number(req.params.itemId) || 0, req.trip.id);
    await db.run('DELETE FROM trip_items WHERE id = ? AND trip_id = ?', Number(req.params.itemId) || 0, req.trip.id);
    res.json(await tripDetail(req.trip, req.role, req.user.id));
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
    res.status(201).json(await tripDetail(req.trip, req.role, req.user.id));
  });

  api.delete('/trips/:id/members/:memberId', requireUser, withTrip('viewer'), async (req, res) => {
    const m = await db.get('SELECT * FROM trip_members WHERE id = ? AND trip_id = ?', Number(req.params.memberId) || 0, req.trip.id);
    if (!m) return bad(res, 'Spolucestující nenalezen.', 404);
    // Vlastník může odebrat kohokoli, člen může odejít sám.
    if (req.role !== 'owner' && m.user_id !== req.user.id) return bad(res, 'Na tuto akci nemáš oprávnění.', 403);
    await db.run('DELETE FROM trip_members WHERE id = ?', m.id);
    res.json(req.role === 'owner' ? await tripDetail(req.trip, req.role, req.user.id) : { ok: true, left: true });
  });

  mediaRoutes(api, { db, withTrip });
  plannerRoutes(api, { db, withTrip, tripDetail, tripRole });

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
  const INDEX = indexHtml(PUBLIC_DIR);
  const sendIndex = (_req, res) => res.type('html').set('Cache-Control', 'no-cache').send(INDEX);
  app.get(['/', '/index.html'], sendIndex);
  app.use('/vendor/maplibre', express.static(join(PUBLIC_DIR, '..', 'node_modules', 'maplibre-gl', 'dist'), { maxAge: '30d' }));
  app.use('/vendor/maplibre-leaflet', express.static(join(PUBLIC_DIR, '..', 'node_modules', '@maplibre', 'maplibre-gl-leaflet'), { maxAge: '30d' }));
  app.use('/vendor/leaflet', express.static(join(PUBLIC_DIR, '..', 'node_modules', 'leaflet', 'dist'), { maxAge: '30d' }));
  app.use('/vendor/flags', express.static(join(PUBLIC_DIR, '..', 'node_modules', 'flag-icons', 'flags', '4x3'), { maxAge: '30d', immutable: true }));
  app.use(express.static(PUBLIC_DIR, {
    setHeaders(res, path) {
      if (path.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
    },
  }));
  app.get('/{*path}', sendIndex);

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status === 400 ? err.message || 'Neplatný požadavek.' : 'Něco se pokazilo na serveru.' });
  });

  app.warmPhotos = () => extras.warmPhotos();
  return app;
}

function pickFields(obj = {}, keys) {
  return Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));
}

export { COOKIE };
