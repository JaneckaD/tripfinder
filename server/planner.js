// Plánovač výletu: aktivity po dnech, hlasování o nápadech, skupinový chat výletu a pozvánka odkazem.
import { randomBytes } from 'node:crypto';
import { requireUser } from './auth.js';

export const PLANNER_SCHEMA = `
  CREATE TABLE IF NOT EXISTS item_votes (
    item_id INTEGER NOT NULL REFERENCES trip_items(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS trip_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       TEXT NOT NULL DEFAULT '',
    data       TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS trip_messages_trip ON trip_messages (trip_id, id);
  -- Odpovědi na ankety, kalendářní ankety a dotazníky v chatu výletu (jedna odpověď na člověka).
  CREATE TABLE IF NOT EXISTS chat_answers (
    message_id INTEGER NOT NULL REFERENCES trip_messages(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (message_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS trip_reads (
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_id INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (trip_id, user_id)
  );
`;
export const PLANNER_MIGRATIONS = ['ALTER TABLE trips ADD COLUMN invite_token TEXT', 'ALTER TABLE item_votes ADD COLUMN value INTEGER NOT NULL DEFAULT 1'];

// Pole položky, která jde upravit v plánovači (den, čas, popis, cena, stav, platby, detaily spoje a ubytování…).
const TEXT = { title: 160, note: 1000, place: 160, status: 20, seats: 120, booking: 80, carrier: 120, fromPlace: 160, toPlace: 160, address: 200 };
export const CATEGORIES = ['transport', 'lodging', 'sight', 'food', 'activity', 'nature', 'nightlife', 'shopping', 'event', 'wellness', 'idea'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DT_RE = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;
const URL_OK = (v) => /^https?:\/\//.test(v || '') || /^\/api\/trips\/\d+\/files\/\d+$/.test(v || '');
const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const point = (p) => (p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) ? { lat: Number(p.lat), lng: Number(p.lng) } : null);

export function cleanActivity(src = {}) {
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    if (k in TEXT) out[k] = String(v ?? '').slice(0, TEXT[k]);
    else if (k === 'day' || k === 'due' || k === 'checkout') out[k] = DAY_RE.test(v || '') ? v : null;
    else if (k === 'time') out[k] = TIME_RE.test(v || '') ? v : null;
    else if (k === 'depart' || k === 'arrive') out[k] = DT_RE.test(v || '') ? v : null;
    else if (k === 'cost' || k === 'lat' || k === 'lng' || k === 'unitCost') out[k] = num(v);
    else if (k === 'priceMode') out[k] = v === 'person' ? 'person' : 'total';
    else if (k === 'category') out[k] = CATEGORIES.includes(v) ? v : 'idea';
    else if (k === 'mode') out[k] = ['flight', 'train', 'bus', 'car', 'ferry', 'walk'].includes(v) ? v : 'train';
    else if (k === 'url' || k === 'image' || k === 'cover' || k === 'qr') out[k] = URL_OK(v) ? String(v).slice(0, 600) : null;
    else if (k === 'images') out[k] = (Array.isArray(v) ? v : []).filter(URL_OK).slice(0, 24).map((x) => String(x).slice(0, 600));
    else if (k === 'split') out[k] = (Array.isArray(v) ? v : []).map(Number).filter((x) => Number.isInteger(x) && x > 0).slice(0, 40);
    else if (k === 'fromPt' || k === 'toPt') out[k] = point(v);
  }
  return out;
}

