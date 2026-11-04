import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { createApp } from '../server/app.js';

// Podvržené odpovědi externích API, aby testy nepotřebovaly síť ani klíče.
const calls = [];
const realFetch = globalThis.fetch;
function fakeUpstream(url, init = {}) {
  const u = new URL(url);
  calls.push(`${init.method || 'GET'} ${u.host}${u.pathname}${u.searchParams.get('engine') ? `?${u.searchParams.get('engine')}` : ''}`);
  const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (u.host === 'api.travelpayouts.com') {
    return json({ success: true, data: [
      { origin: 'PRG', destination: 'BCN', origin_airport: 'PRG', destination_airport: 'BCN', price: 3200, airline: 'VY', transfers: 0, return_transfers: 0, departure_at: '2027-05-01T06:00:00+02:00', return_at: '2027-05-08T20:00:00+02:00', duration_to: 155, link: '/search/PRG0105BCN08051?t=abc' },
    ] });
  }
  if (u.host === 'serpapi.com' && u.searchParams.get('engine') === 'google_flights') {
    return json({ search_metadata: { google_flights_url: 'https://www.google.com/travel/flights?x' }, best_flights: [
      { price: 7400, total_duration: 150, flights: [{ airline: 'Vueling', departure_airport: { id: 'PRG', time: '2027-05-01 06:10' }, arrival_airport: { id: 'BCN' } }] },
    ] });
  }
  if (u.host === 'serpapi.com' && u.searchParams.get('engine') === 'airbnb') {
    assert.equal(u.searchParams.get('map_bounds').split(',').length, 4);
    return json({ properties: [
      { listing_id: '123', title: 'Byt v Barceloně', name: 'Slunný loft u moře', link: 'https://www.airbnb.com/rooms/123?check_in=2027-05-01', extracted_price: 14000, rating: 4.93, reviews: 120, images: ['https://a0.muscache.com/1.jpg', 'https://a0.muscache.com/2.jpg'], gps_coordinates: { latitude: 41.38, longitude: 2.17 }, details: ['2 ložnice'] },
      { listing_id: '456', title: 'Pokoj v Barceloně', link: 'https://www.airbnb.com/rooms/456', extracted_price: 6200, rating: 4.7 },
    ] });
  }
  return realFetch(url, init);
}

let server; let base;
before(async () => {
  globalThis.fetch = fakeUpstream;
  const env = { TRAVELPAYOUTS_TOKEN: 'tp', TRAVELPAYOUTS_MARKER: '123', SERPAPI_KEY: 'serp', SERPAPI_MONTHLY_LIMIT: '3' };
  server = createApp(await openDb({ path: ':memory:', url: '' }), { env }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => { server.close(); globalThis.fetch = realFetch; });

const get = async (path) => (await realFetch(base + path)).json();

test('skuteční poskytovatelé nahradí ukázková data a zbytek jsou odkazy', async () => {
  const r = await get('/destinations/barcelona/offers?from=2027-05-01&to=2027-05-08&persons=3');
  assert.deepEqual(r.errors, []);
  const t = r.offers.transport; const l = r.offers.lodging;
  assert.ok(t.every((o) => !o.mock) && l.every((o) => !o.mock));
  assert.deepEqual([...new Set(t.map((o) => o.providerId))].sort(), ['google-flights', 'own', 'travelpayouts']);
  assert.equal(t.find((o) => o.providerId === 'travelpayouts').price, 9600); // 3200 × 3 osoby
  assert.match(t.find((o) => o.providerId === 'travelpayouts').deepLink, /aviasales\.com\/search\/PRG0105BCN08051\?.*marker=123/);
  assert.deepEqual(l.map((o) => o.providerId), ['airbnb-live', 'airbnb-live']);
  assert.equal(l[0].price, 6200);
  assert.equal(l[1].deepLink, 'https://www.airbnb.cz/rooms/123?check_in=2027-05-01', 'přímý odkaz na inzerát');
  assert.equal(l[1].photos.length, 2);
  assert.deepEqual(r.links.lodging.map((x) => x.name), ['Airbnb'], 'odkaz na další nabídky v mapě Airbnb');
  assert.ok(r.links.transport.some((x) => x.name === 'Skyscanner'));
});

test('výsledky se ukládají do mezipaměti a SerpApi hlídá měsíční limit', async () => {
  const before = calls.length;
  await get('/destinations/barcelona/offers?from=2027-05-01&to=2027-05-08&persons=3');
  assert.equal(calls.length, before, 'druhé stejné hledání nemá volat API');
  const meta = await get('/meta');
  assert.deepEqual(meta.serpapi, { used: 2, limit: 3 });
  await get('/destinations/rome/offers?from=2027-05-01&to=2027-05-08&persons=3'); // 3. hledání vyčerpá limit (let)
  // Jiné datum: SerpApi už je přes limit -> chyba jen pro Google, ostatní běží.
  const r = await get('/destinations/barcelona/offers?from=2027-06-01&to=2027-06-08&persons=3');
  assert.ok(r.errors.some((e) => e.providerId === 'google-flights' && /limit/.test(e.message)));
  assert.ok(r.offers.transport.some((o) => o.providerId === 'travelpayouts'));
});
