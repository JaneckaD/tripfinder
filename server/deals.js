// Akční nabídky na půl roku dopředu: nejlevnější letenky (Travelpayouts, když je klíč)
// nebo deterministický odhad, k tomu odhad zvýhodněného ubytování.
import { DESTINATIONS } from './data/destinations.js';
import { LIVE_META } from './data/live-meta.js';
import { airportByCode, cityCs, geoId, haversineKm, resolveOrigin } from './geo.js';
import { getJson } from './providers/live/common.js';

const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const round = (n) => Math.round(n / 10) * 10;

function seeded(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
}

// IATA (letiště nebo město) -> katalogová destinace
const byCode = new Map();
for (const d of DESTINATIONS) {
  byCode.set(d.airport, d);
  if (LIVE_META[d.id]?.cityCode) byCode.set(LIVE_META[d.id].cityCode, d);
}

function card(dest, { depart, ret, flight, oldFlight, live, origin }) {
  const nights = Math.max(1, Math.round((new Date(ret) - new Date(depart)) / DAY));
  const hotel = round((600 + dest.dailyCost * 0.9) * 0.72);
  const oldHotel = round(hotel / 0.72);
  return {
    destinationId: dest.id, name: dest.name, country: dest.country, emoji: dest.emoji,
    lat: dest.lat, lng: dest.lng, origin,
    depart, return: ret, nights,
    flight, oldFlight, hotelPerNight: hotel, oldHotelPerNight: oldHotel,
    perPerson: flight + Math.round((hotel * nights) / 2),
    discount: Math.round((1 - (flight + hotel * nights / 2) / (oldFlight + oldHotel * nights / 2)) * 100),
    live,
  };
}

export function createDeals({ env, cached }) {
  async function liveDeals(origin) {
    const res = await cached(`deals:${origin}`, 6 * 3600000, () => getJson(`https://api.travelpayouts.com/v2/prices/latest?${new URLSearchParams({
      currency: 'czk', origin, period_type: 'year', one_way: 'false', page: '1', limit: '100', sorting: 'price', show_to_affiliates: 'true', token: env.TRAVELPAYOUTS_TOKEN,
    })}`));
    const now = Date.now();
    return (res.data || []).filter((f) => {
      const t = Date.parse(f.depart_date);
      return f.return_date && t > now + DAY && t < now + 183 * DAY;
    }).map((f) => {
      let dest = byCode.get(f.destination);
      if (!dest) {
        const a = airportByCode(f.destination);
        if (!a) return null;
        dest = { id: geoId({ lat: a.lat, lng: a.lng, cc: a.cc, name: cityCs(a) }), name: cityCs(a), country: '', emoji: '✈️', lat: a.lat, lng: a.lng, dailyCost: 1700 };
      }
      const flight = round(f.value);
      return card(dest, { depart: f.depart_date, ret: f.return_date, flight, oldFlight: round(flight * 1.45), live: true, origin });
    }).filter(Boolean);
  }

  function mockDeals(o) {
    const out = [];
    const today = new Date();
    for (let m = 0; m < 6; m++) {
      const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + m + 1, 1));
      const month = first.getUTCMonth() + 1;
      const rnd = seeded(`${o.code}:${iso(first)}`);
      const pool = DESTINATIONS.filter((d) => d.bestMonths.includes(month)).sort(() => rnd() - 0.5).slice(0, 5);
      for (const dest of pool) {
        const depart = new Date(first.getTime() + Math.floor(rnd() * 24) * DAY);
        const nights = 3 + Math.floor(rnd() * 8);
        const km = haversineKm(o, dest);
        const regular = round(800 + km * 1.6);
        const flight = round(regular * (0.45 + rnd() * 0.25));
        out.push(card(dest, { depart: iso(depart), ret: iso(new Date(depart.getTime() + nights * DAY)), flight, oldFlight: regular, live: false, origin: o.code }));
      }
    }
    return out;
  }

  return async function deals(originParam) {
    const o = resolveOrigin(originParam);
    let list = [];
    let live = false;
    if (env.TRAVELPAYOUTS_TOKEN) {
      try { list = await liveDeals(o.code); live = list.length > 0; } catch (e) { console.warn('[deals]', e.message); }
    }
    if (!list.length) list = mockDeals(o);
    // Nejvýše 5 nejlepších na měsíc, nejlevnější první
    const byMonth = {};
    for (const d of list.sort((a, b) => a.perPerson - b.perPerson)) {
      const key = d.depart.slice(0, 7);
      (byMonth[key] ||= []).length < 5 && byMonth[key].push(d);
    }
    return { origin: { code: o.code, name: o.name }, live, months: Object.keys(byMonth).sort().map((month) => ({ month, deals: byMonth[month] })) };
  };
}
