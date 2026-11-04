// Katalog destinací. Ceny jsou orientační průměry (Kč / osoba / den bez ubytování a dopravy).
// distanceKm = přibližná vzdušná vzdálenost z Prahy (pro odhad dopravy).
import { MORE } from './destinations-more.js';

export const CONTINENTS = {
  europe: 'Evropa',
  asia: 'Asie',
  africa: 'Afrika',
  north_america: 'Severní Amerika',
  south_america: 'Jižní Amerika',
  oceania: 'Oceánie',
};

export const TAGS = {
  beach: 'Moře a pláže',
  mountains: 'Hory',
  city: 'Města',
  nature: 'Příroda',
  culture: 'Kultura a historie',
  food: 'Gastronomie',
  adventure: 'Dobrodružství',
  ski: 'Lyžování',
};

const d = (id, name, country, continent, tags, distanceKm, dailyCost, bestMonths, emoji, description, extra = {}) => ({
  id, name, country, continent, tags, distanceKm, dailyCost, bestMonths, emoji, description, ...extra,
});

export const DESTINATIONS = [
  // Evropa
  d('barcelona', 'Barcelona', 'Španělsko', 'europe', ['city', 'beach', 'culture', 'food'], 1350, 1600, [4, 5, 6, 9, 10], '🏖️',
    'Gaudího architektura, městské pláže, tapas a noční život.', { lat: 41.39, lng: 2.17, airport: 'BCN', currency: 'EUR', language: 'španělština, katalánština' }),
  d('rome', 'Řím', 'Itálie', 'europe', ['city', 'culture', 'food'], 920, 1700, [4, 5, 9, 10], '🏛️',
    'Koloseum, Vatikán, fontány a nejlepší pizza a gelato.', { lat: 41.9, lng: 12.5, airport: 'FCO', currency: 'EUR', language: 'italština' }),
  d('paris', 'Paříž', 'Francie', 'europe', ['city', 'culture', 'food'], 880, 2100, [4, 5, 6, 9], '🗼',
    'Eiffelovka, Louvre, kavárny a procházky podél Seiny.', { lat: 48.86, lng: 2.35, airport: 'CDG', currency: 'EUR', language: 'francouzština' }),
  d('lisbon', 'Lisabon', 'Portugalsko', 'europe', ['city', 'beach', 'food'], 2240, 1400, [4, 5, 6, 9, 10], '🚋',
    'Kopcovité město tramvají, fado, pastéis de nata a blízké surfařské pláže.', { lat: 38.72, lng: -9.14, airport: 'LIS', currency: 'EUR', language: 'portugalština' }),
  d('dolomites', 'Dolomity', 'Itálie', 'europe', ['mountains', 'nature', 'adventure', 'ski'], 560, 1500, [1, 2, 3, 7, 8, 9], '🏔️',
    'Dramatické vrcholy, via ferraty v létě a lyžování Sella Ronda v zimě.', { lat: 46.41, lng: 11.84, airport: 'VCE', currency: 'EUR', language: 'italština, němčina' }),
  d('crete', 'Kréta', 'Řecko', 'europe', ['beach', 'nature', 'culture'], 1900, 1200, [5, 6, 7, 8, 9, 10], '🌊',
    'Tyrkysové laguny Balos, soutěska Samaria a minojský Knossos.', { lat: 35.24, lng: 24.81, airport: 'HER', currency: 'EUR', language: 'řečtina' }),
  d('iceland', 'Island', 'Island', 'europe', ['nature', 'adventure'], 2560, 3200, [6, 7, 8, 9], '🌋',
    'Vodopády, gejzíry, ledovce, polární záře a Golden Circle.', { lat: 64.15, lng: -21.94, airport: 'KEF', currency: 'ISK', language: 'islandština' }),
  d('dubrovnik', 'Dubrovník', 'Chorvatsko', 'europe', ['beach', 'culture', 'city'], 950, 1500, [5, 6, 9], '⛵',
    'Opevněné staré město na Jadranu a výlety na ostrovy.', { lat: 42.65, lng: 18.09, airport: 'DBV', currency: 'EUR', language: 'chorvatština' }),
  d('amsterdam', 'Amsterdam', 'Nizozemsko', 'europe', ['city', 'culture'], 710, 2000, [4, 5, 6, 9], '🚲',
    'Kanály, kola, muzea Van Gogha a Rijksmuseum.', { lat: 52.37, lng: 4.9, airport: 'AMS', currency: 'EUR', language: 'nizozemština' }),
  d('alps-austria', 'Rakouské Alpy (Tyrolsko)', 'Rakousko', 'europe', ['mountains', 'ski', 'nature'], 400, 1600, [1, 2, 3, 7, 8, 12], '⛷️',
    'Lyžařské areály, horská jezera a túry kousek od Česka.', { lat: 47.26, lng: 11.39, airport: 'INN', currency: 'EUR', language: 'němčina' }),
  d('norway-fjords', 'Norské fjordy', 'Norsko', 'europe', ['nature', 'adventure', 'mountains'], 1100, 2900, [6, 7, 8], '🛶',
    'Preikestolen, Geirangerfjord a nekonečné letní dny.', { lat: 60.39, lng: 5.32, airport: 'BGO', currency: 'NOK', language: 'norština' }),

  // Asie
  d('tokyo', 'Tokio', 'Japonsko', 'asia', ['city', 'culture', 'food'], 9100, 2200, [3, 4, 10, 11], '🗾',
    'Neonové čtvrti, chrámy, sushi a v dubnu kvetoucí sakury.', { lat: 35.68, lng: 139.69, airport: 'HND', currency: 'JPY', language: 'japonština' }),
  d('bali', 'Bali', 'Indonésie', 'asia', ['beach', 'nature', 'culture'], 11200, 900, [5, 6, 7, 8, 9], '🌴',
    'Rýžové terasy, chrámy, surfování a jóga v Ubudu.', { lat: -8.34, lng: 115.09, airport: 'DPS', currency: 'IDR', language: 'indonéština' }),
  d('bangkok', 'Bangkok', 'Thajsko', 'asia', ['city', 'food', 'culture'], 8550, 900, [11, 12, 1, 2], '🛕',
    'Pouliční jídlo, chrámy Wat Pho a Wat Arun, plovoucí trhy.', { lat: 13.76, lng: 100.5, airport: 'BKK', currency: 'THB', language: 'thajština' }),
  d('phuket', 'Phuket a Krabi', 'Thajsko', 'asia', ['beach', 'nature', 'adventure'], 9200, 1100, [11, 12, 1, 2, 3, 4], '🏝️',
    'Vápencové skály, ostrovy Phi Phi a šnorchlování.', { lat: 7.88, lng: 98.39, airport: 'HKT', currency: 'THB', language: 'thajština' }),
  d('vietnam', 'Vietnam (Hanoj a Ha Long)', 'Vietnam', 'asia', ['nature', 'food', 'culture', 'adventure'], 8500, 800, [3, 4, 10, 11], '🍜',
    'Zátoka Ha Long, rýžová pole Sapy a phở na každém rohu.', { lat: 21.03, lng: 105.85, airport: 'HAN', currency: 'VND', language: 'vietnamština' }),
  d('dubai', 'Dubaj', 'Spojené arabské emiráty', 'asia', ['city', 'beach'], 4500, 2600, [11, 12, 1, 2, 3], '🏙️',
    'Burdž Chalífa, poušť, nákupní centra a pláže celoročně.', { lat: 25.2, lng: 55.27, airport: 'DXB', currency: 'AED', language: 'arabština' }),
  d('maldives', 'Maledivy', 'Maledivy', 'asia', ['beach', 'nature'], 7300, 3500, [12, 1, 2, 3, 4], '🐠',
    'Vily nad vodou, korálové útesy a bílý písek.', { lat: 3.2, lng: 73.22, airport: 'MLE', currency: 'USD', language: 'divehi' }),
  d('nepal', 'Nepál (Himálaj)', 'Nepál', 'asia', ['mountains', 'adventure', 'culture'], 6400, 700, [3, 4, 10, 11], '🏔️',
    'Trek k Everestu nebo Annapurně, Káthmándú a buddhistické kláštery.', { lat: 27.72, lng: 85.32, airport: 'KTM', currency: 'NPR', language: 'nepálština' }),
  d('sri-lanka', 'Srí Lanka', 'Srí Lanka', 'asia', ['beach', 'nature', 'culture'], 7700, 900, [12, 1, 2, 3, 4], '🐘',
    'Čajové plantáže, safari se slony, Sigiriya a pláže na jihu.', { lat: 7.87, lng: 80.77, airport: 'CMB', currency: 'LKR', language: 'sinhálština, tamilština' }),

  // Afrika
  d('marrakech', 'Marrákeš', 'Maroko', 'africa', ['city', 'culture', 'food'], 2700, 1000, [3, 4, 5, 10, 11], '🕌',
    'Súky, riady, náměstí Džamá al-Fná a výlety do Sahary.', { lat: 31.63, lng: -7.99, airport: 'RAK', currency: 'MAD', language: 'arabština, francouzština' }),
  d('cape-town', 'Kapské Město', 'Jihoafrická republika', 'africa', ['city', 'nature', 'beach', 'adventure'], 9300, 1300, [11, 12, 1, 2, 3], '🐧',
    'Stolová hora, mys Dobré naděje, tučňáci a vinařství.', { lat: -33.92, lng: 18.42, airport: 'CPT', currency: 'ZAR', language: 'angličtina, afrikánština' }),
  d('zanzibar', 'Zanzibar', 'Tanzanie', 'africa', ['beach', 'culture'], 6900, 1100, [6, 7, 8, 9, 12, 1, 2], '🏝️',
    'Stone Town, plantáže koření a tyrkysový Indický oceán.', { lat: -6.16, lng: 39.19, airport: 'ZNZ', currency: 'TZS', language: 'svahilština' }),
  d('kenya-safari', 'Keňa – safari Masai Mara', 'Keňa', 'africa', ['nature', 'adventure'], 6200, 2500, [7, 8, 9, 10], '🦁',
    'Velká migrace pakoní, lvi, sloni a západy slunce v savaně.', { lat: -1.29, lng: 36.82, airport: 'NBO', currency: 'KES', language: 'svahilština, angličtina' }),
  d('egypt', 'Egypt (Hurghada a Luxor)', 'Egypt', 'africa', ['beach', 'culture'], 2800, 900, [10, 11, 12, 1, 2, 3, 4], '🐪',
    'Rudé moře, potápění, pyramidy a chrámy v Luxoru.', { lat: 27.26, lng: 33.81, airport: 'HRG', currency: 'EGP', language: 'arabština' }),

  // Severní Amerika
  d('new-york', 'New York', 'USA', 'north_america', ['city', 'culture', 'food'], 6600, 3000, [4, 5, 6, 9, 10, 12], '🗽',
    'Manhattan, Central Park, Broadway a muzea světové třídy.', { lat: 40.71, lng: -74.0, airport: 'JFK', currency: 'USD', language: 'angličtina' }),
  d('california', 'Kalifornie (LA – San Francisco)', 'USA', 'north_america', ['city', 'beach', 'nature'], 9500, 3000, [4, 5, 6, 9, 10], '🌉',
    'Pacific Coast Highway, Yosemite, Golden Gate a Hollywood.', { lat: 34.05, lng: -118.24, airport: 'LAX', currency: 'USD', language: 'angličtina' }),
  d('canada-rockies', 'Kanadské Skalisté hory', 'Kanada', 'north_america', ['mountains', 'nature', 'adventure', 'ski'], 7900, 2600, [1, 2, 6, 7, 8, 9], '🦌',
    'Banff, Jasper, jezero Louise a medvědi grizzly.', { lat: 51.18, lng: -115.57, airport: 'YYC', currency: 'CAD', language: 'angličtina' }),
  d('mexico', 'Mexiko (Yucatán)', 'Mexiko', 'north_america', ['beach', 'culture', 'food'], 9400, 1400, [11, 12, 1, 2, 3, 4], '🌮',
    'Mayské pyramidy, cenoty, Tulum a karibské pláže.', { lat: 21.16, lng: -86.85, airport: 'CUN', currency: 'MXN', language: 'španělština' }),
  d('cuba', 'Kuba', 'Kuba', 'north_america', ['beach', 'culture'], 8300, 1100, [12, 1, 2, 3, 4], '🚗',
    'Veteráni v Havaně, salsa, doutníky a pláže Varadera.', { lat: 23.11, lng: -82.37, airport: 'HAV', currency: 'CUP', language: 'španělština' }),

  // Jižní Amerika
  d('peru', 'Peru (Machu Picchu)', 'Peru', 'south_america', ['mountains', 'culture', 'adventure'], 10900, 1200, [5, 6, 7, 8, 9], '🦙',
    'Inka Trail, Cusco, Duhová hora a jezero Titicaca.', { lat: -13.53, lng: -71.97, airport: 'CUZ', currency: 'PEN', language: 'španělština, kečuánština' }),
  d('rio', 'Rio de Janeiro', 'Brazílie', 'south_america', ['city', 'beach', 'nature'], 9900, 1500, [12, 1, 2, 3], '🎭',
    'Copacabana, socha Krista Spasitele, karneval a samba.', { lat: -22.91, lng: -43.17, airport: 'GIG', currency: 'BRL', language: 'portugalština' }),
  d('patagonia', 'Patagonie', 'Argentina / Chile', 'south_america', ['nature', 'mountains', 'adventure'], 13300, 2000, [11, 12, 1, 2, 3], '🧊',
    'Torres del Paine, ledovec Perito Moreno a Fitz Roy.', { lat: -50.34, lng: -72.26, airport: 'FTE', currency: 'ARS', language: 'španělština' }),
  d('galapagos', 'Galapágy', 'Ekvádor', 'south_america', ['nature', 'beach', 'adventure'], 11000, 3200, [1, 2, 3, 4, 5, 6], '🐢',
    'Obří želvy, leguáni, lachtani a šnorchlování s žraloky.', { lat: -0.74, lng: -90.31, airport: 'GPS', currency: 'USD', language: 'španělština' }),

  // Oceánie
  d('sydney', 'Sydney', 'Austrálie', 'oceania', ['city', 'beach'], 16100, 2500, [10, 11, 12, 1, 2, 3, 4], '🦘',
    'Opera, Harbour Bridge, pláž Bondi a Modré hory.', { lat: -33.87, lng: 151.21, airport: 'SYD', currency: 'AUD', language: 'angličtina' }),
  d('new-zealand', 'Nový Zéland', 'Nový Zéland', 'oceania', ['nature', 'adventure', 'mountains'], 18000, 2400, [11, 12, 1, 2, 3], '🥝',
    'Milford Sound, Hobití vesnička, bungee v Queenstownu.', { lat: -45.03, lng: 168.66, airport: 'ZQN', currency: 'NZD', language: 'angličtina, maorština' }),
  d('fiji', 'Fidži', 'Fidži', 'oceania', ['beach', 'nature'], 16300, 2300, [5, 6, 7, 8, 9, 10], '🌺',
    'Korálové ostrovy, potápění a pohostinnost „Bula!“.', { lat: -17.71, lng: 178.07, airport: 'NAN', currency: 'FJD', language: 'angličtina, fidžijština' }),
];

