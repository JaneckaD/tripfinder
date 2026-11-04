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

// Ukázkové nabídky ve stylu Airbnb (bez klíče SerpApi). Odkaz vede na hledání Airbnb ve stejném výřezu mapy
// a termínu – konkrétní inzerát umí jen skutečná data (SerpApi engine=airbnb).
const STAY_TYPES = [
  ['Byt', 'Celý byt', 1], ['Apartmán', 'Celý apartmán', 1], ['Loft', 'Celý loft', 1.15], ['Dům', 'Celý dům', 1.7],
  ['Pokoj', 'Soukromý pokoj', 0.55], ['Chata', 'Celá chata', 1.3], ['Vila', 'Celá vila', 2.2], ['Studio', 'Celé studio', 0.85],
];
const VIBES = ['se slunnou terasou', 'v historickém centru', 's výhledem', 'u parku', 'v klidné čtvrti', 's balkonem', 'designový', 'u řeky', 'pod střechou', 's vlastní zahradou'];
const HIGHLIGHTS = ['Samostatný příjezd', 'Superhostitel', 'Výborná poloha', 'Bezplatné storno do 48 h', 'Rychlá Wi‑Fi', 'Plně vybavená kuchyně', 'Pračka', 'Klimatizace', 'Parkování zdarma', 'Pracovní kout', 'Domácí mazlíčci vítáni'];
const HOSTS = ['Tereza', 'Marco', 'Ana', 'Lukas', 'Sofia', 'Jan', 'Elena', 'Kenji', 'Amira', 'Pierre', 'Lucía', 'Noah'];

export const airbnbSearchLink = (c) => {
  const d = c.dest; const km = d.geo ? 4 : 8;
  const dLat = km / 111; const dLng = km / (111 * Math.max(0.2, Math.cos((d.lat * Math.PI) / 180)));
  return `https://www.airbnb.cz/s/${enc(d.name)}/homes?${new URLSearchParams({
    checkin: c.from, checkout: c.to, adults: String(c.persons), search_by_map: 'true',
    ne_lat: (d.lat + dLat).toFixed(4), ne_lng: (d.lng + dLng).toFixed(4), sw_lat: (d.lat - dLat).toFixed(4), sw_lng: (d.lng - dLng).toFixed(4),
  })}`;
};

function lodgingOffers(provider, ctx, { count }) {
  const { dest, persons, nights } = ctx;
  const rnd = seeded(provider.id, dest.id, ctx.from, ctx.to, String(persons));
  return Array.from({ length: count }, (_, i) => {
    const [short, type, factor] = pick(rnd, STAY_TYPES);
    const bedrooms = short === 'Pokoj' || short === 'Studio' ? 1 : Math.max(1, Math.ceil(persons / 2) + (rnd() < 0.3 ? 1 : 0));
    const perNight = round((450 + dest.dailyCost * 0.75) * factor * (0.7 + rnd() * 0.9) * Math.max(1, persons / 2.5));
    const distance = 0.2 + rnd() * 3.5;
    const angle = rnd() * Math.PI * 2;
    const rating = Math.round((4.55 + rnd() * 0.45) * 100) / 100;
    const host = pick(rnd, HOSTS);
    const hl = HIGHLIGHTS.filter(() => rnd() < 0.3).slice(0, 4);
    return {
      id: `${provider.id}-${dest.id}-${i}`, providerId: provider.id, providerName: 'Airbnb', kind: 'lodging',
      title: `${short} ${pick(rnd, VIBES)}`,
      subtitle: `${type} · ${distance.toFixed(1)} km od centra · hostitel ${host}`,
      price: perNight * nights,
      priceNote: `${czk(perNight)} Kč / noc · ${nights} ${nights === 1 ? 'noc' : nights < 5 ? 'noci' : 'nocí'}`,
      currency: 'CZK', rating, ratingScale: 5, reviews: 5 + Math.floor(rnd() * 380),
      details: [`${bedrooms} ${bedrooms === 1 ? 'ložnice' : bedrooms < 5 ? 'ložnice' : 'ložnic'}`, `${bedrooms + (rnd() < 0.5 ? 1 : 0)} postele`, `${Math.max(1, Math.ceil(bedrooms / 2))} koupelna`],
      amenities: hl, badges: rating > 4.9 ? ['Oblíbené u hostů'] : [],
      stayType: type,
      location: { lat: dest.lat + (Math.sin(angle) * distance) / 111, lng: dest.lng + (Math.cos(angle) * distance) / (111 * Math.cos((dest.lat * Math.PI) / 180)) },
      checkin: ctx.from, checkout: ctx.to, nights,
      photos: [],
      deepLink: provider.link(ctx), direct: false, mock: true,
    };
  });
}

