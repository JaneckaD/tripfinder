import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { createApp } from '../server/app.js';

let server; let base;
before(async () => {
  server = createApp(await openDb({ path: ':memory:', url: '' })).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());
function client() {
  let cookie = '';
  return async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json() };
  };
}
const register = async (c, name) => (await c('/auth/register', { method: 'POST', body: { name, email: `${name}@p.cz`, password: 'heslo12345' } })).body.user;

test('plánovač: aktivity po dnech, hlasování, pozvánka odkazem a skupinový chat', async () => {
  const a = client(); const b = client(); const x = client();
  await register(a, 'klara'); await register(b, 'tomas'); await register(x, 'cizi');
  const { trip } = (await a('/trips', { method: 'POST', body: { title: 'Lisabon', start_date: '2027-05-12', end_date: '2027-05-16' } })).body;
  let d = (await a(`/trips/${trip.id}/items`, { method: 'POST', body: { kind: 'note', data: { title: 'Miradouro', category: 'sight' } } })).body;
  const idea = d.items[0];
  assert.equal(idea.votes, 0);
  // naplánovat na den a čas
  d = (await a(`/trips/${trip.id}/items/${idea.id}`, { method: 'PATCH', body: { day: '2027-05-13', time: '09:30', cost: 240, category: 'food', bogus: 1 } })).body;
  assert.equal(d.items[0].data.day, '2027-05-13');
  assert.equal(d.items[0].data.time, '09:30');
  assert.equal(d.items[0].price, 240);
  assert.equal(d.items[0].data.bogus, undefined);
  assert.equal((await a(`/trips/${trip.id}/items/${idea.id}`, { method: 'PATCH', body: { time: '25:00' } })).body.items[0].data.time, null);
  // pozvánka odkazem
  const { token } = (await a(`/trips/${trip.id}/invite-link`, { method: 'POST' })).body;
  assert.equal((await b(`/join/${token}`)).body.trip.title, 'Lisabon');
  assert.equal((await b(`/join/${token}`, { method: 'POST' })).body.tripId, trip.id);
  assert.equal((await b(`/trips/${trip.id}`)).body.role, 'editor');
  // hlasování
  d = (await b(`/trips/${trip.id}/items/${idea.id}/vote`, { method: 'POST' })).body;
  assert.equal(d.items[0].votes, 1); assert.equal(d.items[0].voted, true);
  d = (await a(`/trips/${trip.id}/items/${idea.id}/vote`, { method: 'POST' })).body;
  assert.equal(d.items[0].votes, 2);
  d = (await a(`/trips/${trip.id}/items/${idea.id}/vote`, { method: 'POST' })).body;
  assert.equal(d.items[0].votes, 1); assert.equal(d.items[0].voted, false);
  // skupinový chat
  assert.equal((await x(`/trips/${trip.id}/chat`)).status, 404);
  await a(`/trips/${trip.id}/chat`, { method: 'POST', body: { body: 'Ahoj partě!' } });
  await a(`/trips/${trip.id}/chat`, { method: 'POST', body: { data: { type: 'place', title: 'Miradouro de Santa Luzia', lat: 38.71, lng: -9.13, itemId: idea.id } } });
  assert.equal((await b('/notifications')).body.trips, 2);
  const conv = (await b('/conversations')).body.trips[0];
  assert.equal(conv.unread, 2); assert.match(conv.lastMessage.body, /Santa Luzia/);
  const chat = (await b(`/trips/${trip.id}/chat`)).body;
  assert.equal(chat.messages.length, 2); assert.equal(chat.messages[1].data.type, 'place'); assert.equal(chat.messages[0].sender.name, 'klara');
  assert.equal((await b('/notifications')).body.trips, 0);
  const mine = (await a(`/trips/${trip.id}/chat`)).body;
  assert.ok(mine.readUpTo >= mine.messages[1].id);
  assert.equal((await b(`/trips/${trip.id}/chat`, { method: 'POST', body: { body: '' } })).status, 400);
});
