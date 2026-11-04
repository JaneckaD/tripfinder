// Ukázkoví (mock) poskytovatelé. Ceny i časy jsou vymyšlené, ale deterministické
// (stejné hledání = stejný výsledek) a odvozené od vzdálenosti a cenové hladiny destinace.
// Odkazy (deepLink) vedou na skutečné vyhledávání u daného poskytovatele.
import { airportByCode, cityCs, haversineKm, hubNear } from '../geo.js';

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
const czk = (n) => n.toLocaleString('cs-CZ');
// 'YYYY-MM-DDTHH:MM' + minuty (počítáno v UTC, aby nehrálo roli časové pásmo serveru)
export const addMin = (t, min) => new Date(new Date(`${t}Z`).getTime() + Math.round(min) * 60000).toISOString().slice(0, 16);
const at = (date, hour, rnd) => `${date}T${String(hour).padStart(2, '0')}:${pick(rnd, ['00', '05', '15', '20', '30', '35', '45', '50'])}`;
export const fmtMin = (m) => `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
const pt = (p) => [Math.round(p.lat * 1e4) / 1e4, Math.round(p.lng * 1e4) / 1e4];

const AIRLINES_SHORT = ['Smartwings', 'Ryanair', 'Wizz Air', 'easyJet', 'Lufthansa', 'Austrian', 'KLM', 'Eurowings', 'Vueling', 'LOT'];
const AIRLINES_LONG = ['Emirates', 'Qatar Airways', 'Turkish Airlines', 'Lufthansa', 'KLM', 'Air France', 'Etihad', 'Finnair', 'Singapore Airlines', 'LOT'];
const HUB_CODES = ['FRA', 'AMS', 'CDG', 'IST', 'DOH', 'DXB', 'VIE', 'MUC', 'ZRH', 'WAW', 'HEL', 'LHR', 'MAD', 'ADD', 'SIN', 'BKK', 'JFK', 'ATL', 'GRU', 'BOG'];
const TRAINS = {
  CZ: ['RegioJet', 'České dráhy', 'Leo Express'], SK: ['ZSSK', 'RegioJet'], AT: ['ÖBB Railjet', 'Westbahn'], DE: ['Deutsche Bahn ICE', 'Deutsche Bahn IC'],
  IT: ['Trenitalia Frecciarossa', 'Italo'], FR: ['SNCF TGV inOui', 'Ouigo'], ES: ['Renfe AVE', 'Iryo'], PL: ['PKP Intercity'], HU: ['MÁV-Start'],
  CH: ['SBB'], NL: ['NS International'], BE: ['SNCB'], GB: ['Avanti West Coast', 'LNER'], JP: ['JR Shinkansen'], '': ['Místní železnice'],
};
const BUSES = ['FlixBus', 'RegioJet bus', 'BlaBlaCar Bus', 'Eurolines', 'Alsa'];
const TRANSFERS = { bus: 'Letištní autobus', train: 'Vlak na letiště', car: 'Taxi / transfer' };

// Bod na Zemi pro výchozí místo a cíl.
const destPoint = (dest) => ({ lat: dest.lat, lng: dest.lng, name: dest.name, cc: dest.cc || '' });
const airportPoint = (code, fallback) => {
  const a = airportByCode(code);
  return a ? { lat: a.lat, lng: a.lng, name: cityCs(a), code: a.code, cc: a.cc } : { ...fallback, code };
};

function groundLeg(rnd, mode, from, to, depart, carrier) {
  const km = haversineKm(from, to) * 1.25;
  const speed = mode === 'train' ? 95 : mode === 'bus' ? 72 : 60;
  const durationMin = Math.max(20, round((km / speed) * 60 + 10, 5));
  return {
    mode, from: from.name, to: to.name, fromCode: from.code, toCode: to.code, fromPt: pt(from), toPt: pt(to),
    depart, arrive: addMin(depart, durationMin), durationMin, carrier: carrier || pick(rnd, mode === 'train' ? TRAINS[from.cc] || TRAINS[''] : BUSES),
    number: mode === 'train' ? `${pick(rnd, ['RJ', 'EC', 'IC', 'RJX', 'ICE'])} ${100 + Math.floor(rnd() * 900)}` : mode === 'bus' ? `Linka ${100 + Math.floor(rnd() * 900)}` : null,
  };
}

function flightLeg(rnd, from, to, depart, carrier) {
  const km = haversineKm(from, to);
  const durationMin = round((km / 780) * 60 + 40, 5);
  return {
    mode: 'flight', from: from.name, to: to.name, fromCode: from.code, toCode: to.code, fromPt: pt(from), toPt: pt(to),
    depart, arrive: addMin(depart, durationMin), durationMin, carrier,
    number: `${carrier.replace(/[^A-Z]/g, '').slice(0, 2).padEnd(2, 'X')} ${100 + Math.floor(rnd() * 8900)}`,
  };
}

// Sestaví cestu letadlem z místa A do místa B (včetně dopravy na letiště a z letiště).
function flightJourney(rnd, ctx, { fromPlace, toPlace, fromCode, toCode, date, stops, airline }) {
  const legs = [];
  const a = airportPoint(fromCode, fromPlace);
  const b = airportPoint(toCode, toPlace);
  let t = at(date, 6 + Math.floor(rnd() * 13), rnd);
  // Na letiště (když je výchozí místo dál než 30 km)
  const accessKm = haversineKm(fromPlace, a);
  if (accessKm > 30) {
    const mode = accessKm > 120 ? 'train' : 'bus';
    const l = groundLeg(rnd, mode, fromPlace, a, addMin(t, -(accessKm * 1.25 / (mode === 'train' ? 95 : 72)) * 60 - 150));
    l.carrier = accessKm > 120 ? l.carrier : TRANSFERS.bus;
    legs.push(l);
  }
  const points = [a];
  if (stops > 0) {
    const hubs = HUB_CODES.map((c) => airportPoint(c)).filter((h) => h.lat && h.code !== a.code && h.code !== b.code)
      .map((h) => ({ h, extra: haversineKm(a, h) + haversineKm(h, b) - haversineKm(a, b) }))
      .sort((x, y) => x.extra - y.extra);
    for (let i = 0; i < stops; i++) points.push(hubs[i]?.h || hubNear({ lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 }, [a.code, b.code]));
  }
  points.push(b);
  for (let i = 0; i < points.length - 1; i++) {
    const l = flightLeg(rnd, points[i], points[i + 1], t, airline);
    legs.push(l);
    t = addMin(l.arrive, 70 + rnd() * 150);
  }
  // Z letiště do cíle
  const egressKm = haversineKm(b, toPlace);
  if (egressKm > 25) legs.push(groundLeg(rnd, egressKm > 150 ? 'train' : 'bus', b, toPlace, addMin(legs.at(-1).arrive, 45), egressKm > 150 ? null : TRANSFERS.bus));
  return legs;
}

const journeyMeta = (legs) => {
  const durationMin = Math.round((new Date(`${legs.at(-1).arrive}Z`) - new Date(`${legs[0].depart}Z`)) / 60000);
  return { durationMin, changes: legs.length - 1 };
};
const changesLabel = (n) => (n === 0 ? 'Přímý spoj' : `${n} ${n === 1 ? 'přestup' : n < 5 ? 'přestupy' : 'přestupů'}`);

function flightOffers(provider, ctx, { count, priceFactor }) {
  const { dest, persons } = ctx;
  const rnd = seeded(provider.id, dest.id, ctx.from, ctx.to, ctx.origin, ctx.originName);
  const from = ctx.originPlace; const to = destPoint(dest);
  if (ctx.origin === dest.airport) return [];
  const km = haversineKm(airportPoint(ctx.origin, from), airportPoint(dest.airport, to));
  if (km < 150 || ctx.distanceKm < 300) return [];
  const base = 800 + km * 1.6;
  return Array.from({ length: count }, (_, i) => {
    const stops = km < 2000 ? (rnd() < 0.7 ? 0 : 1) : km < 7000 ? (rnd() < 0.3 ? 0 : 1) : 1 + (rnd() < 0.3 ? 1 : 0);
    const airline = km < 3000 ? pick(rnd, AIRLINES_SHORT) : pick(rnd, AIRLINES_LONG);
    const legs = flightJourney(rnd, ctx, { fromPlace: from, toPlace: to, fromCode: ctx.origin, toCode: dest.airport, date: ctx.from, stops, airline });
    const returnLegs = ctx.oneWay ? null : flightJourney(rnd, ctx, { fromPlace: to, toPlace: from, fromCode: dest.airport, toCode: ctx.origin, date: ctx.to, stops, airline });
    const { durationMin, changes } = journeyMeta(legs);
    const perPerson = round(base * priceFactor * (0.75 + rnd() * 0.6) * (stops === 0 ? 1.15 : 1) * (ctx.oneWay ? 0.55 : 1));
    const flights = legs.filter((l) => l.mode === 'flight');
    return {
      id: `${provider.id}-${dest.id}-${i}`, providerId: provider.id, providerName: provider.name, kind: 'transport',
      mode: legs.some((l) => l.mode !== 'flight') ? 'combo' : 'flight',
      title: `Let ${flights[0].fromCode} → ${flights.at(-1).toCode} · ${airline}`,
      subtitle: `${changes ? changesLabel(changes) : 'Přímý let'}${stops ? ` (${flights.slice(1).map((l) => l.from).join(', ')})` : ''}`,
      price: perPerson * persons,
      priceNote: `${czk(perPerson)} Kč / os. · ${ctx.oneWay ? 'jednosměrná' : 'zpáteční'}`,
      currency: 'CZK', rating: null,
      details: [`${legs[0].depart.slice(11)} → ${legs.at(-1).arrive.slice(11)}`, `~${fmtMin(durationMin)}`, rnd() < 0.5 ? 'Zavazadlo 23 kg v ceně' : 'Jen příruční zavazadlo'],
      legs, returnLegs, durationMin, changes,
      deepLink: provider.link(ctx), mock: true,
    };
  });
}

// Pozemní spojení: přímý vlak, přímý autobus a kombinace vlak + autobus s přestupem.
function groundJourneys(rnd, ctx, from, to, date) {
  const km = haversineKm(from, to);
  const out = [];
  const t0 = at(date, 6 + Math.floor(rnd() * 10), rnd);
  if (km <= 1300) out.push({ type: 'train', legs: [groundLeg(rnd, 'train', from, to, t0)] });
  out.push({ type: 'bus', legs: [groundLeg(rnd, 'bus', from, to, addMin(t0, 40 + rnd() * 200))] });
  if (km > 220) {
    const mid = { lat: from.lat + (to.lat - from.lat) * (0.4 + rnd() * 0.2), lng: from.lng + (to.lng - from.lng) * (0.4 + rnd() * 0.2) };
    const hub = hubNear(mid);
    if (hub && haversineKm(hub, from) > 60 && haversineKm(hub, to) > 60) {
      const h = { lat: hub.lat, lng: hub.lng, name: cityCs(hub), cc: hub.cc };
      const first = groundLeg(rnd, 'train', from, h, addMin(t0, -60));
      const second = groundLeg(rnd, 'bus', h, to, addMin(first.arrive, 25 + rnd() * 60));
      out.push({ type: 'combo', legs: [first, second] });
    }
  }
  return out;
}

function groundOffers(provider, ctx) {
  const { dest, persons } = ctx;
  if (!provider.applies(ctx)) return [];
  const rnd = seeded(provider.id, dest.id, ctx.from, ctx.to, ctx.originName);
  const from = ctx.originPlace; const to = destPoint(dest);
  const back = ctx.oneWay ? [] : groundJourneys(rnd, ctx, to, from, ctx.to);
  return groundJourneys(rnd, ctx, from, to, ctx.from).map((j, i) => {
    const km = haversineKm(from, to);
    const perPerson = round((j.type === 'bus' ? 0.9 : j.type === 'combo' ? 1 : 1.3) * (150 + km * 1.05) * (0.8 + rnd() * 0.4) * (ctx.oneWay ? 0.5 : 1));
    const { durationMin, changes } = journeyMeta(j.legs);
    const label = { train: 'Vlak', bus: 'Autobus', combo: 'Vlak + autobus' }[j.type];
    return {
      id: `${provider.id}-${dest.id}-${j.type}-${i}`, providerId: provider.id, providerName: provider.name, kind: 'transport',
      mode: j.type, title: `${label} ${from.name} → ${dest.name}`,
      subtitle: changes ? `${changesLabel(changes)} (${j.legs.slice(1).map((l) => l.from).join(', ')})` : `Přímý spoj · ${j.legs[0].carrier}`,
      price: perPerson * persons,
      priceNote: `${czk(perPerson)} Kč / os. · ${ctx.oneWay ? 'jednosměrná' : 'zpáteční'}`,
      currency: 'CZK', rating: null,
      details: [`${j.legs[0].depart.slice(11)} → ${j.legs.at(-1).arrive.slice(11)}`, `~${fmtMin(durationMin)}`, j.type === 'bus' ? 'Wi‑Fi, zásuvky' : 'Jídelní vůz, Wi‑Fi'],
      legs: j.legs, returnLegs: back.find((b) => b.type === j.type)?.legs || back[0]?.legs || null, durationMin, changes,
      deepLink: provider.link(ctx), mock: true,
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
    const distance = 0.3 + rnd() * 4;
    const angle = rnd() * Math.PI * 2;
    return {
      id: `${provider.id}-${dest.id}-${i}`, providerId: provider.id, providerName: provider.name, kind: 'lodging',
      title: `${type} ${pick(rnd, NAMES)} ${dest.name}`,
      subtitle: `${distance.toFixed(1)} km od centra`,
      price: nightTotal * nights,
      priceNote: `${czk(nightTotal)} Kč / noc · ${nights} ${nights === 1 ? 'noc' : nights < 5 ? 'noci' : 'nocí'}`,
      currency: 'CZK', rating: Math.round((7 + rnd() * 2.8) * 10) / 10,
      details: amenities.length ? amenities : ['Wi‑Fi'],
      stayType: type,
      location: { lat: dest.lat + (Math.sin(angle) * distance) / 111, lng: dest.lng + (Math.cos(angle) * distance) / (111 * Math.cos((dest.lat * Math.PI) / 180)) },
      checkin: ctx.from, checkout: ctx.to, nights,
      photos: [], // ukázková data nemají skutečné fotky – ty dodá LiteAPI / Google Hotels
      deepLink: provider.link(ctx), mock: true,
    };
  });
}

export const mockTransportProviders = [
  {
    id: 'kiwi', name: 'Kiwi.com', kind: 'transport', website: 'https://www.kiwi.com', mode: 'mock',
    offers: 'Letenky včetně „virtuálního interliningu“, kombinace s autobusy a vlaky',
    link: (c) => `https://www.kiwi.com/deep?from=${c.origin}&to=${c.dest.airport}&departure=${c.from}${c.oneWay ? '' : `&return=${c.to}`}&adults=${c.persons}`,
    search(ctx) { return Promise.resolve(flightOffers(this, ctx, { count: 3, priceFactor: 0.92 })); },
  },
  {
    id: 'skyscanner', name: 'Skyscanner', kind: 'transport', website: 'https://www.skyscanner.cz', mode: 'mock',
    offers: 'Srovnávač letenek napříč aerolinkami a prodejci',
    link: (c) => `https://www.skyscanner.cz/transport/lety/${c.origin.toLowerCase()}/${c.dest.airport.toLowerCase()}/${yymmdd(c.from)}/${c.oneWay ? '' : `${yymmdd(c.to)}/`}?adultsv2=${c.persons}`,
    search(ctx) { return Promise.resolve(flightOffers(this, ctx, { count: 3, priceFactor: 0.97 })); },
  },
  {
    id: 'amadeus', name: 'Google Flights', linkName: 'Google Flights', kind: 'transport', website: 'https://www.google.com/travel/flights', mode: 'mock',
    offers: 'Přehled letů všech aerolinek',
    link: (c) => `https://www.google.com/travel/flights?q=${enc(`Flights from ${c.origin} to ${c.dest.airport} on ${c.from}${c.oneWay ? ' one way' : ` through ${c.to}`}`)}`,
    search(ctx) { return Promise.resolve(flightOffers(this, ctx, { count: 2, priceFactor: 1.05 })); },
  },
  {
    id: 'flixbus', name: 'Vlaky a autobusy', linkName: 'Vlaky a autobusy (Omio)', kind: 'transport', website: 'https://www.omio.cz', mode: 'mock',
    offers: 'Vlaky a autobusy včetně přestupů (Evropa a kratší vzdálenosti)',
    applies: (c) => c.distanceKm <= 1700 && (c.dest.continent === 'europe' ? c.originContinent === 'europe' : c.distanceKm <= 900),
    link: () => 'https://www.omio.cz/',
    search(ctx) { return Promise.resolve(groundOffers(this, ctx)); },
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
