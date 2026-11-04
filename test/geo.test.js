import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { createApp } from '../server/app.js';
import { nearestAirport, placeDestination, resolveOrigin } from '../server/geo.js';

test('libovolné místo na světě se převede na destinaci s nejbližším letištěm', () => {
  const d = placeDestination('geo:49.1951,16.6068,CZ,Brno');
  assert.equal(d.name, 'Brno');
  assert.equal(d.country, 'Česko');
  assert.equal(d.airport, 'BRQ');
  assert.equal(nearestAirport({ lat: 50.08, lng: 14.43 }).code, 'PRG');
  assert.equal(resolveOrigin('VIE').name, 'Vídeň');
  assert.equal(placeDestination('geo:999,1,CZ,X'), null);
});

test('spoje s přestupy, okružní cesta, akce a razítka', async () => {
  const db = await openDb({ path: ':memory:', url: '' });
  const srv = createApp(db, { env: {} }).listen(0);
  const base = `http://localhost:${srv.address().port}/api`;
  const call = async (path, { method = 'GET', body, cookie } = {}) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body && JSON.stringify(body) });
    return { status: res.status, body: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] };
  };
  try {
    const offers = await call(`/destinations/budapest/offers?origin=${encodeURIComponent('geo:49.1951,16.6068,CZ,Brno')}&from=2027-03-01&to=2027-03-05`);
    assert.equal(offers.status, 200);
    const combo = offers.body.offers.transport.find((o) => o.mode === 'combo');
    assert.ok(combo && combo.legs.length >= 2, 'kombinace vlak + autobus');
    assert.ok(combo.returnLegs.length >= 1);

    const plan = await call('/route-plan', { method: 'POST', body: { origin: 'PRG', start: '2027-05-01', persons: 2, stops: [{ id: 'vienna', nights: 2 }, { id: 'krakow', nights: 3 }] } });
    assert.equal(plan.status, 200);
    assert.equal(plan.body.legs.length, 3);
    assert.equal(plan.body.end, '2027-05-06');
    assert.ok(plan.body.stays.every((s) => s.options.length));

    const deals = await call('/deals?origin=PRG');
    assert.equal(deals.body.months.length, 6);

    const reg = await call('/auth/register', { method: 'POST', body: { email: 'pas@example.com', password: 'heslo12345', name: 'Pas' } });
    const trip = await call('/trips', { method: 'POST', cookie: reg.cookie, body: { title: 'Paříž', items: [{ kind: 'destination', data: { destinationId: 'paris', title: 'Paříž' } }] } });
    assert.equal(trip.body.items.length, 1);
    assert.equal((await call('/me/stamps', { cookie: reg.cookie })).body.stamps.length, 0);
    await call(`/trips/${trip.body.trip.id}/status`, { method: 'POST', cookie: reg.cookie, body: { status: 'done' } });
    const stamps = await call('/me/stamps', { cookie: reg.cookie });
    assert.deepEqual(stamps.body.stamps.map((s) => s.cc), ['FR']);
  } finally { srv.close(); }
});
