// Místa po celém světě: našeptávač (Photon / OpenStreetMap), nejbližší letiště (OurAirports),
// informace o zemi (countries-list + Intl) a převod libovolného místa na „destinaci“.
import { readFileSync } from 'node:fs';
import { countries } from 'countries-list';
import { getJson } from './providers/live/common.js';
import { DESTINATIONS, findDestination } from './data/destinations.js';
import { LIVE_META } from './data/live-meta.js';

// [iata, město, kód země, lat, lng, velké letiště 1/0]
const AIRPORTS = JSON.parse(readFileSync(new URL('./data/airports.json', import.meta.url), 'utf8'))
  .map(([code, city, cc, lat, lng, large]) => ({ code, city, cc, lat, lng, large: Boolean(large) }));
const BY_CODE = new Map(AIRPORTS.map((a) => [a.code, a]));
// IATA kódy měst (více letišť) – pro jistotu přeložíme na hlavní letiště.
const CITY_CODES = { PAR: 'CDG', ROM: 'FCO', LON: 'LHR', NYC: 'JFK', TYO: 'HND', MIL: 'MXP', REK: 'KEF', RIO: 'GIG', BER: 'BER', STO: 'ARN', MOW: 'SVO', WAS: 'IAD', CHI: 'ORD', OSA: 'KIX', SEL: 'ICN', BUE: 'EZE', SAO: 'GRU' };

export const PRAGUE = { lat: 50.08, lng: 14.43 };
const CONTINENT = { EU: 'europe', AS: 'asia', AF: 'africa', NA: 'north_america', SA: 'south_america', OC: 'oceania', AN: 'south_america' };
const DAILY_BY_CONTINENT = { europe: 1700, asia: 1100, africa: 1200, north_america: 2600, south_america: 1300, oceania: 2400 };
const regionNames = new Intl.DisplayNames(['cs'], { type: 'region' });
const languageNames = new Intl.DisplayNames(['cs'], { type: 'language' });

export function haversineKm(a, b) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

// České názvy nejčastějších měst s letištěm (jinak anglický název z OurAirports).
const CS = { Prague: 'Praha', Vienna: 'Vídeň', Munich: 'Mnichov', Berlin: 'Berlín', Warsaw: 'Varšava', Krakow: 'Krakov', Rome: 'Řím', Paris: 'Paříž', London: 'Londýn', Venice: 'Benátky', Milan: 'Milán', Naples: 'Neapol', Florence: 'Florencie', Lisbon: 'Lisabon', Athens: 'Athény', Copenhagen: 'Kodaň', Brussels: 'Brusel', Zurich: 'Curych', Geneva: 'Ženeva', Frankfurt: 'Frankfurt', 'Frankfurt am Main': 'Frankfurt', Cologne: 'Kolín nad Rýnem', Dresden: 'Drážďany', Leipzig: 'Lipsko', Nuremberg: 'Norimberk', Salzburg: 'Salcburk', Budapest: 'Budapešť', Bratislava: 'Bratislava', Ostrava: 'Ostrava', Brno: 'Brno', Katowice: 'Katovice', Wroclaw: 'Vratislav', Istanbul: 'Istanbul', Dubai: 'Dubaj', Doha: 'Dauhá', Amsterdam: 'Amsterdam', Barcelona: 'Barcelona', Madrid: 'Madrid', Stockholm: 'Stockholm', Oslo: 'Oslo', Helsinki: 'Helsinky', Dublin: 'Dublin', 'New York': 'New York', Tokyo: 'Tokio', Beijing: 'Peking', Moscow: 'Moskva' };
export const cityCs = (a) => CS[a.city] || a.city;

export const airportByCode = (code) => BY_CODE.get(CITY_CODES[code] || code) || null;

// Nejbližší letiště s pravidelnými lety; velká letiště mají přednost, pokud jsou do 150 km.
export function nearestAirport(p) {
  let best = null; let bestLarge = null;
  for (const a of AIRPORTS) {
    const d = haversineKm(p, a);
    if (!best || d < best.d) best = { a, d };
    if (a.large && (!bestLarge || d < bestLarge.d)) bestLarge = { a, d };
  }
  const pick = best.d <= 40 || !bestLarge || bestLarge.d > 150 ? best : bestLarge;
  return { ...pick.a, distanceKm: pick.d };
}

// Velké letiště poblíž daného bodu (pro přestupní města).
export function hubNear(p, exclude = []) {
  let best = null;
  for (const a of AIRPORTS) {
    if (!a.large || exclude.includes(a.code)) continue;
    const d = haversineKm(p, a);
    if (!best || d < best.d) best = { a, d };
  }
  return best?.a || null;
}

export function countryInfo(cc) {
  const c = countries[cc?.toUpperCase()];
  let name = cc;
  try { name = regionNames.of(cc.toUpperCase()); } catch { /* neznámý kód */ }
  const lang = c?.languages?.[0];
  let language = '';
  try { language = lang ? languageNames.of(lang) : ''; } catch { /* ignore */ }
  return { name: name || c?.name || cc, continent: CONTINENT[c?.continent] || 'europe', currency: c?.currency?.[0] || '', language };
}

