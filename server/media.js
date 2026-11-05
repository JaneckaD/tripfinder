// Obrázky: profilové fotky a soubory výletu (fotky ubytování, QR kódy jízdenek).
// Ukládají se do databáze jako base64 (klient je předem zmenší), takže přežijí i nasazení na Render.
import { requireUser } from './auth.js';

export const MEDIA_SCHEMA = `
  CREATE TABLE IF NOT EXISTS trip_files (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    mime       TEXT NOT NULL,
    data       TEXT NOT NULL,
    added_by   INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS trip_files_trip ON trip_files (trip_id);
`;
export const MEDIA_MIGRATIONS = [
  'ALTER TABLE users ADD COLUMN avatar TEXT',
  'ALTER TABLE users ADD COLUMN avatar_v INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE trips ADD COLUMN cover TEXT',
];

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
export function parseImage(src, maxBytes) {
  const m = DATA_URL.exec(String(src || ''));
  if (!m) return null;
  if (Math.floor((m[2].length * 3) / 4) > maxBytes) return null;
  return { mime: m[1], b64: m[2] };
}
const sendImage = (res, mime, b64, cache) => {
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', cache);
  res.send(Buffer.from(b64, 'base64'));
};

export function mediaRoutes(api, { db, withTrip }) {
  const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

  // Profilová fotka
  api.put('/me/avatar', requireUser, async (req, res) => {
    const img = parseImage(req.body?.image, 300 * 1024);
    if (!img) return bad(res, 'Pošli obrázek JPG, PNG nebo WebP do 300 kB.');
    await db.run('UPDATE users SET avatar = ?, avatar_v = avatar_v + 1 WHERE id = ?', `${img.mime};${img.b64}`, req.user.id);
    const u = await db.get('SELECT avatar_v FROM users WHERE id = ?', req.user.id);
    res.json({ avatar_v: u.avatar_v });
  });
  api.delete('/me/avatar', requireUser, async (req, res) => {
    await db.run('UPDATE users SET avatar = NULL, avatar_v = 0 WHERE id = ?', req.user.id);
    res.json({ avatar_v: 0 });
  });
  api.get('/avatar/:id', requireUser, async (req, res) => {
    const u = await db.get('SELECT avatar FROM users WHERE id = ?', Number(req.params.id) || 0);
    if (!u?.avatar) return bad(res, 'Bez fotky.', 404);
    const [mime, b64] = u.avatar.split(';');
    sendImage(res, mime, b64, 'private, max-age=604800');
  });

  // Soubory výletu
  api.post('/trips/:id/files', requireUser, withTrip('editor'), async (req, res) => {
    const img = parseImage(req.body?.image, 900 * 1024);
    if (!img) return bad(res, 'Pošli obrázek JPG, PNG nebo WebP do 900 kB.');
    const n = await db.get('SELECT COUNT(*) AS n FROM trip_files WHERE trip_id = ?', req.trip.id);
    if (Number(n.n) >= 200) return bad(res, 'Výlet už má moc souborů.');
    const { lastInsertRowid: id } = await db.run('INSERT INTO trip_files (trip_id, mime, data, added_by) VALUES (?, ?, ?, ?)', req.trip.id, img.mime, img.b64, req.user.id);
    res.status(201).json({ id: Number(id), url: `/api/trips/${req.trip.id}/files/${Number(id)}` });
  });
  api.get('/trips/:id/files/:fid', requireUser, withTrip('viewer'), async (req, res) => {
    const f = await db.get('SELECT mime, data FROM trip_files WHERE id = ? AND trip_id = ?', Number(req.params.fid) || 0, req.trip.id);
    if (!f) return bad(res, 'Soubor nenalezen.', 404);
    sendImage(res, f.mime, f.data, 'private, max-age=31536000, immutable');
  });
}
