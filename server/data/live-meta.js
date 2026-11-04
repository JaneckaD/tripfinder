import { MORE } from './destinations-more.js';

// Doplňující údaje pro skutečná API:
//   cc        – ISO kód země (LiteAPI)
//   city      – anglický název města pro hledání hotelů (LiteAPI, Google Hotels)
//   cityCode  – IATA kód města pro Travelpayouts (když se liší od letiště)
//   wiki      – článek anglické Wikipedie, ze kterého se bere fotka
export const LIVE_META = {
  barcelona: { cc: 'ES', city: 'Barcelona', wiki: 'Barcelona' },
  rome: { cc: 'IT', city: 'Rome', cityCode: 'ROM', wiki: 'Colosseum' },
  paris: { cc: 'FR', city: 'Paris', cityCode: 'PAR', wiki: 'Eiffel_Tower' },
  lisbon: { cc: 'PT', city: 'Lisbon', wiki: 'Lisbon' },
  dolomites: { cc: 'IT', city: "Cortina d'Ampezzo", wiki: 'Dolomites' },
  crete: { cc: 'GR', city: 'Heraklion', wiki: 'Balos' },
  iceland: { cc: 'IS', city: 'Reykjavik', cityCode: 'REK', wiki: 'Skógafoss' },
  dubrovnik: { cc: 'HR', city: 'Dubrovnik', wiki: 'Dubrovnik' },
  amsterdam: { cc: 'NL', city: 'Amsterdam', wiki: 'Amsterdam' },
  'alps-austria': { cc: 'AT', city: 'Innsbruck', wiki: 'Innsbruck' },
  'norway-fjords': { cc: 'NO', city: 'Bergen', wiki: 'Geirangerfjord' },
  tokyo: { cc: 'JP', city: 'Tokyo', cityCode: 'TYO', wiki: 'Tokyo' },
  bali: { cc: 'ID', city: 'Ubud', wiki: 'Tegallalang' },
  bangkok: { cc: 'TH', city: 'Bangkok', wiki: 'Wat_Arun' },
  phuket: { cc: 'TH', city: 'Phuket', wiki: 'Phi_Phi_Islands' },
  vietnam: { cc: 'VN', city: 'Hanoi', wiki: 'Hạ_Long_Bay' },
  dubai: { cc: 'AE', city: 'Dubai', wiki: 'Burj_Khalifa' },
  maldives: { cc: 'MV', city: 'Male', wiki: 'Maldives' },
  nepal: { cc: 'NP', city: 'Kathmandu', wiki: 'Annapurna_Massif' },
  'sri-lanka': { cc: 'LK', city: 'Colombo', wiki: 'Sigiriya' },
  marrakech: { cc: 'MA', city: 'Marrakech', wiki: 'Jemaa_el-Fnaa' },
  'cape-town': { cc: 'ZA', city: 'Cape Town', wiki: 'Table_Mountain' },
  zanzibar: { cc: 'TZ', city: 'Zanzibar', wiki: 'Stone_Town' },
  'kenya-safari': { cc: 'KE', city: 'Nairobi', wiki: 'Maasai_Mara' },
  egypt: { cc: 'EG', city: 'Hurghada', wiki: 'Hurghada' },
  'new-york': { cc: 'US', city: 'New York', cityCode: 'NYC', wiki: 'Manhattan' },
  california: { cc: 'US', city: 'Los Angeles', wiki: 'Golden_Gate_Bridge' },
  'canada-rockies': { cc: 'CA', city: 'Banff', wiki: 'Moraine_Lake' },
  mexico: { cc: 'MX', city: 'Cancun', wiki: 'Tulum' },
  cuba: { cc: 'CU', city: 'Havana', wiki: 'Havana' },
  peru: { cc: 'PE', city: 'Cusco', wiki: 'Machu_Picchu' },
  rio: { cc: 'BR', city: 'Rio de Janeiro', cityCode: 'RIO', wiki: 'Christ_the_Redeemer_(statue)' },
  patagonia: { cc: 'AR', city: 'El Calafate', wiki: 'Torres_del_Paine_National_Park' },
  galapagos: { cc: 'EC', city: 'Puerto Ayora', wiki: 'Galápagos_Islands' },
  sydney: { cc: 'AU', city: 'Sydney', wiki: 'Sydney_Opera_House' },
  'new-zealand': { cc: 'NZ', city: 'Queenstown', wiki: 'Milford_Sound' },
  fiji: { cc: 'FJ', city: 'Nadi', wiki: 'Fiji' },
};
for (const m of MORE) LIVE_META[m[0]] = { cc: m[14], city: m[15], wiki: decodeURIComponent(m[16]), ...(m[17] ? { cityCode: m[17] } : {}) };

export const liveMeta = (dest) => ({ cityCode: dest.airport, ...(LIVE_META[dest.id] || { cc: dest.cc || '', city: dest.city || dest.name }) });