export function plannerRoutes(api, { db, withTrip, tripDetail, tripRole }) {
  const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
  const detail = (req) => tripDetail(req.trip, req.role, req.user.id);

  // Upravit položku (naplánovat na den a čas, přejmenovat, cena…)
  api.patch('/trips/:id/items/:itemId', requireUser, withTrip('editor'), async (req, res) => {
    const item = await db.get('SELECT * FROM trip_items WHERE id = ? AND trip_id = ?', Number(req.params.itemId) || 0, req.trip.id);
    if (!item) return bad(res, 'Položka nenalezena.', 404);
    const data = { ...JSON.parse(item.data), ...cleanActivity(req.body || {}) };
    const price = item.kind === 'note' || 'cost' in (req.body || {}) ? (Number.isFinite(data.cost) ? data.cost : null) : item.price;
    await db.batch([
      ['UPDATE trip_items SET data = ?, price = ? WHERE id = ?', JSON.stringify(data).slice(0, 20000), price, item.id],
      [`UPDATE trips SET updated_at = datetime('now') WHERE id = ?`, req.trip.id],
    ]);
    res.json(await detail(req));
  });

  // Hlasování o návrhu: každý člen má jeden hlas – pro (1), nebo proti (-1); 0 hlas zruší.
  // Bez hodnoty se hlas „pro“ přepíná (kvůli kartám v chatu).
  api.post('/trips/:id/items/:itemId/vote', requireUser, withTrip('viewer'), async (req, res) => {
    const itemId = Number(req.params.itemId) || 0;
    if (!(await db.get('SELECT 1 FROM trip_items WHERE id = ? AND trip_id = ?', itemId, req.trip.id))) return bad(res, 'Položka nenalezena.', 404);
    const had = await db.get('SELECT value FROM item_votes WHERE item_id = ? AND user_id = ?', itemId, req.user.id);
    let value = Number(req.body?.value);
    if (!('value' in (req.body || {}))) value = had?.value === 1 ? 0 : 1;
    if (![1, -1, 0].includes(value)) return bad(res, 'Hlas může být jen pro, nebo proti.');
    await db.run('DELETE FROM item_votes WHERE item_id = ? AND user_id = ?', itemId, req.user.id);
    if (value) await db.run('INSERT INTO item_votes (item_id, user_id, value) VALUES (?, ?, ?)', itemId, req.user.id, value);
    res.json(await detail(req));
  });

  // Platby: kdo už svůj podíl zaplatil. Svůj podíl si odškrtne každý, organizátor i za ostatní.
  api.post('/trips/:id/items/:itemId/paid', requireUser, withTrip('viewer'), async (req, res) => {
    const item = await db.get('SELECT * FROM trip_items WHERE id = ? AND trip_id = ?', Number(req.params.itemId) || 0, req.trip.id);
    if (!item) return bad(res, 'Položka nenalezena.', 404);
    const userId = Number(req.body?.userId) || req.user.id;
    if (userId !== req.user.id && req.role !== 'owner') return bad(res, 'Za ostatní platby odškrtává jen organizátor.', 403);
    const data = JSON.parse(item.data);
    data.paid = { ...(data.paid || {}) };
    if (req.body?.paid === false) delete data.paid[userId]; else data.paid[userId] = new Date().toISOString().slice(0, 10);
    await db.run('UPDATE trip_items SET data = ? WHERE id = ?', JSON.stringify(data), item.id);
    res.json(await detail(req));
  });

  // ---------- Skupinový chat výletu ----------
  const messageOut = (m, me) => ({ id: m.id, mine: m.sender_id === me, sender: { id: m.sender_id, name: m.name, avatar_v: m.avatar_v || 0 }, body: m.body, data: m.data ? JSON.parse(m.data) : null, at: m.created_at });
  api.get('/trips/:id/chat', requireUser, withTrip('viewer'), async (req, res) => {
    const after = Number(req.query.after) || 0;
    const rows = await db.all(`SELECT m.*, u.name, u.avatar_v FROM trip_messages m JOIN users u ON u.id = m.sender_id
      WHERE m.trip_id = ? AND m.id > ? ORDER BY m.id DESC LIMIT 200`, req.trip.id, after);
    const last = rows[0]?.id;
    if (last) {
      await db.run(`INSERT INTO trip_reads (trip_id, user_id, last_id) VALUES (?, ?, ?)
        ON CONFLICT(trip_id, user_id) DO UPDATE SET last_id = MAX(last_id, excluded.last_id)`, req.trip.id, req.user.id, last);
    }
    // Kdo si co přečetl (pro „přečteno“ u vlastních zpráv)
    const reads = await db.all('SELECT user_id, last_id FROM trip_reads WHERE trip_id = ? AND user_id != ?', req.trip.id, req.user.id);
    res.json({ messages: rows.reverse().map((m) => messageOut(m, req.user.id)), readUpTo: reads.length ? Math.max(...reads.map((r) => r.last_id)) : 0, answers: await answersOf(req.trip.id) });
  });

  api.post('/trips/:id/chat', requireUser, withTrip('viewer'), async (req, res) => {
    const body = String(req.body?.body || '').trim().slice(0, 2000);
    let data = null;
    try { data = cleanChatData(req.body?.data, req.trip.id); } catch (err) { return bad(res, err.message); }
    if (!body && !data) return bad(res, 'Zpráva je prázdná.');
    if (data?.itemId && !(await db.get('SELECT 1 FROM trip_items WHERE id = ? AND trip_id = ?', data.itemId, req.trip.id))) data.itemId = null;
    if (data?.type === 'item' && !data.itemId) return bad(res, 'Položka v itineráři neexistuje.');
    const { lastInsertRowid: id } = await db.run('INSERT INTO trip_messages (trip_id, sender_id, body, data) VALUES (?, ?, ?, ?)', req.trip.id, req.user.id, body, data ? JSON.stringify(data) : null);
    await db.run(`INSERT INTO trip_reads (trip_id, user_id, last_id) VALUES (?, ?, ?)
      ON CONFLICT(trip_id, user_id) DO UPDATE SET last_id = excluded.last_id`, req.trip.id, req.user.id, id);
    const m = await db.get('SELECT m.*, u.name, u.avatar_v FROM trip_messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?', id);
    res.status(201).json({ message: messageOut(m, req.user.id) });
  });

  // Odpovědi na interaktivní zprávy (ankety, kalendářní ankety, dotazníky) celého výletu: { messageId: [{ userId, name, value }] }
  const answersOf = async (tripId) => {
    const rows = await db.all(`SELECT a.message_id, a.user_id, a.value, u.name, u.avatar_v FROM chat_answers a
      JOIN trip_messages m ON m.id = a.message_id JOIN users u ON u.id = a.user_id WHERE m.trip_id = ? ORDER BY a.updated_at`, tripId);
    const out = {};
    for (const r of rows) (out[r.message_id] ||= []).push({ userId: r.user_id, name: r.name, avatar_v: r.avatar_v || 0, value: JSON.parse(r.value) });
    return out;
  };
  api.post('/trips/:id/chat/:msgId/answer', requireUser, withTrip('viewer'), async (req, res) => {
    const m = await db.get('SELECT * FROM trip_messages WHERE id = ? AND trip_id = ?', Number(req.params.msgId) || 0, req.trip.id);
    const d = m?.data ? JSON.parse(m.data) : null;
    if (!d || !ANSWERABLE.includes(d.type)) return bad(res, 'Na tuto zprávu se neodpovídá.', 404);
    if (d.closed) return bad(res, 'Hlasování je už uzavřené.');
    const value = cleanAnswer(d, req.body?.value);
    await db.run('DELETE FROM chat_answers WHERE message_id = ? AND user_id = ?', m.id, req.user.id);
    if (value) await db.run('INSERT INTO chat_answers (message_id, user_id, value) VALUES (?, ?, ?)', m.id, req.user.id, JSON.stringify(value));
    res.json({ answers: await answersOf(req.trip.id) });
  });
  // Autor ankety ji může uzavřít (nebo znovu otevřít)
  api.post('/trips/:id/chat/:msgId/close', requireUser, withTrip('viewer'), async (req, res) => {
    const m = await db.get('SELECT * FROM trip_messages WHERE id = ? AND trip_id = ?', Number(req.params.msgId) || 0, req.trip.id);
    const d = m?.data ? JSON.parse(m.data) : null;
    if (!d || !ANSWERABLE.includes(d.type)) return bad(res, 'Zpráva nenalezena.', 404);
    if (m.sender_id !== req.user.id && req.role !== 'owner') return bad(res, 'Uzavřít to může jen autor.', 403);
    d.closed = req.body?.closed !== false;
    await db.run('UPDATE trip_messages SET data = ? WHERE id = ?', JSON.stringify(d), m.id);
    res.json({ message: messageOut({ ...m, data: JSON.stringify(d), ...(await db.get('SELECT name, avatar_v FROM users WHERE id = ?', m.sender_id)) }, req.user.id) });
  });

  // Přehled konverzací: skupinové chaty výletů (aktivní i archivní)
  api.get('/conversations', requireUser, async (req, res) => {
    const me = req.user.id;
    const trips = await db.all(`
      SELECT t.id, t.title, t.start_date, t.end_date, t.status, t.owner_id,
        (SELECT COUNT(*) FROM trip_members mm WHERE mm.trip_id = t.id AND mm.user_id IS NOT NULL) + 1 AS people,
        (SELECT COUNT(*) FROM trip_items i WHERE i.trip_id = t.id AND i.kind != 'destination') AS places,
        (SELECT COUNT(*) FROM trip_messages x WHERE x.trip_id = t.id AND x.sender_id != ? AND x.id > COALESCE((SELECT last_id FROM trip_reads r WHERE r.trip_id = t.id AND r.user_id = ?), 0)) AS unread,
        (SELECT x.body || char(31) || u.name || char(31) || x.created_at || char(31) || COALESCE(json_extract(x.data, '$.title'), '') || char(31) || COALESCE(json_extract(x.data, '$.type'), '') FROM trip_messages x JOIN users u ON u.id = x.sender_id WHERE x.trip_id = t.id ORDER BY x.id DESC LIMIT 1) AS last
      FROM trips t LEFT JOIN trip_members m ON m.trip_id = t.id AND m.user_id = ?
      WHERE t.owner_id = ? OR m.user_id = ?
      ORDER BY t.updated_at DESC`, me, me, me, me, me);
    res.json({
      trips: trips.map(({ last, ...t }) => {
        const [body, name, at, title, type] = last ? last.split('\x1f') : [];
        return { ...t, unread: Number(t.unread), lastMessage: last ? { body: body || chatSummary(type, title), name, at } : null };
      }).sort((a, b) => (a.status === 'done') - (b.status === 'done') || (b.lastMessage?.at || '').localeCompare(a.lastMessage?.at || '')),
    });
  });

  // ---------- Pozvánka do výletu odkazem ----------
  api.post('/trips/:id/invite-link', requireUser, withTrip('owner'), async (req, res) => {
    const token = req.trip.invite_token || randomBytes(9).toString('base64url');
    if (!req.trip.invite_token) await db.run('UPDATE trips SET invite_token = ? WHERE id = ?', token, req.trip.id);
    res.json({ token });
  });
  api.get('/join/:token', async (req, res) => {
    const t = await db.get('SELECT t.id, t.title, t.start_date, t.end_date, u.name AS owner FROM trips t JOIN users u ON u.id = t.owner_id WHERE t.invite_token = ?', req.params.token);
    if (!t) return bad(res, 'Pozvánka neplatí.', 404);
    const role = req.user ? (await tripRole(t.id, req.user.id)).role : null;
    res.json({ trip: t, member: Boolean(role) });
  });
  api.post('/join/:token', requireUser, async (req, res) => {
    const t = await db.get('SELECT id FROM trips WHERE invite_token = ?', req.params.token);
    if (!t) return bad(res, 'Pozvánka neplatí.', 404);
    const { role } = await tripRole(t.id, req.user.id);
    if (!role) {
      await db.run(`INSERT INTO trip_members (trip_id, user_id, email, role) VALUES (?, ?, ?, 'editor')
        ON CONFLICT(trip_id, email) DO UPDATE SET user_id = excluded.user_id`, t.id, req.user.id, req.user.email);
    }
    res.json({ tripId: t.id });
  });
}