// Vzdušná vzdálenost z Prahy (km)
const fromPrague = (lat, lng) => {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(lat - 50.08) / 2) ** 2 + Math.cos(r(50.08)) * Math.cos(r(lat)) * Math.sin(r(lng - 14.43) / 2) ** 2;
  return Math.round(12742 * Math.asin(Math.sqrt(h)));
};
for (const [id, name, country, continent, tags, dailyCost, months, emoji, desc, lat, lng, airport, currency, language] of MORE) {
  DESTINATIONS.push(d(id, name, country, continent, tags, fromPrague(lat, lng), dailyCost, months, emoji, desc, { lat, lng, airport, currency, language }));
}

export function findDestination(id) {
  return DESTINATIONS.find((x) => x.id === id) || null;
}

export function searchDestinations({ continent, q, tags, maxBudget, persons = 2, nights = 7, month, sort = 'recommended' } = {}) {
  const tagList = Array.isArray(tags) ? tags : tags ? String(tags).split(',').filter(Boolean) : [];
  const query = (q || '').trim().toLowerCase();
  let list = DESTINATIONS.map((dest) => ({ ...dest, estimate: estimateTripCost(dest, { persons, nights }) }));

  if (continent && continent !== 'world') list = list.filter((x) => x.continent === continent);
  if (query) {
    list = list.filter((x) =>
      [x.name, x.country, x.description, CONTINENTS[x.continent]].some((s) => s.toLowerCase().includes(query)));
  }
  if (tagList.length) list = list.filter((x) => tagList.every((t) => x.tags.includes(t)));
  if (month) list = list.filter((x) => x.bestMonths.includes(Number(month)));
  if (maxBudget) list = list.filter((x) => x.estimate.perPerson <= Number(maxBudget));

  const sorters = {
    price: (a, b) => a.estimate.total - b.estimate.total,
    distance: (a, b) => a.distanceKm - b.distanceKm,
    name: (a, b) => a.name.localeCompare(b.name, 'cs'),
    recommended: (a, b) => b.tags.length - a.tags.length || a.estimate.total - b.estimate.total,
  };
  list.sort(sorters[sort] || sorters.recommended);
  return list;
}

// Hrubý odhad ceny celého výletu (Kč) – doprava + ubytování + denní útrata.
export function estimateTripCost(dest, { persons = 2, nights = 7 } = {}) {
  persons = Math.max(1, Number(persons) || 1);
  nights = Math.max(1, Number(nights) || 1);
  const transportPerPerson = Math.round(800 + dest.distanceKm * 1.6);
  const lodgingPerNightRoom = Math.round(600 + dest.dailyCost * 0.9);
  const rooms = Math.ceil(persons / 2);
  const total = transportPerPerson * persons + lodgingPerNightRoom * rooms * nights + dest.dailyCost * persons * nights;
  return { total: Math.round(total), perPerson: Math.round(total / persons), currency: 'CZK', persons, nights };
}
