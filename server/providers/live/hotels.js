// Skutečné ceny ubytování: LiteAPI (Nuitée) a SerpApi Google Hotels.
import { getJson, round10 } from './common.js';
import { liveMeta } from '../../data/live-meta.js';

const HOUR = 3600000;
const nightsLabel = (n) => `${n} ${n === 1 ? 'noc' : n < 5 ? 'noci' : 'nocí'}`;

function occupancies(persons) {
  const rooms = Math.ceil(persons / 2);
  return Array.from({ length: rooms }, (_, i) => ({ adults: i < rooms - 1 ? 2 : persons - 2 * (rooms - 1) }));
}

export function liteApiProvider({ apiKey, cached }) {
  const base = 'https://api.liteapi.travel/v3.0';
  const headers = { 'X-API-Key': apiKey };
  return {
    id: 'liteapi', name: 'LiteAPI hotely', kind: 'lodging', website: 'https://www.liteapi.travel', mode: 'live',
    offers: 'Skutečné ceny a dostupnost hotelů po celém světě',
    async search(ctx) {
      const { dest, from, to, persons, nights } = ctx;
      const { cc, city } = liveMeta(dest);
      const hotels = await cached(`lite-hotels:${cc}:${city}`, 7 * 24 * HOUR, async () => {
        const res = await getJson(`${base}/data/hotels?${new URLSearchParams({ countryCode: cc, cityName: city, limit: '40' })}`, { headers });
        return (res.data || []).map((h) => ({ id: h.id, name: h.name, address: h.address, stars: h.stars, rating: h.rating }));
      });
      if (!hotels.length) return [];
      const rates = await cached(`lite-rates:${cc}:${city}:${from}:${to}:${persons}`, 6 * HOUR, async () => {
        const res = await getJson(`${base}/hotels/rates`, {
          method: 'POST', headers, timeoutMs: 30000,
          body: { hotelIds: hotels.map((h) => h.id), checkin: from, checkout: to, currency: 'CZK', guestNationality: 'CZ', occupancies: occupancies(persons) },
        });
        return (res.data || []).map((h) => {
          let best = null;
          for (const rt of h.roomTypes || []) {
            const amount = Number(rt.offerRetailRate?.amount ?? rt.rates?.[0]?.retailRate?.total?.[0]?.amount);
            if (Number.isFinite(amount) && (!best || amount < best.amount)) {
              const rate = rt.rates?.[0] || {};
              best = { amount, room: rate.name, board: rate.boardName, refundable: rate.cancellationPolicies?.refundableTag === 'RFN' };
            }
          }
          return best && { hotelId: h.hotelId, ...best };
        }).filter(Boolean);
      });
      const byId = new Map(hotels.map((h) => [h.id, h]));
      return rates.sort((a, b) => a.amount - b.amount).slice(0, 5).map((r, i) => {
        const h = byId.get(r.hotelId) || { name: 'Hotel' };
        const total = round10(r.amount);
        return {
          id: `liteapi-${dest.id}-${i}`, providerId: this.id, providerName: this.name, kind: 'lodging',
          title: h.name, subtitle: [h.stars ? '★'.repeat(Math.round(h.stars)) : null, h.address].filter(Boolean).join(' · ') || city,
          price: total,
          priceNote: `${round10(total / nights).toLocaleString('cs-CZ')} Kč / noc · ${nightsLabel(nights)}`,
          currency: 'CZK', rating: h.rating ? Math.round(Number(h.rating) * 10) / 10 : null,
          details: [r.room, r.board, r.refundable ? 'Bezplatné storno' : null].filter(Boolean),
          deepLink: `https://www.booking.com/searchresults.cs.html?ss=${encodeURIComponent(`${h.name} ${city}`)}&checkin=${from}&checkout=${to}&group_adults=${persons}`,
          mock: false,
        };
      });
    },
  };
}

export function serpHotelsProvider({ apiKey, cached, quota, monthlyLimit }) {
  return {
    id: 'google-hotels', name: 'Google Hotels (SerpApi)', kind: 'lodging', website: 'https://www.google.com/travel/hotels', mode: 'live',
    offers: 'Ceny hotelů u více prodejců (Booking.com, Expedia, Agoda…) z Google Hotels',
    async search(ctx) {
      const { dest, from, to, persons, nights } = ctx;
      const { city } = liveMeta(dest);
      const res = await cached(`serp-hotels:${city}:${from}:${to}:${persons}`, 24 * HOUR, async () => {
        await quota.take('serpapi', monthlyLimit);
        return getJson(`https://serpapi.com/search.json?${new URLSearchParams({
          engine: 'google_hotels', q: `${city} hotels`, check_in_date: from, check_out_date: to,
          adults: String(persons), currency: 'CZK', hl: 'cs', gl: 'cz', api_key: apiKey,
        })}`, { timeoutMs: 30000 });
      });
      const link = res.search_metadata?.google_hotels_url || `https://www.google.com/travel/hotels/${encodeURIComponent(city)}`;
      const props = (res.properties || []).filter((p) => Number.isFinite(p.total_rate?.extracted_lowest ?? p.rate_per_night?.extracted_lowest));
      return props
        .map((p) => ({ p, total: p.total_rate?.extracted_lowest ?? p.rate_per_night.extracted_lowest * nights }))
        .sort((a, b) => a.total - b.total).slice(0, 6)
        .map(({ p, total }, i) => {
          const sellers = (p.prices || []).filter((s) => s.source && s.rate_per_night?.extracted_lowest)
            .slice(0, 3).map((s) => `${s.source}: ${round10(s.rate_per_night.extracted_lowest).toLocaleString('cs-CZ')} Kč/noc`);
          return {
            id: `google-hotels-${dest.id}-${i}`, providerId: this.id, providerName: this.name, kind: 'lodging',
            title: p.name, subtitle: [p.hotel_class, p.type].filter(Boolean)[0] || city,
            price: round10(total),
            priceNote: `${round10(total / nights).toLocaleString('cs-CZ')} Kč / noc · ${nightsLabel(nights)}`,
            currency: 'CZK', rating: p.overall_rating ? Math.round(p.overall_rating * 20) / 10 : null,
            details: sellers.length ? sellers : (p.amenities || []).slice(0, 4),
            deepLink: p.link || link, mock: false,
          };
        });
    },
  };
}
