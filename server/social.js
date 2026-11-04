// Profil cestovatele, přátelé (žádost musí druhá strana přijmout) a chat mezi přáteli.
import express from 'express';
import { randomBytes } from 'node:crypto';
import { countries } from 'countries-list';
import { requireUser } from './auth.js';

export const SOCIAL_SCHEMA = `
  CREATE TABLE IF NOT EXISTS friendships (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (requester_id, addressee_id)
  );
  CREATE TABLE IF NOT EXISTS friend_invites (
    token      TEXT PRIMARY KEY,
    inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS messages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body         TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    read_at      TEXT
  );
  CREATE INDEX IF NOT EXISTS messages_pair ON messages (sender_id, recipient_id, id);
  CREATE INDEX IF NOT EXISTS messages_unread ON messages (recipient_id, read_at);
`;

export const PROFILE_MIGRATIONS = [
  'ALTER TABLE users ADD COLUMN home_cc TEXT',
  'ALTER TABLE users ADD COLUMN passports TEXT',
  'ALTER TABLE users ADD COLUMN birth_date TEXT',
  'ALTER TABLE users ADD COLUMN languages TEXT',
  'ALTER TABLE users ADD COLUMN home_place TEXT',
  'ALTER TABLE users ADD COLUMN home_place_name TEXT',
  'ALTER TABLE users ADD COLUMN onboarded INTEGER NOT NULL DEFAULT 0',
];

const LANG_RE = /^[a-z]{2,3}$/;
const list = (v) => String(v || '').split(',').filter(Boolean);
const validCc = (cc) => typeof cc === 'string' && Boolean(countries[cc.toUpperCase()]);

export function ageFrom(birth, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth || '');
  if (!m) return null;
  let age = now.getUTCFullYear() - Number(m[1]);
  if (now.getUTCMonth() + 1 < Number(m[2]) || (now.getUTCMonth() + 1 === Number(m[2]) && now.getUTCDate() < Number(m[3]))) age -= 1;
  return age;
}

export const profileOf = (u) => ({
  homeCc: u.home_cc || '', passports: list(u.passports), birthDate: u.birth_date || '', age: ageFrom(u.birth_date),
  languages: list(u.languages), homePlace: u.home_place || '', homePlaceName: u.home_place_name || '', onboarded: Boolean(u.onboarded),
});

