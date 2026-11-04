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
  if (u.host === 'serpapi.com' && u.searchParams.get('engine') === 'google_hotels') {
    return json({ search_metadata: { google_hotels_url: 'https://www.google.com/travel/hotels/x' }, properties: [
      { name: 'Hotel Sol', total_rate: { extracted_lowest: 14000 }, rate_per_night: { extracted_lowest: 2000 }, overall_rating: 4.3, prices: [{ source: 'Booking.com', rate_per_night: { extracted_lowest: 2000 } }, { source: 'Expedia', rate_per_night: { extracted_lowest: 2150 } }] },
    ] });
  }
  if (u.host === 'api.liteapi.travel' && u.pathname.endsWith('/data/hotels')) {
    assert.equal(init.headers['X-API-Key'], 'lite-key');
    return json({ data: [{ id: 'lp1', name: 'Casa Mar', stars: 4, rating: 8.7, address: 'Carrer 1' }] });
  }
  if (u.host === 'api.liteapi.travel' && u.pathname.endsWith('/hotels/rates')) {
    const body = JSON.parse(init.body);
    assert.deepEqual(body.occupancies, [{ adults: 2 }, { adults: 1 }]);
    return json({ data: [{ hotelId: 'lp1', roomTypes: [{ offerRetailRate: { amount: 12345, currency: 'CZK' }, rates: [{ name: 'Double', boardName: 'Snídaně', cancellationPolicies: { refundableTag: 'RFN' } }] }] }] });
  }
  return realFetch(url, init);
}

let server; let base;
before(async () => {
  globalThis.fetch = fakeUpstream;
  const env = { TRAVELPAYOUTS_TOKEN: 'tp', TRAVELPAYOUTS_MARKER: '123', SERPAPI_KEY: 'serp', SERPAPI_MONTHLY_LIMIT: '2', LITEAPI_KEY: 'lite-key' };
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
  assert.deepEqual(t.map((o) => o.providerId).sort(), ['google-flights', 'travelpayouts']);
  assert.equal(t.find((o) => o.providerId === 'travelpayouts').price, 9600); // 3200 × 3 osoby
  assert.match(t.find((o) => o.providerId === 'travelpayouts').deepLink, /aviasales\.com\/search\/PRG0105BCN08051\?.*marker=123/);
  assert.equal(l[0].providerId, 'liteapi');
  assert.equal(l[0].price, 12350);
  assert.ok(l[1].details.some((d) => d.startsWith('Booking.com')));
  const linkNames = r.links.lodging.map((x) => x.name);
  assert.ok(linkNames.includes('Booking.com') && linkNames.includes('Airbnb'));
  assert.ok(r.links.transport.some((x) => x.name === 'Skyscanner'));
});

test('výsledky se ukládají do mezipaměti a SerpApi hlídá měsíční limit', async () => {
  const before = calls.length;
  await get('/destinations/barcelona/offers?from=2027-05-01&to=2027-05-08&persons=3');
  assert.equal(calls.length, before, 'druhé stejné hledání nemá volat API');
  const meta = await get('/meta');
  assert.deepEqual(meta.serpapi, { used: 2, limit: 2 });
  // Jiné datum: SerpApi už je přes limit -> chyba jen pro Google, ostatní běží.
  const r = await get('/destinations/barcelona/offers?from=2027-06-01&to=2027-06-08&persons=3');
  assert.ok(r.errors.some((e) => e.providerId === 'google-flights' && /limit/.test(e.message)));
  assert.ok(r.offers.transport.some((o) => o.providerId === 'travelpayouts'));
});
