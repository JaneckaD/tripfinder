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
const register = async (c, name) => (await c('/auth/register', { method: 'POST', body: { name, email: `${name}@x.cz`, password: 'heslo12345' } })).body.user;

test('profil: věk, pas, jazyky a úvodní dotazník', async () => {
  const c = client();
  await register(c, 'eva');
  let me = await c('/auth/me');
  assert.equal(me.body.profile.onboarded, false);
  const r = await c('/me/profile', { method: 'PUT', body: { homeCc: 'cz', passports: ['CZ', 'SK'], birthDate: '2004-01-01', languages: ['cs', 'en'], homePlace: 'brno', homePlaceName: 'Brno', onboarded: true } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.profile.passports, ['CZ', 'SK']);
  assert.ok(r.body.profile.age >= 22);
  me = await c('/auth/me');
  assert.equal(me.body.profile.onboarded, true);
  assert.equal((await c('/me/profile', { method: 'PUT', body: { passports: ['XX'] } })).status, 400);
  assert.equal((await c('/me/profile', { method: 'PUT', body: { birthDate: '2999-01-01' } })).status, 400);
});

test('přátelé: žádost se musí přijmout, pak chat; pozvánka odkazem', async () => {
  const a = client(); const b = client(); const x = client();
  await register(a, 'adam'); const bob = await register(b, 'bob'); await register(x, 'xena');
  assert.equal((await a('/friends', { method: 'POST', body: { email: 'nikdo@x.cz' } })).status, 404);
  assert.equal((await a('/friends', { method: 'POST', body: { email: 'bob@x.cz' } })).body.status, 'pending');
  // bez přijetí psát nejde
  assert.equal((await a(`/chat/${bob.id}`, { method: 'POST', body: { body: 'ahoj' } })).status, 403);
  assert.equal((await b('/notifications')).body.requests, 1);
  const inc = (await b('/friends')).body.incoming;
  assert.equal(inc[0].name, 'adam');
  await b(`/friends/${inc[0].id}/accept`, { method: 'POST' });
  assert.equal((await a(`/chat/${bob.id}`, { method: 'POST', body: { body: 'ahoj Bobe' } })).status, 201);
  assert.equal((await b('/notifications')).body.unread, 1);
  const chat = await b(`/chat/${inc[0].id}`);
  assert.equal(chat.body.messages[0].body, 'ahoj Bobe');
  assert.equal((await b('/notifications')).body.unread, 0);
  // cizí uživatel konverzaci nepřečte
  assert.equal((await x(`/chat/${bob.id}`)).status, 403);
  // pozvánka odkazem
  const { token } = (await a('/friends/invite-link', { method: 'POST' })).body;
  assert.equal((await x(`/friends/invite/${token}`)).body.inviter.name, 'adam');
  assert.equal((await x(`/friends/invite/${token}/accept`, { method: 'POST' })).body.status, 'accepted');
  assert.equal((await a('/friends')).body.friends.length, 2);
});

test('pozemní spoje vedou na už vyhledané spojení', async () => {
  const c = client();
  const r = await c('/destinations/vienna/offers?origin=PRG&from=2027-05-01&to=2027-05-05&persons=2');
  const ground = r.body.offers.transport.find((o) => ['train', 'bus', 'combo'].includes(o.mode));
  assert.ok(ground.searchLinks.length >= 2);
  assert.match(ground.deepLink, /^https:\/\/idos\.cz\/.*f=Praha.*date=1\.5\.2027/);
  const flight = r.body.offers.transport.find((o) => o.mode === 'flight');
  if (flight) assert.ok(flight.searchLinks.some((l) => l.url.includes('2027-05-01') || l.url.includes('270501')));
});
