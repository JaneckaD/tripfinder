import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { createApp } from '../server/app.js';

let server;
let base;

before(async () => {
  server = createApp(await openDb({ path: ':memory:', url: '' })).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());

function client() {
  let cookie = '';
  return async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json() };
  };
}

test('vyhledávání destinací s filtry', async () => {
  const c = client();
  const all = await c('/destinations');
  assert.ok(all.body.results.length > 30);
  const asia = await c('/destinations?continent=asia&tags=beach');
  assert.ok(asia.body.results.length > 0);
  assert.ok(asia.body.results.every((d) => d.continent === 'asia' && d.tags.includes('beach')));
  const cheap = await c('/destinations?maxBudget=20000&persons=2&nights=7&sort=price');
  const prices = cheap.body.results.map((d) => d.estimate.perPerson);
  assert.ok(prices.every((p) => p <= 20000));
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
});

test('nabídky dopravy a ubytování od více poskytovatelů', async () => {
  const c = client();
  const r = await c('/destinations/barcelona/offers?from=2027-05-01&to=2027-05-08&persons=3');
  assert.equal(r.status, 200);
  assert.equal(r.body.context.nights, 7);
  const tp = new Set(r.body.offers.transport.map((o) => o.providerId));
  const lp = new Set(r.body.offers.lodging.map((o) => o.providerId));
  assert.ok(tp.size >= 3);
  assert.deepEqual([...lp], ['airbnb'], 'ubytování jen z Airbnb');
  assert.ok(r.body.offers.lodging.every((o) => o.deepLink.startsWith('https://www.airbnb.cz/')));
  assert.ok(r.body.offers.transport.some((o) => o.mode === 'car'), 'možnost autem');
  const near = await c('/destinations/' + encodeURIComponent('geo:50.0870,14.4210,CZ,Staroměstské náměstí') + '/offers?origin=' + encodeURIComponent('geo:50.0755,14.4378,CZ,Václavské náměstí'));
  assert.ok(near.body.offers.transport.some((o) => o.mode === 'walk'), 'možnost pěšky');
  // deterministické ceny
  const r2 = await c('/destinations/barcelona/offers?from=2027-05-01&to=2027-05-08&persons=3');
  assert.deepEqual(r2.body.offers.lodging.map((o) => o.price), r.body.offers.lodging.map((o) => o.price));
});

test('účty, výlety, spolucestující a sdílení', async () => {
  const anna = client();
  const petr = client();
  const anon = client();

  assert.equal((await anna('/trips')).status, 401);
  assert.equal((await anna('/auth/register', { method: 'POST', body: { email: 'anna@example.com', password: 'kratke' } })).status, 400);
  const reg = await anna('/auth/register', { method: 'POST', body: { email: 'anna@example.com', password: 'tajneheslo', name: 'Anna' } });
  assert.equal(reg.status, 201);
  assert.equal((await anna('/auth/me')).body.user.name, 'Anna');

  const t1 = await anna('/trips', { method: 'POST', body: { title: 'Itálie', persons: 2 } });
  await anna('/trips', { method: 'POST', body: { title: 'Japonsko' } });
  const id = t1.body.trip.id;
  await anna(`/trips/${id}/items`, { method: 'POST', body: { kind: 'lodging', data: { title: 'Hotel', price: 12000 } } });
  const withItem = await anna(`/trips/${id}/items`, { method: 'POST', body: { kind: 'transport', data: { title: 'Let', price: 8000 } } });
  assert.equal(withItem.body.total, 20000);
  assert.equal((await anna('/trips')).body.trips.length, 2);

  // pozvánka pro e-mail bez účtu -> po registraci výlet vidí
  await anna(`/trips/${id}/members`, { method: 'POST', body: { email: 'petr@example.com', role: 'viewer' } });
  await petr('/auth/register', { method: 'POST', body: { email: 'petr@example.com', password: 'tajneheslo', name: 'Petr' } });
  const petrTrips = await petr('/trips');
  assert.equal(petrTrips.body.trips.length, 1);
  assert.equal(petrTrips.body.trips[0].role, 'viewer');
  assert.equal((await petr(`/trips/${id}/items`, { method: 'POST', body: { kind: 'note', data: { title: 'x' } } })).status, 403);
  assert.equal((await petr(`/trips/${id}`, { method: 'DELETE' })).status, 403);

  // sdílení odkazem
  const share = await anna(`/trips/${id}/share`, { method: 'POST', body: {} });
  const shared = await anon(`/shared/${share.body.share_token}`);
  assert.equal(shared.status, 200);
  assert.equal(shared.body.items.length, 2);
  assert.equal(shared.body.members[0].email, undefined);
  await anna(`/trips/${id}/share`, { method: 'POST', body: { enabled: false } });
  assert.equal((await anon(`/shared/${share.body.share_token}`)).status, 404);

  // odhlášení
  await anna('/auth/logout', { method: 'POST' });
  assert.equal((await anna('/trips')).status, 401);
  const login = await anna('/auth/login', { method: 'POST', body: { email: 'ANNA@example.com', password: 'tajneheslo' } });
  assert.equal(login.status, 200);
  assert.equal((await anna('/auth/login', { method: 'POST', body: { email: 'anna@example.com', password: 'spatne' } })).status, 401);
});