// geo:lat,lng,cc,název  <->  objekt destinace
export const geoId = ({ lat, lng, cc, name }) => `geo:${(+lat).toFixed(4)},${(+lng).toFixed(4)},${(cc || '').toUpperCase()},${name}`;

export function placeDestination(id) {
  const m = /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),([A-Z]{0,2}),(.+)$/.exec(id);
  if (!m) return null;
  const lat = Number(m[1]); const lng = Number(m[2]); const cc = m[3]; const name = m[4].slice(0, 80);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const info = countryInfo(cc);
  const airport = nearestAirport({ lat, lng });
  return {
    id, geo: true, name, country: info.name, cc, continent: info.continent, lat, lng,
    airport: airport.code, airportCity: cityCs(airport), airportDistanceKm: airport.distanceKm,
    distanceKm: haversineKm(PRAGUE, { lat, lng }),
    dailyCost: DAILY_BY_CONTINENT[info.continent], currency: info.currency, language: info.language,
    tags: [], bestMonths: [], emoji: '📍', city: name,
    description: `${name}, ${info.name}. Nejbližší letiště ${cityCs(airport)} (${airport.code}) ${airport.distanceKm < 5 ? 'přímo ve městě' : `je ${airport.distanceKm} km daleko`}.`,
  };
}

// Katalogová destinace nebo libovolné místo podle id.
export function resolveDestination(id) {
  const d = findDestination(id);
  if (d) return { ...d, cc: LIVE_META[d.id]?.cc || '' };
  return placeDestination(String(id || ''));
}

// Výchozí místo cesty: IATA kód letiště, id katalogové destinace nebo geo:… místo.
export function resolveOrigin(origin) {
  const raw = String(origin || 'PRG').trim();
  if (/^[A-Za-z]{3}$/.test(raw)) {
    const a = airportByCode(raw.toUpperCase());
    if (a) return { id: raw.toUpperCase(), code: a.code, name: cityCs(a), lat: a.lat, lng: a.lng, cc: a.cc };
  }
  const d = resolveDestination(raw);
  if (d) return { id: d.id, code: d.airport, name: d.name, lat: d.lat, lng: d.lng, cc: d.cc, airportCity: d.airportCity, airportDistanceKm: d.airportDistanceKm };
  const prg = airportByCode('PRG');
  return { id: 'PRG', code: 'PRG', name: 'Praha', lat: prg.lat, lng: prg.lng, cc: 'CZ' };
}

const norm = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// Našeptávač: nejdřív katalog (české názvy), pak Photon (celý svět, i adresy).
export function makePlaceSearch(cached) {
  return async function searchPlaces(q, { limit = 8 } = {}) {
    const query = q.trim();
    if (query.length < 2) return [];
    const nq = norm(query);
    const catalog = DESTINATIONS
      .filter((d) => norm(d.name).includes(nq) || norm(d.country).includes(nq))
      .slice(0, 4)
      .map((d) => ({ id: d.id, kind: 'catalog', name: d.name, detail: d.country, lat: d.lat, lng: d.lng, cc: LIVE_META[d.id]?.cc || '', emoji: d.emoji, airport: d.airport }));

    let world = [];
    try {
      const res = await cached(`photon:${nq}`, 7 * 86400000, () => getJson(
        `https://photon.komoot.io/api/?${new URLSearchParams({ q: query, limit: '10' })}`,
        { headers: { 'User-Agent': 'TripFinder/0.1 (https://github.com/JaneckaD/tripfinder)' }, timeoutMs: 8000 },
      ));
      world = (res.features || []).map((f) => {
        const p = f.properties || {};
        const [lng, lat] = f.geometry?.coordinates || [];
        const cc = (p.countrycode || '').toUpperCase();
        const isAddress = Boolean(p.street || p.housenumber) || ['house', 'building'].includes(p.type);
        const name = isAddress ? [p.street, p.housenumber].filter(Boolean).join(' ') || p.name : p.name || p.city;
        const where = [isAddress ? p.city : null, p.state && p.state !== p.name ? p.state : null, cc ? countryInfo(cc).name : p.country].filter(Boolean);
        const airport = nearestAirport({ lat, lng });
        return {
          id: geoId({ lat, lng, cc, name: isAddress && p.city ? `${name}, ${p.city}` : name }),
          kind: isAddress ? 'address' : ['city', 'town', 'village', 'district'].includes(p.type) || p.osm_value === 'city' ? 'city' : 'place',
          name, detail: where.join(', '), lat, lng, cc, airport: airport.code,
        };
      }).filter((p) => p.name && Number.isFinite(p.lat));
    } catch { /* Photon nedostupný – vrátíme aspoň katalog */ }

    // Odstranit duplicitní místa (katalog vs. Photon, stejné město víckrát).
    const seen = new Set(catalog.map((c) => norm(c.name)));
    const out = [...catalog];
    for (const p of world) {
      const key = `${norm(p.name)}|${p.cc}`;
      if (seen.has(norm(p.name)) && p.kind === 'city') continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out.slice(0, limit);
  };
}

export { AIRPORTS };
