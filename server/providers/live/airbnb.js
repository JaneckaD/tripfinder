// Skutečné nabídky Airbnb přes SerpApi (engine=airbnb). Každá nabídka má přímý odkaz na inzerát.
import { getJson, round10 } from './common.js';

const HOUR = 3600000;
const nightsLabel = (n) => `${n} ${n === 1 ? 'noc' : n < 5 ? 'noci' : 'nocí'}`;
// Výřez mapy kolem místa (sever, východ, jih, západ) – funguje pro jakékoli místo na světě.
export const mapBounds = ({ lat, lng }, km = 6) => {
  const dLat = km / 111; const dLng = km / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return { n: lat + dLat, e: lng + dLng, s: lat - dLat, w: lng - dLng };
};
// Odkaz vždy na českou verzi Airbnb (stejný inzerát).
const czLink = (url) => { try { const u = new URL(url); if (/airbnb\./.test(u.host)) u.host = 'www.airbnb.cz'; return u.toString(); } catch { return url; } };

export function serpAirbnbProvider({ apiKey, cached, quota, monthlyLimit }) {
  return {
    id: 'airbnb-live', name: 'Airbnb', kind: 'lodging', website: 'https://www.airbnb.cz', mode: 'live',
    offers: 'Skutečné nabídky Airbnb s cenou za celý pobyt a přímým odkazem na inzerát (přes SerpApi)',
    async search(ctx) {
      const { dest, from, to, persons, nights } = ctx;
      const b = mapBounds(dest, dest.geo ? 4 : 8);
      const key = `serp-airbnb:${dest.lat.toFixed(2)},${dest.lng.toFixed(2)}:${from}:${to}:${persons}`;
      const res = await cached(key, 24 * HOUR, async () => {
        await quota.take('serpapi', monthlyLimit);
        return getJson(`https://serpapi.com/search.json?${new URLSearchParams({
          engine: 'airbnb', map_bounds: [b.n, b.e, b.s, b.w].map((x) => x.toFixed(4)).join(','),
          check_in_date: from, check_out_date: to, adults: String(persons), currency: 'CZK', api_key: apiKey,
        })}`, { timeoutMs: 30000 });
      });
      const list = (res.properties || res.results || res.listings || []).filter((p) => Number.isFinite(p.extracted_price) && p.link);
      return list.sort((a, b2) => a.extracted_price - b2.extracted_price).slice(0, 12).map((p, i) => {
        const total = round10(p.extracted_price);
        return {
          id: `airbnb-${p.listing_id || i}`, providerId: this.id, providerName: 'Airbnb', kind: 'lodging',
          title: p.title || p.name || 'Ubytování Airbnb',
          subtitle: [p.name && p.title !== p.name ? p.name : null, p.host_type].filter(Boolean).join(' · ') || dest.name,
          price: total,
          priceNote: `${round10(total / nights).toLocaleString('cs-CZ')} Kč / noc · ${nightsLabel(nights)}`,
          oldPrice: Number.isFinite(p.extracted_old_price) ? round10(p.extracted_old_price) : null,
          currency: 'CZK', rating: p.rating ? Math.round(p.rating * 100) / 100 : null, reviews: p.reviews || null, ratingScale: 5,
          details: [...(Array.isArray(p.details) ? p.details : []), p.free_cancellation ? 'Bezplatné storno' : null].filter(Boolean).slice(0, 5),
          amenities: (p.highlights || []).slice(0, 8), badges: p.badges || [],
          description: p.description || null,
          photos: (p.images?.length ? p.images : p.thumbnail ? [p.thumbnail] : []).slice(0, 10),
          location: p.gps_coordinates ? { lat: p.gps_coordinates.latitude, lng: p.gps_coordinates.longitude } : null,
          checkin: from, checkout: to, nights,
          deepLink: czLink(p.link), direct: true, mock: false,
        };
      });
    },
  };
}
