// Doplňkové bezplatné služby bez klíče: fotky destinací (Wikipedie) a předpověď počasí (Open-Meteo).
import { getJson, makeCache } from './providers/live/common.js';
import { LIVE_META } from './data/live-meta.js';

const UA = { 'User-Agent': 'TripFinder/0.1 (https://github.com/JaneckaD/tripfinder)' };
const DAY = 86400000;

// Kód počasí WMO -> emoji + popis
const WEATHER = [
  [[0], '☀️', 'Jasno'], [[1, 2], '🌤️', 'Polojasno'], [[3], '☁️', 'Zataženo'], [[45, 48], '🌫️', 'Mlha'],
  [[51, 53, 55, 56, 57], '🌦️', 'Mrholení'], [[61, 63, 65, 66, 67, 80, 81, 82], '🌧️', 'Déšť'],
  [[71, 73, 75, 77, 85, 86], '🌨️', 'Sníh'], [[95, 96, 99], '⛈️', 'Bouřky'],
];
const describe = (code) => {
  const hit = WEATHER.find(([codes]) => codes.includes(code));
  return hit ? { icon: hit[1], text: hit[2] } : { icon: '🌡️', text: '' };
};

export function createExtras(db) {
  const cached = makeCache(db);
  return {
    async photo(dest) {
      const title = LIVE_META[dest.id]?.wiki || dest.name;
      return cached(`photo:${title}`, 30 * DAY, async () => {
        const res = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers: UA });
        const thumb = res.thumbnail?.source;
        // Zvětšení náhledu Wikimedie na 1280 px (originál bývá obrovský).
        const url = thumb && /\/\d+px-/.test(thumb) ? thumb.replace(/\/\d+px-/, '/1280px-') : res.originalimage?.source || thumb;
        return url ? { url, credit: 'Wikimedia Commons', page: res.content_urls?.desktop?.page } : null;
      });
    },
    async weather(dest) {
      return cached(`weather:${dest.id}`, 3 * 3600000, async () => {
        const res = await getJson(`https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
          latitude: dest.lat, longitude: dest.lng, daily: 'weather_code,temperature_2m_max,temperature_2m_min',
          current: 'temperature_2m,weather_code', timezone: 'auto', forecast_days: '5',
        })}`);
        const d = res.daily || {};
        return {
          current: res.current ? { temp: Math.round(res.current.temperature_2m), ...describe(res.current.weather_code) } : null,
          utcOffsetSeconds: res.utc_offset_seconds ?? null,
          days: (d.time || []).map((date, i) => ({
            date, max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]), ...describe(d.weather_code[i]),
          })),
        };
      });
    },
  };
}