export function socialRouter(db) {
  const r = express.Router();
  const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
  const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

  // ---------- Profil ----------
  r.get('/me/profile', requireUser, async (req, res) => {
    res.json({ profile: profileOf(await db.get('SELECT * FROM users WHERE id = ?', req.user.id)) });
  });

  r.put('/me/profile', requireUser, async (req, res) => {
    const b = req.body || {};
    const sets = []; const args = [];
    const set = (col, val) => { sets.push(`${col} = ?`); args.push(val); };
    if ('name' in b) {
      const name = String(b.name || '').trim().slice(0, 80);
      if (!name) return bad(res, 'Jméno nesmí být prázdné.');
      set('name', name);
    }
    if ('homeCc' in b) {
      if (b.homeCc && !validCc(b.homeCc)) return bad(res, 'Neznámá země.');
      set('home_cc', b.homeCc ? b.homeCc.toUpperCase() : null);
    }
    if ('passports' in b) {
      const p = [...new Set((Array.isArray(b.passports) ? b.passports : []).map((c) => String(c).toUpperCase()))];
      if (p.some((c) => !validCc(c)) || p.length > 4) return bad(res, 'Neplatná národnost pasu.');
      set('passports', p.join(','));
    }
    if ('birthDate' in b) {
      const age = ageFrom(b.birthDate);
      if (b.birthDate && (age === null || age < 0 || age > 120)) return bad(res, 'Zadej platné datum narození.');
      set('birth_date', b.birthDate || null);
    }
    if ('languages' in b) {
      const l = [...new Set((Array.isArray(b.languages) ? b.languages : []).map((c) => String(c).toLowerCase()))];
      if (l.some((c) => !LANG_RE.test(c)) || l.length > 12) return bad(res, 'Neplatný jazyk.');
      set('languages', l.join(','));
    }
    if ('homePlace' in b) {
      set('home_place', String(b.homePlace || '').slice(0, 160) || null);
      set('home_place_name', String(b.homePlaceName || '').slice(0, 120) || null);
    }
    if (b.onboarded) set('onboarded', 1);
    if (sets.length) await db.run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, ...args, req.user.id);
    const u = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
    res.json({ user: publicUser(u), profile: profileOf(u) });
  });

  // ---------- Přátelé ----------
  const relation = (a, b) => db.get(`SELECT * FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`, a, b, b, a);
  const areFriends = async (a, b) => (await relation(a, b))?.status === 'accepted';

  // Žádost o přátelství; když už druhá strana žádost poslala, rovnou se přijme.
  async function request(fromId, toId) {
    if (fromId === toId) return { error: 'Sám sebe si do přátel přidat nejde.' };
    const rel = await relation(fromId, toId);
    if (rel?.status === 'accepted') return { status: 'accepted', already: true };
    if (rel && rel.requester_id === toId) {
      await db.run("UPDATE friendships SET status = 'accepted' WHERE id = ?", rel.id);
      return { status: 'accepted' };
    }
    if (!rel) await db.run('INSERT INTO friendships (requester_id, addressee_id) VALUES (?, ?)', fromId, toId);
    return { status: 'pending' };
  }

  r.get('/friends', requireUser, async (req, res) => {
    const me = req.user.id;
    const rows = await db.all(`
      SELECT f.id AS fid, f.status, f.requester_id, f.created_at, u.id, u.name, u.email,
        (SELECT COUNT(*) FROM messages m WHERE m.sender_id = u.id AND m.recipient_id = ? AND m.read_at IS NULL) AS unread,
        (SELECT body FROM messages m WHERE (m.sender_id = u.id AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = u.id) ORDER BY m.id DESC LIMIT 1) AS last_body,
        (SELECT created_at FROM messages m WHERE (m.sender_id = u.id AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = u.id) ORDER BY m.id DESC LIMIT 1) AS last_at
      FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
      WHERE f.requester_id = ? OR f.addressee_id = ?`, me, me, me, me, me, me, me, me);
    const person = (x) => ({ id: x.id, name: x.name, email: x.email, since: x.created_at });
    res.json({
      friends: rows.filter((x) => x.status === 'accepted')
        .map((x) => ({ ...person(x), unread: Number(x.unread), lastMessage: x.last_body ? { body: x.last_body.slice(0, 120), at: x.last_at } : null }))
        .sort((a, b) => (b.lastMessage?.at || '').localeCompare(a.lastMessage?.at || '') || a.name.localeCompare(b.name, 'cs')),
      incoming: rows.filter((x) => x.status === 'pending' && x.requester_id !== me).map(person),
      outgoing: rows.filter((x) => x.status === 'pending' && x.requester_id === me).map(person),
    });
  });

  r.post('/friends', requireUser, async (req, res) => {
    const email = String(req.body?.email || '').trim();
    const target = email ? await db.get('SELECT id, name, email FROM users WHERE email = ?', email) : null;
    if (!target) return bad(res, 'Uživatel s tímto e-mailem tu ještě není. Pošli mu pozvánku odkazem.', 404);
    const out = await request(req.user.id, target.id);
    if (out.error) return bad(res, out.error);
    res.status(201).json({ ...out, user: publicUser(target) });
  });

  r.post('/friends/:id/accept', requireUser, async (req, res) => {
    const rel = await relation(req.user.id, Number(req.params.id));
    if (!rel || rel.addressee_id !== req.user.id) return bad(res, 'Žádost nenalezena.', 404);
    await db.run("UPDATE friendships SET status = 'accepted' WHERE id = ?", rel.id);
    res.json({ status: 'accepted' });
  });

  // Odmítnout žádost, zrušit vlastní žádost nebo odebrat z přátel.
  r.delete('/friends/:id', requireUser, async (req, res) => {
    const rel = await relation(req.user.id, Number(req.params.id));
    if (!rel) return bad(res, 'Vztah nenalezen.', 404);
    await db.run('DELETE FROM friendships WHERE id = ?', rel.id);
    res.json({ ok: true });
  });

  // Pozvánka odkazem (pro kamarády, kteří ještě nemají účet). Pozvaný ji musí přijmout.
  r.post('/friends/invite-link', requireUser, async (req, res) => {
    const token = randomBytes(12).toString('base64url');
    await db.run('INSERT INTO friend_invites (token, inviter_id) VALUES (?, ?)', token, req.user.id);
    res.status(201).json({ token });
  });
  r.get('/friends/invite/:token', async (req, res) => {
    const inv = await db.get('SELECT u.id, u.name FROM friend_invites i JOIN users u ON u.id = i.inviter_id WHERE i.token = ?', req.params.token);
    if (!inv) return bad(res, 'Pozvánka neexistuje.', 404);
    res.json({ inviter: { id: inv.id, name: inv.name }, self: req.user?.id === inv.id, friends: req.user ? await areFriends(req.user.id, inv.id) : false });
  });
  r.post('/friends/invite/:token/accept', requireUser, async (req, res) => {
    const inv = await db.get('SELECT inviter_id FROM friend_invites WHERE token = ?', req.params.token);
    if (!inv) return bad(res, 'Pozvánka neexistuje.', 404);
    if (inv.inviter_id === req.user.id) return bad(res, 'Tohle je tvoje vlastní pozvánka.');
    const rel = await relation(req.user.id, inv.inviter_id);
    if (rel) await db.run("UPDATE friendships SET status = 'accepted' WHERE id = ?", rel.id);
    else await db.run("INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'accepted')", inv.inviter_id, req.user.id);
    res.json({ status: 'accepted', friendId: inv.inviter_id });
  });

  // ---------- Chat ----------
  r.get('/chat/:id', requireUser, async (req, res) => {
    const other = Number(req.params.id); const me = req.user.id;
    if (!(await areFriends(me, other))) return bad(res, 'Psát si můžeš jen s přáteli.', 403);
    const after = Number(req.query.after) || 0;
    const rows = await db.all(`SELECT id, sender_id, body, created_at, read_at FROM messages
      WHERE id > ? AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
      ORDER BY id DESC LIMIT 200`, after, me, other, other, me);
    await db.run('UPDATE messages SET read_at = ? WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL', new Date().toISOString(), other, me);
    const friend = await db.get('SELECT id, name FROM users WHERE id = ?', other);
    res.json({
      friend,
      messages: rows.reverse().map((m) => ({ id: m.id, mine: m.sender_id === me, body: m.body, at: m.created_at, read: Boolean(m.read_at) })),
    });
  });

  r.post('/chat/:id', requireUser, async (req, res) => {
    const other = Number(req.params.id); const me = req.user.id;
    const body = String(req.body?.body || '').trim().slice(0, 2000);
    if (!body) return bad(res, 'Zpráva je prázdná.');
    if (!(await areFriends(me, other))) return bad(res, 'Psát si můžeš jen s přáteli.', 403);
    const { lastInsertRowid: id } = await db.run('INSERT INTO messages (sender_id, recipient_id, body) VALUES (?, ?, ?)', me, other, body);
    const m = await db.get('SELECT id, body, created_at FROM messages WHERE id = ?', id);
    res.status(201).json({ message: { id: m.id, mine: true, body: m.body, at: m.created_at, read: false } });
  });

  // Odznak v hlavičce: nepřečtené zprávy + čekající žádosti o přátelství.
  r.get('/notifications', async (req, res) => {
    if (!req.user) return res.json({ unread: 0, requests: 0 });
    const me = req.user.id;
    const [u, f] = await Promise.all([
      db.get('SELECT COUNT(*) AS n FROM messages WHERE recipient_id = ? AND read_at IS NULL', me),
      db.get("SELECT COUNT(*) AS n FROM friendships WHERE addressee_id = ? AND status = 'pending'", me),
    ]);
    res.json({ unread: Number(u.n), requests: Number(f.n) });
  });

  return r;
}
