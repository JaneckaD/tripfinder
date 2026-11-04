// Registr poskytovatelů (vyhledávačů) dopravy a ubytování.
//
// Každý poskytovatel implementuje stejné rozhraní:
//   {
//     id: 'airbnb-live',          // unikátní id
//     name: 'Airbnb',             // zobrazované jméno
//     kind: 'transport' | 'lodging',
//     website: 'https://...',
//     mode: 'mock' | 'live',       // mock = ukázková data, live = skutečné API
//     async search(ctx) -> Offer[] // ctx viz buildSearchContext()
//   }
//
// Offer = { id, providerId, providerName, kind, title, subtitle, price, priceNote,
//           currency, rating, details: string[], deepLink, mock }
//
// Skuteční poskytovatelé se zapnou sami, když je v prostředí jejich API klíč:
//   TRAVELPAYOUTS_TOKEN (+ volitelně TRAVELPAYOUTS_MARKER) – letenky Aviasales
//   SERPAPI_KEY (+ SERPAPI_MONTHLY_LIMIT, výchozí 240)    – Google Flights + Airbnb
// Když pro daný druh (doprava / ubytování) běží aspoň jeden skutečný poskytovatel,
// ukázkové nabídky toho druhu se skryjí a místo nich se zobrazí jen odkazy
// „porovnat i na Skyscanneru, Omiu…“. PROVIDERS=id1,id2 omezí, kdo je zapnutý.
import { mockTransportProviders, mockLodgingProviders, flightSearchLinks } from './mock.js';
import { makeCache, makeQuota } from './live/common.js';
import { travelpayoutsProvider, serpFlightsProvider } from './live/flights.js';
import { serpAirbnbProvider } from './live/airbnb.js';
import { countryInfo, haversineKm, resolveOrigin } from '../geo.js';

export function buildSearchContext(dest, { from, to, persons = 2, origin = 'PRG', oneWay = false } = {}) {
  const today = new Date();
  const start = from ? new Date(from) : new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const end = to ? new Date(to) : new Date(start.getTime() + 7 * 86400000);
  const nights = Math.max(1, Math.round((end - start) / 86400000));
  const iso = (dt) => dt.toISOString().slice(0, 10);
  const o = resolveOrigin(origin);
  return {
    dest,
    origin: o.code,
    originId: o.id,
    originName: o.name,
    originPlace: { lat: o.lat, lng: o.lng, name: o.name, cc: o.cc || '' },
    originContinent: countryInfo(o.cc || 'CZ').continent,
    distanceKm: haversineKm(o, dest),
    oneWay: Boolean(oneWay) && oneWay !== 'false' && oneWay !== '0',
    from: iso(start),
    to: iso(end),
    nights,
    persons: Math.min(20, Math.max(1, Number(persons) || 1)),
  };
}

export function createProviders(db, env = process.env) {
  const cached = makeCache(db);
  const quota = makeQuota(db);
  const monthlyLimit = Number(env.SERPAPI_MONTHLY_LIMIT) || 240;

  const live = [];
  if (env.TRAVELPAYOUTS_TOKEN) live.push(travelpayoutsProvider({ token: env.TRAVELPAYOUTS_TOKEN, marker: env.TRAVELPAYOUTS_MARKER, cached }));
  if (env.SERPAPI_KEY) {
    live.push(serpFlightsProvider({ apiKey: env.SERPAPI_KEY, cached, quota, monthlyLimit }));
    live.push(serpAirbnbProvider({ apiKey: env.SERPAPI_KEY, cached, quota, monthlyLimit }));
  }

  const wanted = (env.PROVIDERS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const allow = (p) => !wanted.length || wanted.includes(p.id);
  const mocks = [...mockTransportProviders, ...mockLodgingProviders].filter(allow);
  const lives = live.filter(allow);
  const hasLive = (kind) => lives.some((p) => p.kind === kind);
  // Ukázkoví poskytovatelé daného druhu běží jen tehdy, když pro něj není žádný skutečný.
  // „Autem / pěšky“ není ukázka, ale vlastní výpočet – běží vždy.
  const searchers = [...lives, ...mocks.filter((p) => p.mode === 'own' || !hasLive(p.kind))];

  return {
    list() {
      return [...lives, ...mocks].map(({ id, name, kind, website, mode, offers }) => ({
        id, name, kind, website, offers, mode: mode === 'mock' && hasLive(kind) ? 'link' : mode,
      }));
    },
    serpapiUsage: async () => (env.SERPAPI_KEY ? { used: await quota.used('serpapi'), limit: monthlyLimit } : null),

    // opts.kinds = ['transport'] omezí druh, opts.skip = ['google-flights'] vynechá poskytovatele (šetří kvótu)
    async search(dest, params, opts = {}) {
      const ctx = buildSearchContext(dest, params);
      const use = (p) => (!opts.kinds || opts.kinds.includes(p.kind)) && !(opts.skip || []).includes(p.id);
      const active = searchers.filter(use);
      const results = await Promise.allSettled(active.map((p) => p.search(ctx)));
      const offers = { transport: [], lodging: [] };
      const errors = [];
      results.forEach((r, i) => {
        const p = active[i];
        if (r.status === 'fulfilled') offers[p.kind].push(...r.value);
        else {
          console.warn(`[provider ${p.id}]`, r.reason?.message || r.reason);
          errors.push({ providerId: p.id, providerName: p.name, message: String(r.reason?.message || r.reason) });
        }
      });

      // Když všichni skuteční poskytovatelé jednoho druhu selžou, ukážeme aspoň ukázková data.
      for (const kind of opts.kinds || ['transport', 'lodging']) {
        if (hasLive(kind) && !offers[kind].some((o) => !o.own)) {
          const fallback = await Promise.all(mocks.filter((p) => p.kind === kind && p.mode !== 'own').map((p) => p.search(ctx).catch(() => [])));
          offers[kind].push(...fallback.flat());
        }
      }
      // Každý let dostane odkazy na stejné hledání (odkud, kam, datum) i u dalších prodejců.
      for (const o of offers.transport) if (!o.searchLinks && !o.own && o.mode === 'flight') o.searchLinks = flightSearchLinks(ctx);
      offers.transport.sort((a, b) => a.price - b.price);
      offers.lodging.sort((a, b) => a.price - b.price);

      // Odkazy na poskytovatele bez API (předvyplněné hledání).
      const links = { transport: [], lodging: [] };
      for (const p of mocks) {
        if (p.mode === 'own' || !hasLive(p.kind) || (p.applies && !p.applies(ctx)) || (opts.kinds && !opts.kinds.includes(p.kind))) continue;
        links[p.kind].push({ providerId: p.id, name: p.linkName || p.name, url: p.link(ctx) });
      }

      return { context: { ...ctx, dest: undefined, originPlace: undefined, destinationId: dest.id, destination: { name: dest.name, lat: dest.lat, lng: dest.lng }, originPoint: ctx.originPlace }, offers, links, errors };
    },
  };
}
