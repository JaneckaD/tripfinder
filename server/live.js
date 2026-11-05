// Živé změny přes Server-Sent Events: když někdo napíše do chatu, odpoví na anketu
// nebo upraví výlet, ostatní členové to uvidí hned (bez čekání na další dotaz).
import { requireUser } from './auth.js';

const subs = new Map(); // userId -> Set<res>

export function notify(userIds, payload) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const id of new Set(userIds)) for (const res of subs.get(id) || []) res.write(msg);
}

async function tripPeople(db, tripId) {
  const rows = await db.all(`SELECT owner_id AS id FROM trips WHERE id = ?
    UNION SELECT user_id FROM trip_members WHERE trip_id = ? AND user_id IS NOT NULL`, tripId, tripId);
  return rows.map((r) => r.id);
}

// Po každé úspěšné změně (POST/PATCH/PUT/DELETE) výletu nebo soukromého chatu pošle upozornění.
export function liveMiddleware(db) {
  return (req, res, next) => {
    const path = req.path; // zachytit hned – Express ho uvnitř routeru /api zkracuje
    if (req.method === 'GET' || !path.startsWith('/api/')) return next();
    res.on('finish', () => {
      if (res.statusCode >= 400 || !req.user) return;
      const by = req.user.id;
      const trip = /^\/api\/trips\/(\d+)(\/chat)?/.exec(path);
      if (trip) {
        const tripId = Number(trip[1]);
        tripPeople(db, tripId).then((ids) => notify(ids, { type: trip[2] ? 'chat' : 'trip', tripId, by })).catch(() => {});
        return;
      }
      const dm = /^\/api\/chat\/(\d+)$/.exec(path);
      if (dm) notify([Number(dm[1]), by], { type: 'dm', from: by, to: Number(dm[1]), by });
    });
    next();
  };
}

export function liveRoutes(api) {
  api.get('/events', requireUser, (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders?.();
    res.write('retry: 3000\n\n');
    const id = req.user.id;
    if (!subs.has(id)) subs.set(id, new Set());
    subs.get(id).add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => {
      clearInterval(ping);
      subs.get(id)?.delete(res);
      if (!subs.get(id)?.size) subs.delete(id);
    });
  });
}