// Vlastní cestou: autem nebo pěšky (časy a vzdálenost odhadem, přesnou trasu dodá /api/directions).
function ownWayOffers(provider, ctx) {
  const { dest, persons } = ctx;
  const from = ctx.originPlace; const to = destPoint(dest);
  const km = haversineKm(from, to);
  const out = [];
  const sameLand = dest.continent === ctx.originContinent;
  if (km >= 3 && km <= 2500 && sameLand) {
    const roadKm = Math.round(km * 1.25);
    const durationMin = round((roadKm / (roadKm > 150 ? 88 : 55)) * 60 + Math.floor(roadKm / 250) * 25, 5);
    const cars = Math.ceil(persons / 5);
    const fuel = round(roadKm * 2.9 * cars * (ctx.oneWay ? 1 : 2));
    const tolls = round(roadKm > 150 ? 400 + roadKm * 0.6 : 0) * cars * (ctx.oneWay ? 1 : 2);
    const depart = `${ctx.from}T08:00`;
    const leg = { mode: 'car', from: from.name, to: to.name, fromPt: pt(from), toPt: pt(to), depart, arrive: addMin(depart, durationMin), durationMin, carrier: 'Vlastní auto', number: `${roadKm} km`, distanceKm: roadKm, routable: true };
    out.push({
      id: `${provider.id}-${dest.id}-car`, providerId: provider.id, providerName: 'Autem', kind: 'transport', mode: 'car',
      title: `Autem ${from.name} → ${dest.name}`,
      subtitle: `${roadKm.toLocaleString('cs-CZ')} km · ${fmtMin(durationMin)} jízdy${roadKm > 450 ? ' · doporučená pauza' : ''}`,
      price: fuel + tolls, priceNote: `palivo ~${czk(fuel)} Kč${tolls ? ` + dálnice ~${czk(tolls)} Kč` : ''} · ${cars > 1 ? `${cars} auta` : '1 auto'}${ctx.oneWay ? '' : ' · tam i zpět'}`,
      currency: 'CZK', rating: null,
      details: ['Odjezd kdykoli', `~${fmtMin(durationMin)}`, 'Cena paliva odhadem 7 l / 100 km'],
      legs: [leg], returnLegs: ctx.oneWay ? null : [{ ...leg, from: to.name, to: from.name, fromPt: pt(to), toPt: pt(from), depart: `${ctx.to}T10:00`, arrive: addMin(`${ctx.to}T10:00`, durationMin) }],
      durationMin, changes: 0,
      deepLink: `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`, mock: false, estimate: true, own: true,
    });
  }
  if (km <= 45) {
    const walkKm = Math.round(km * 1.3 * 10) / 10;
    const durationMin = round((walkKm / 4.5) * 60, 5);
    const depart = `${ctx.from}T08:00`;
    out.push({
      id: `${provider.id}-${dest.id}-walk`, providerId: provider.id, providerName: 'Pěšky', kind: 'transport', mode: 'walk',
      title: `Pěšky ${from.name} → ${dest.name}`,
      subtitle: `${walkKm.toLocaleString('cs-CZ')} km · ${fmtMin(durationMin)} chůze${walkKm > 20 ? ' · celodenní túra' : ''}`,
      price: 0, priceNote: 'zdarma · vlastní nohy',
      currency: 'CZK', rating: null,
      details: [`~${fmtMin(durationMin)}`, 'Trasa po cestách a stezkách (OpenStreetMap)', walkKm > 15 ? 'Vezmi vodu a pevné boty' : 'Pohodová procházka'],
      legs: [{ mode: 'walk', from: from.name, to: to.name, fromPt: pt(from), toPt: pt(to), depart, arrive: addMin(depart, durationMin), durationMin, carrier: 'Pěšky', number: `${walkKm} km`, distanceKm: walkKm, routable: true }],
      returnLegs: null, durationMin, changes: 0,
      deepLink: `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=walking`, mock: false, own: true,
    });
  }
  return out;
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
  {
    id: 'own', name: 'Autem nebo pěšky', kind: 'transport', website: 'https://www.openstreetmap.org', mode: 'own',
    offers: 'Vlastní auto (palivo a dálnice odhadem) nebo pěšky, trasa z OpenStreetMap',
    link: (c) => `https://www.google.com/maps/dir/?api=1&origin=${c.originPlace.lat},${c.originPlace.lng}&destination=${c.dest.lat},${c.dest.lng}`,
    search(ctx) { return Promise.resolve(ownWayOffers(this, ctx)); },
  },
];

export const mockLodgingProviders = [
  {
    id: 'airbnb', name: 'Airbnb', kind: 'lodging', website: 'https://www.airbnb.cz', mode: 'mock',
    offers: 'Byty, domy, chaty i pokoje od hostitelů Airbnb',
    link: airbnbSearchLink,
    search(ctx) { return Promise.resolve(lodgingOffers(this, ctx, { count: 8 })); },
  },
];
