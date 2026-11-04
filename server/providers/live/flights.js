// Skutečné ceny letenek: Travelpayouts (Aviasales Data API) a SerpApi Google Flights.
import { getJson, round10 } from './common.js';
import { liveMeta } from '../../data/live-meta.js';

const HOUR = 3600000;
const fmtDuration = (min) => (min ? `~${Math.floor(min / 60)} h ${min % 60} min` : null);
const stopsLabel = (n) => (n === 0 ? 'Přímý let' : `${n} ${n === 1 ? 'přestup' : n < 5 ? 'přestupy' : 'přestupů'}`);

export function travelpayoutsProvider({ token, marker, cached }) {
  return {
    id: 'travelpayouts', name: 'Aviasales (Travelpayouts)', kind: 'transport', website: 'https://www.aviasales.com', mode: 'live',
    offers: 'Skutečné ceny letenek z mezipaměti Aviasales (zdarma, mohou být pár hodin staré)',
    async search(ctx) {
      const { dest, origin, from, to, persons } = ctx;
      const destination = liveMeta(dest).cityCode;
      const query = (dep, ret) => `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${new URLSearchParams({
        origin, destination, departure_at: dep, return_at: ret, unique: 'false', sorting: 'price', direct: 'false',
        currency: 'czk', limit: '10', page: '1', one_way: 'false', token,
      })}`;
      const load = async () => {
        let res = await getJson(query(from, to));
        let exact = true;
        // Pro přesné datum často nic není – zkusíme celý měsíc.
        if (!res.data?.length) { res = await getJson(query(from.slice(0, 7), to.slice(0, 7))); exact = false; }
        return { exact, items: res.data || [] };
      };
      const { exact, items } = await cached(`tp:${origin}:${destination}:${from}:${to}`, 6 * HOUR, load);
      return items.slice(0, 5).map((f, i) => {
        const perPerson = Math.round(Number(f.price));
        const dep = (f.departure_at || '').slice(0, 10);
        const ret = (f.return_at || '').slice(0, 10);
        const link = f.link ? new URL(f.link, 'https://www.aviasales.com') : new URL(`https://www.aviasales.com/search/${origin}${ddmm(from)}${destination}${ddmm(to)}${persons}`);
        if (marker) link.searchParams.set('marker', marker);
        if (f.link) link.searchParams.set('adults', String(persons));
        return {
          id: `travelpayouts-${dest.id}-${i}`, providerId: this.id, providerName: this.name, kind: 'transport', mode: 'flight',
          title: `Let ${f.origin_airport || origin} → ${f.destination_airport || destination}${f.airline ? ` · ${f.airline}` : ''}`,
          subtitle: `${stopsLabel(f.transfers ?? 0)} tam, ${stopsLabel(f.return_transfers ?? 0).toLowerCase()} zpět`,
          price: perPerson * persons,
          priceNote: `${perPerson.toLocaleString('cs-CZ')} Kč / os. · zpáteční`,
          currency: 'CZK', rating: null,
          details: [`${dep} → ${ret}`, fmtDuration(f.duration_to), exact ? null : 'Nejbližší termín v tomto měsíci', 'Cena z mezipaměti, ověř u prodejce'].filter(Boolean),
          deepLink: link.toString(), mock: false,
        };
      });
    },
  };
}

const ddmm = (iso) => iso.slice(8, 10) + iso.slice(5, 7);

export function serpFlightsProvider({ apiKey, cached, quota, monthlyLimit }) {
  return {
    id: 'google-flights', name: 'Google Flights (SerpApi)', kind: 'transport', website: 'https://www.google.com/travel/flights', mode: 'live',
    offers: 'Živé ceny letenek z Google Flights (250 hledání měsíčně zdarma, výsledky se ukládají na 24 h)',
    async search(ctx) {
      const { dest, origin, from, to, persons } = ctx;
      const load = async () => {
        await quota.take('serpapi', monthlyLimit);
        return getJson(`https://serpapi.com/search.json?${new URLSearchParams({
          engine: 'google_flights', departure_id: origin, arrival_id: dest.airport, outbound_date: from, return_date: to,
          adults: String(persons), currency: 'CZK', hl: 'cs', gl: 'cz', api_key: apiKey,
        })}`, { timeoutMs: 30000 });
      };
      const res = await cached(`serp-flights:${origin}:${dest.airport}:${from}:${to}:${persons}`, 24 * HOUR, load);
      const link = res.search_metadata?.google_flights_url
        || `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${origin} to ${dest.airport} on ${from} through ${to}`)}`;
      const all = [...(res.best_flights || []), ...(res.other_flights || [])].filter((f) => Number.isFinite(f.price));
      return all.sort((a, b) => a.price - b.price).slice(0, 5).map((f, i) => {
        const legs = f.flights || [];
        const airlines = [...new Set(legs.map((l) => l.airline).filter(Boolean))].join(', ');
        const stops = Math.max(0, legs.length - 1);
        const total = round10(f.price);
        return {
          id: `google-flights-${dest.id}-${i}`, providerId: this.id, providerName: this.name, kind: 'transport', mode: 'flight',
          title: `Let ${legs[0]?.departure_airport?.id || origin} → ${legs.at(-1)?.arrival_airport?.id || dest.airport}${airlines ? ` · ${airlines}` : ''}`,
          subtitle: stops ? `${stopsLabel(stops)} (${(f.layovers || []).map((l) => l.name || l.id).filter(Boolean).slice(0, 2).join(', ')})` : 'Přímý let',
          price: total,
          priceNote: `${round10(total / persons).toLocaleString('cs-CZ')} Kč / os. · zpáteční`,
          currency: 'CZK', rating: null,
          details: [`${from} → ${to}`, fmtDuration(f.total_duration), legs[0]?.departure_airport?.time ? `odlet ${legs[0].departure_airport.time.slice(11)}` : null].filter(Boolean),
          deepLink: link, mock: false,
        };
      });
    },
  };
}