// Nepřečtené zprávy ve skupinových chatech (pro odznak v hlavičce)
export async function tripUnread(db, me) {
  const r = await db.get(`SELECT COUNT(*) AS n FROM trip_messages x
    JOIN trips t ON t.id = x.trip_id LEFT JOIN trip_members m ON m.trip_id = t.id AND m.user_id = ?
    WHERE (t.owner_id = ? OR m.user_id IS NOT NULL) AND x.sender_id != ?
      AND x.id > COALESCE((SELECT last_id FROM trip_reads r WHERE r.trip_id = x.trip_id AND r.user_id = ?), 0)`, me, me, me, me);
  return Number(r?.n || 0);
}

// ---------- Interaktivní zprávy v chatu výletu ----------
const ANSWERABLE = ['poll', 'datepoll', 'survey'];
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const imageUrl = (v) => (/^https?:\/\//.test(v || '') || /^\/api\//.test(v || '') ? String(v).slice(0, 600) : null);
export function chatSummary(type, title) {
  return {
    place: `sdílí místo ${title}`, poll: `anketa: ${title}`, datepoll: `kdy máte volno: ${title}`, survey: `dotazník: ${title}`,
    item: `sdílí z plánu: ${title}`, day: `sdílí program: ${title}`, payments: 'sdílí stav plateb',
  }[type] || title || '';
}
// Karta zprávy podle typu. Vyhodí chybu s českou hláškou, když něco chybí.
export function cleanChatData(d) {
  if (!d || typeof d !== 'object') return null;
  const fail = (msg) => { throw new Error(msg); };
  switch (d.type) {
    case 'place': {
      const title = str(d.title, 160) || fail('Místo nemá název.');
      return { type: 'place', title, subtitle: str(d.subtitle, 160), image: imageUrl(d.image), lat: num(d.lat), lng: num(d.lng), itemId: Number(d.itemId) || null };
    }
    case 'poll': {
      const options = (Array.isArray(d.options) ? d.options : []).map((o) => str(o, 120)).filter(Boolean).slice(0, 10);
      if (options.length < 2) fail('Anketa potřebuje aspoň dvě možnosti.');
      return { type: 'poll', title: str(d.title, 200) || fail('Napiš otázku ankety.'), options, multi: Boolean(d.multi) };
    }
    case 'datepoll': {
      const dates = [...new Set((Array.isArray(d.dates) ? d.dates : []).filter((x) => DAY_RE.test(x || '')))].sort().slice(0, 62);
      if (!dates.length) fail('Vyber aspoň jeden den.');
      return { type: 'datepoll', title: str(d.title, 200) || 'Kdy máte volno?', dates };
    }
    case 'survey': {
      const questions = (Array.isArray(d.questions) ? d.questions : []).map((q) => str(q, 200)).filter(Boolean).slice(0, 10);
      if (!questions.length) fail('Dotazník potřebuje aspoň jednu otázku.');
      return { type: 'survey', title: str(d.title, 200) || 'Dotazník', questions };
    }
    case 'item': return { type: 'item', title: str(d.title, 160), itemId: Number(d.itemId) || null };
    case 'day': return DAY_RE.test(d.day || '') ? { type: 'day', title: str(d.title, 160), day: d.day } : fail('Chybí den.');
    case 'payments': return { type: 'payments', title: 'Stav plateb' };
    default: return null;
  }
}
// Odpověď: anketa = indexy možností, kalendář = indexy dnů, dotazník = texty odpovědí. Prázdná odpověď = smazat.
export function cleanAnswer(d, v) {
  const idx = (arr, max) => [...new Set((Array.isArray(arr) ? arr : []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < max))].sort((x, y) => x - y);
  if (d.type === 'poll') { const r = idx(v, d.options.length); return r.length ? (d.multi ? r : r.slice(0, 1)) : null; }
  if (d.type === 'datepoll') { const r = idx(v, d.dates.length); return r.length ? r : null; }
  if (d.type === 'survey') { const r = d.questions.map((_, i) => str(Array.isArray(v) ? v[i] : '', 600)); return r.some(Boolean) ? r : null; }
  return null;
}
