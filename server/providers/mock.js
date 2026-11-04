// Ukázkoví (mock) poskytovatelé. Ceny jsou vymyšlené, ale deterministické
// (stejné hledání = stejná cena) a odvozené od vzdálenosti a cenové hladiny destinace.
// Odkazy (deepLink) vedou na skutečné vyhledávání u daného poskytovatele.

function seeded(...parts) {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
const round = (n, step = 10) => Math.round(n / step) * step;
const yymmdd = (iso) => iso.slice(2).replaceAll('-', '');
const enc = encodeURIComponent;

const AIRLINES = ['Smartwings', 'Lufthansa', 'KLM', 'Air France', 'Ryanair', 'Wizz Air', 'Emirates', 'Qatar Airways', 'Turkish Airlines', 'LOT'];
const HUBS = ['Frankfurt', 'Amsterdam', 'Paříž', 'Istanbul', 'Dauhá', 'Dubaj', 'Vídeň', 'Mnichov'];

function flightOffers(provider, ctx, { count, priceFactor }) {
  const { dest, persons } = ctx;
  const rnd = seeded(provider.id, dest.id, ctx.from, ctx.to, ctx.origin);
  const base = 800 + dest.distanceKm * 1.6;
  const hours = dest.distanceKm / 750 + 0.7;
  return Array.from({ length: count }, (_, i) => {
    const stops = dest.distanceKm < 2000 ? (rnd() < 0.7 ? 0 : 1) : dest.distanceKm < 7000 ? (rnd() < 0.3 ? 0 : 1) : 1 + (rnd() < 0.3 ? 1 : 0);
    const perPerson = round(base * priceFactor * (0.75 + rnd() * 0.6) * (stops === 0 ? 1.15 : 1));
    const duration = hours + stops * (1.5 + rnd() * 2.5);
    const airline = dest.distanceKm < 3000 ? pick(rnd, AIRLINES.slice(0, 6).concat(['Wizz Air', 'Ryanair'])) : pick(rnd, AIRLINES.slice(1));
    return {
      id: `${provider.id}-${dest.id}-${i}`,
      providerId: provider.id,
      providerName: provider.name,
      kind: 'transport',
      mode: 'flight',
      title: `Let ${ctx.origin} → ${dest.airport} · ${airline}`,
      subtitle: stops === 0 ? 'Přímý let' : `${stops} ${stops === 1 ? 'přestup' : 'přestupy'} (${pick(rnd, HUBS)})`,
      price: perPerson * persons,
      priceNote: `${perPerson.toLocaleString('cs-CZ')} Kč / os. · zpáteční`,
      currency: 'CZK',
      rating: null,
      details: [`${ctx.from} → ${ctx.to}`, `~${Math.floor(Math.round(duration * 60) / 60)} h ${Math.round(duration * 60) % 60} min`, rnd() < 0.5 ? 'Zavazadlo 23 kg v ceně' : 'Jen příruční zavazadlo'],
      deepLink: provider.link(ctx),
      mock: true,
    };
  });
}

function groundOffers(provider, ctx, { types }) {
  const { dest, persons } = ctx;
  if (dest.continent !== 'europe' || dest.distanceKm > 1500) return [];
  const rnd = seeded(provider.id, dest.id, ctx.from, ctx.to);
  return types.map((type, i) => {
    const perPerson = round((type === 'bus' ? 0.9 : 1.3) * (300 + dest.distanceKm * 1.1) * (0.8 + rnd() * 0.4));
    const hours = dest.distanceKm / (type === 'bus' ? 65 : 85);
    return {
      id: `${provider.id}-${dest.id}-${type}-${i}`,
      providerId: provider.id,
      providerName: provider.name,
      kind: 'transport',
      mode: type,
      title: `${type === 'bus' ? 'Autobus' : 'Vlak'} Praha → ${dest.name}`,
      subtitle: rnd() < 0.5 ? 'Přímý spoj' : '1 přestup',
      price: perPerson * persons,
      priceNote: `${perPerson.toLocaleString('cs-CZ')} Kč / os. · zpáteční`,
      currency: 'CZK',
      rating: null,
      details: [`${ctx.from} → ${ctx.to}`, `~${Math.round(hours)} h jízdy`, type === 'bus' ? 'Wi‑Fi, zásuvky' : 'Možnost lehátka'],
      deepLink: provider.link(ctx),
      mock: true,
    };
  });
}

const LODGING_TYPES = {
  booking: ['Hotel', 'Hotel', 'Apartmán', 'Penzion', 'Resort'],
  airbnb: ['Celý byt', 'Celý dům', 'Soukromý pokoj', 'Loft', 'Vila'],
  expedia: ['Hotel', 'Resort', 'Boutique hotel'],
  hostelworld: ['Hostel – dorm', 'Hostel – soukromý pokoj'],
};
const NAMES = ['Central', 'Panorama', 'Sunset', 'Old Town', 'Garden', 'Harbour', 'Skyline', 'Boutique', 'Riverside', 'Green'];
const AMENITIES = ['Snídaně v ceně', 'Bazén', 'Wi‑Fi', 'Kuchyňka', 'Parkování', 'Výhled na moře', 'Klimatizace', 'Pračka', 'Fitness', 'Bezplatné storno'];

function lodgingOffers(provider, ctx, { count, priceFactor }) {
  const { dest, persons, nights } = ctx;
  const rnd = seeded(provider.id, dest.id, ctx.from, ctx.to, String(persons));
  const types = LODGING_TYPES[provider.id];
  const units = provider.id === 'hostelworld' ? persons : Math.ceil(persons / 2);
  return Array.from({ length: count }, (_, i) => {
    const type = pick(rnd, types);
    const perNight = round((600 + dest.dailyCost * 0.9) * priceFactor * (0.6 + rnd() * 1.1) * (type.includes('dům') || type === 'Vila' ? 1.8 : 1));
    const isWhole = /Celý|Vila|Apartmán|Loft/.test(type);
    const nightTotal = isWhole ? perNight * Math.max(1, Math.ceil(persons / 4)) : perNight * units;
    const amenities = AMENITIES.filter(() => rnd() < 0.35).slice(0, 4);
    return {
      id: `${provider.id}-${dest.id}-${i}`,
      providerId: provider.id,
      providerName: provider.name,
      kind: 'lodging',
      title: `${type} ${pick(rnd, NAMES)} ${dest.name}`,
      subtitle: `${(0.3 + rnd() * 4).toFixed(1)} km od centra`,
      price: nightTotal * nights,
      priceNote: `${nightTotal.toLocaleString('cs-CZ')} Kč / noc · ${nights} ${nights === 1 ? 'noc' : nights < 5 ? 'noci' : 'nocí'}`,
      currency: 'CZK',
      rating: Math.round((7 + rnd() * 2.8) * 10) / 10,
      details: amenities.length ? amenities : ['Wi‑Fi'],
      deepLink: provider.link(ctx),
      mock: true,
    };
  });
}

export const mockTransportProviders = [
  {
    id: 'kiwi', name: 'Kiwi.com', kind: 'transport', website: 'https://www.kiwi.com', mode: 'mock',
    offers: 'Letenky včetně „virtuálního interliningu“, kombinace s autobusy a vlaky',
    link: (c) => `https://www.kiwi.com/deep?from=${c.origin}&to=${c.dest.airport}&departure=${c.from}&return=${c.to}&adults=${c.persons}`,
    search(ctx) { return Promise.resolve(flightOffers(this, ctx, { count: 3, priceFactor: 0.92 })); },
  },
  {
    id: 'skyscanner', name: 'Skyscanner', kind: 'transport', website: 'https://www.skyscanner.cz', mode: 'mock',
    offers: 'Srovnávač letenek napříč aerolinkami a prodejci',
    link: (c) => `https://www.skyscanner.cz/transport/lety/${c.origin.toLowerCase()}/${c.dest.airport.toLowerCase()}/${yymmdd(c.from)}/${yymmdd(c.to)}/?adultsv2=${c.persons}`,
    search(ctx) { return Promise.resolve(flightOffers(this, ctx, { count: 3, priceFactor: 0.97 })); },
  },
  {
    id: 'amadeus', name: 'Google Flights', linkName: 'Google Flights', kind: 'transport', website: 'https://www.google.com/travel/flights', mode: 'mock',
    offers: 'Přehled letů všech aerolinek',
    link: (c) => `https://www.google.com/travel/flights?q=${enc(`Flights from ${c.origin} to ${c.dest.airport} on ${c.from} through ${c.to}`)}`,
    search(ctx) { return Promise.resolve(flightOffers(this, ctx, { count: 2, priceFactor: 1.05 })); },
  },
  {
    id: 'flixbus', name: 'Vlaky a autobusy', linkName: 'Vlaky a autobusy (Omio)', kind: 'transport', website: 'https://www.omio.cz', mode: 'mock',
    offers: 'Autobusy a vlaky po Evropě',
    applies: (c) => c.dest.continent === 'europe' && c.dest.distanceKm <= 1500,
    link: () => 'https://www.omio.cz/',
    search(ctx) { return Promise.resolve(groundOffers(this, ctx, { types: ['bus', 'train'] })); },
  },
];

export const mockLodgingProviders = [
  {
    id: 'booking', name: 'Booking.com', kind: 'lodging', website: 'https://www.booking.com', mode: 'mock',
    offers: 'Hotely, apartmány, penziony',
    link: (c) => `https://www.booking.com/searchresults.cs.html?ss=${enc(c.dest.name)}&checkin=${c.from}&checkout=${c.to}&group_adults=${c.persons}`,
    search(ctx) { return Promise.resolve(lodgingOffers(this, ctx, { count: 3, priceFactor: 1 })); },
  },
  {
    id: 'airbnb', name: 'Airbnb', kind: 'lodging', website: 'https://www.airbnb.cz', mode: 'mock',
    offers: 'Soukromé byty, domy a pokoje',
    link: (c) => `https://www.airbnb.cz/s/${enc(c.dest.name)}/homes?checkin=${c.from}&checkout=${c.to}&adults=${c.persons}`,
    search(ctx) { return Promise.resolve(lodgingOffers(this, ctx, { count: 3, priceFactor: 0.95 })); },
  },
  {
    id: 'expedia', name: 'Expedia / Hotels.com', kind: 'lodging', website: 'https://www.expedia.com', mode: 'mock',
    offers: 'Hotely a resorty, balíčky let + hotel',
    link: (c) => `https://www.expedia.com/Hotel-Search?destination=${enc(c.dest.name)}&startDate=${c.from}&endDate=${c.to}&adults=${c.persons}`,
    search(ctx) { return Promise.resolve(lodgingOffers(this, ctx, { count: 2, priceFactor: 1.1 })); },
  },
  {
    id: 'hostelworld', name: 'Hostelworld', kind: 'lodging', website: 'https://www.hostelworld.com', mode: 'mock',
    offers: 'Levné hostely pro batůžkáře',
    link: (c) => `https://www.hostelworld.com/search?search_keywords=${enc(c.dest.name)}&date_from=${c.from}&date_to=${c.to}&number_of_guests=${c.persons}`,
    search(ctx) { return Promise.resolve(lodgingOffers(this, ctx, { count: 1, priceFactor: 0.35 })); },
  },
];
