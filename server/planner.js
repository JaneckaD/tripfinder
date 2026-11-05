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
  CREATE TABLE IF NOT EXISTS trip_reads (
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_id INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (trip_id, user_id)
  );
`;
export const PLANNER_MIGRATIONS = ['ALTER TABLE trips ADD COLUMN invite_token TEXT'];

// Pole položky, která jde upravit v plánovači (den, čas, popis, cena, stav…).
const EDITABLE = ['day', 'time', 'title', 'note', 'place', 'category', 'status', 'cost', 'url', 'lat', 'lng', 'image'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function cleanActivity(src = {}) {
  const out = {};
  for (const k of EDITABLE) {
    if (!(k in src)) continue;
    let v = src[k];
    if (k === 'day') v = DAY_RE.test(v || '') ? v : null;
    else if (k === 'time') v = TIME_RE.test(v || '') ? v : null;
    else if (k === 'cost' || k === 'lat' || k === 'lng') v = v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v);
    else if (k === 'category') v = ['transport', 'lodging', 'sight', 'food', 'activity'].includes(v) ? v : 'activity';
    else if (k === 'url' || k === 'image') v = /^https?:\/\//.test(v || '') ? String(v).slice(0, 600) : null;
    else v = String(v ?? '').slice(0, k === 'note' ? 1000 : 160);
    out[k] = v;
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
    const price = item.kind === 'note' ? (Number.isFinite(data.cost) ? data.cost : null) : item.price;
    await db.batch([
      ['UPDATE trip_items SET data = ?, price = ? WHERE id = ?', JSON.stringify(data).slice(0, 20000), price, item.id],
      [`UPDATE trips SET updated_at = datetime('now') WHERE id = ?`, req.trip.id],
    ]);
    res.json(await detail(req));
  });

  // Hlasování o nápadu (každý člen jeden hlas, druhé kliknutí hlas vrátí)
  api.post('/trips/:id/items/:itemId/vote', requireUser, withTrip('viewer'), async (req, res) => {
    const itemId = Number(req.params.itemId) || 0;
    if (!(await db.get('SELECT 1 FROM trip_items WHERE id = ? AND trip_id = ?', itemId, req.trip.id))) return bad(res, 'Položka nenalezena.', 404);
    const had = await db.get('SELECT 1 FROM item_votes WHERE item_id = ? AND user_id = ?', itemId, req.user.id);
    if (had) await db.run('DELETE FROM item_votes WHERE item_id = ? AND user_id = ?', itemId, req.user.id);
    else await db.run('INSERT INTO item_votes (item_id, user_id) VALUES (?, ?)', itemId, req.user.id);
    res.json(await detail(req));
  });

  // ---------- Skupinový chat výletu ----------
  const messageOut = (m, me) => ({ id: m.id, mine: m.sender_id === me, sender: { id: m.sender_id, name: m.name }, body: m.body, data: m.data ? JSON.parse(m.data) : null, at: m.created_at });
  api.get('/trips/:id/chat', requireUser, withTrip('viewer'), async (req, res) => {
    const after = Number(req.query.after) || 0;
    const rows = await db.all(`SELECT m.*, u.name FROM trip_messages m JOIN users u ON u.id = m.sender_id
      WHERE m.trip_id = ? AND m.id > ? ORDER BY m.id DESC LIMIT 200`, req.trip.id, after);
    const last = rows[0]?.id;
    if (last) {
      await db.run(`INSERT INTO trip_reads (trip_id, user_id, last_id) VALUES (?, ?, ?)
        ON CONFLICT(trip_id, user_id) DO UPDATE SET last_id = MAX(last_id, excluded.last_id)`, req.trip.id, req.user.id, last);
    }
    // Kdo si co přečetl (pro „přečteno“ u vlastních zpráv)
    const reads = await db.all('SELECT user_id, last_id FROM trip_reads WHERE trip_id = ? AND user_id != ?', req.trip.id, req.user.id);
    res.json({ messages: rows.reverse().map((m) => messageOut(m, req.user.id)), readUpTo: reads.length ? Math.max(...reads.map((r) => r.last_id)) : 0 });
  });

  api.post('/trips/:id/chat', requireUser, withTrip('viewer'), async (req, res) => {
    const body = String(req.body?.body || '').trim().slice(0, 2000);
    const d = req.body?.data;
    // Sdílená karta místa: { type:'place', title, subtitle, image, lat, lng, itemId? }
    const data = d && d.type === 'place' ? {
      type: 'place', title: String(d.title || '').slice(0, 160), subtitle: String(d.subtitle || '').slice(0, 160),
      image: /^https?:\/\//.test(d.image || '') || /^\/api\//.test(d.image || '') ? String(d.image).slice(0, 600) : null,
      lat: Number.isFinite(Number(d.lat)) ? Number(d.lat) : null, lng: Number.isFinite(Number(d.lng)) ? Number(d.lng) : null,
      itemId: Number(d.itemId) || null,
    } : null;
    if (!body && !data) return bad(res, 'Zpráva je prázdná.');
    if (data && !data.title) return bad(res, 'Místo nemá název.');
    const { lastInsertRowid: id } = await db.run('INSERT INTO trip_messages (trip_id, sender_id, body, data) VALUES (?, ?, ?, ?)', req.trip.id, req.user.id, body, data ? JSON.stringify(data) : null);
    await db.run(`INSERT INTO trip_reads (trip_id, user_id, last_id) VALUES (?, ?, ?)
      ON CONFLICT(trip_id, user_id) DO UPDATE SET last_id = excluded.last_id`, req.trip.id, req.user.id, id);
    const m = await db.get('SELECT m.*, u.name FROM trip_messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?', id);
    res.status(201).json({ message: messageOut(m, req.user.id) });
  });

  // Přehled konverzací: skupinové chaty výletů (aktivní i archivní)
  api.get('/conversations', requireUser, async (req, res) => {
    const me = req.user.id;
    const trips = await db.all(`
      SELECT t.id, t.title, t.start_date, t.end_date, t.status, t.owner_id,
        (SELECT COUNT(*) FROM trip_members mm WHERE mm.trip_id = t.id AND mm.user_id IS NOT NULL) + 1 AS people,
        (SELECT COUNT(*) FROM trip_items i WHERE i.trip_id = t.id AND i.kind != 'destination') AS places,
        (SELECT COUNT(*) FROM trip_messages x WHERE x.trip_id = t.id AND x.sender_id != ? AND x.id > COALESCE((SELECT last_id FROM trip_reads r WHERE r.trip_id = t.id AND r.user_id = ?), 0)) AS unread,
        (SELECT x.body || char(31) || u.name || char(31) || x.created_at || char(31) || COALESCE(json_extract(x.data, '$.title'), '') FROM trip_messages x JOIN users u ON u.id = x.sender_id WHERE x.trip_id = t.id ORDER BY x.id DESC LIMIT 1) AS last
      FROM trips t LEFT JOIN trip_members m ON m.trip_id = t.id AND m.user_id = ?
      WHERE t.owner_id = ? OR m.user_id = ?
      ORDER BY t.updated_at DESC`, me, me, me, me, me);
    res.json({
      trips: trips.map(({ last, ...t }) => {
        const [body, name, at, place] = last ? last.split('\x1f') : [];
        return { ...t, unread: Number(t.unread), lastMessage: last ? { body: body || (place ? `sdílí místo ${place}` : ''), name, at } : null };
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
