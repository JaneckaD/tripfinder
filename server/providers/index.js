// Registr poskytovatelů (vyhledávačů) dopravy a ubytování.
//
// Každý poskytovatel implementuje stejné rozhraní:
//   {
//     id: 'booking',               // unikátní id
//     name: 'Booking.com',         // zobrazované jméno
//     kind: 'transport' | 'lodging',
//     website: 'https://...',
//     mode: 'mock' | 'live',       // mock = ukázková data, live = skutečné API
//     async search(ctx) -> Offer[] // ctx viz buildSearchContext()
//   }
//
// Offer = { id, providerId, providerName, kind, title, subtitle, price, priceNote,
//           currency, rating, details: string[], deepLink, mock }
//
// Dokud uživatel neschválí konkrétní vyhledávače a nedodá API klíče, běží vše jako 'mock'.
// Které poskytovatele zapnout, určuje proměnná PROVIDERS (čárkami oddělená id), jinak všechny.
import { mockTransportProviders, mockLodgingProviders } from './mock.js';

const ALL = [...mockTransportProviders, ...mockLodgingProviders];

export function enabledProviders() {
  const wanted = (process.env.PROVIDERS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return wanted.length ? ALL.filter((p) => wanted.includes(p.id)) : ALL;
}

export function listProviders() {
  return enabledProviders().map(({ id, name, kind, website, mode, offers }) => ({ id, name, kind, website, mode, offers }));
}

export function buildSearchContext(dest, { from, to, persons = 2, origin = 'PRG' } = {}) {
  const today = new Date();
  const start = from ? new Date(from) : new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const end = to ? new Date(to) : new Date(start.getTime() + 7 * 86400000);
  const nights = Math.max(1, Math.round((end - start) / 86400000));
  const iso = (dt) => dt.toISOString().slice(0, 10);
  return {
    dest,
    origin: String(origin || 'PRG').toUpperCase().slice(0, 3),
    from: iso(start),
    to: iso(end),
    nights,
    persons: Math.min(20, Math.max(1, Number(persons) || 1)),
  };
}

export async function searchOffers(dest, params) {
  const ctx = buildSearchContext(dest, params);
  const results = await Promise.allSettled(enabledProviders().map((p) => p.search(ctx)));
  const offers = { transport: [], lodging: [] };
  const errors = [];
  results.forEach((r, i) => {
    const p = enabledProviders()[i];
    if (r.status === 'fulfilled') offers[p.kind].push(...r.value);
    else errors.push({ providerId: p.id, message: String(r.reason?.message || r.reason) });
  });
  offers.transport.sort((a, b) => a.price - b.price);
  offers.lodging.sort((a, b) => a.price - b.price);
  return { context: { ...ctx, dest: undefined, destinationId: dest.id }, offers, errors };
}
