// Prozkoumat: zajímavá místa v okolí (Wikipedie – geosearch s fotkami) a trasy pěšky / autem (OSRM).
import { getJson } from './providers/live/common.js';
import { haversineKm } from './geo.js';

const UA = { 'User-Agent': 'TripFinder/0.1 (https://github.com/JaneckaD/tripfinder)' };
const DAY = 86400000;

const CATEGORIES = [
  ['nature', /\b(hora|vrch|vrchol|kopec|štít|jezero|rybník|vodopád|národní park|přírodní|rezervace|údolí|soutěsk|kaňon|řeka|potok|jeskyně|pláž|ostrov|ledovec|les|skal|sopk|mountain|peak|lake|waterfall|falls|national park|nature|reserve|valley|gorge|canyon|river|cave|beach|island|glacier|forest|volcano|hill|cliff|bay|lagoon|park)\w*/i],
  ['sight', /\b(hrad|zámek|zřícenin|kostel|katedrál|bazilik|klášter|chrám|synagog|mešit|rozhledn|věž|most|památník|pomník|náměstí|palác|castle|palace|church|cathedral|basilica|abbey|monastery|temple|mosque|synagogue|tower|bridge|monument|memorial|square|fortress|fort|ruins|lighthouse)\w*/i],
  ['culture', /\b(muze|galeri|divadl|opera|knihovn|zoo|botanick|museum|gallery|theatre|theater|library|zoo|botanical|aquarium|stadium|stadion)\w*/i],
];
export const classify = (text) => CATEGORIES.find(([, re]) => re.test(text))?.[0] || 'other';

async function geosearch(lang, lat, lng, radius) {
  const res = await getJson(`https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', generator: 'geosearch', ggscoord: `${lat}|${lng}`, ggsradius: String(radius), ggslimit: '60',
    prop: 'coordinates|pageimages|description', piprop: 'thumbnail', pithumbsize: '320', pilimit: '60',
  })}`, { headers: UA, timeoutMs: 10000 });
  return (res.query?.pages || []).filter((p) => p.coordinates?.[0]).map((p) => ({
    id: `${lang}:${p.pageid}`, lang, title: p.title, description: p.description || '',
    lat: p.coordinates[0].lat, lng: p.coordinates[0].lon, thumb: p.thumbnail?.source || null,
    category: classify(`${p.title} ${p.description || ''}`),
  }));
}

export function createExplore({ cached }) {
  return {
    // Místa s fotkou v okruhu do 10 km (česká + anglická Wikipedie, bez duplicit).
    async nearby(lat, lng, radius = 10000) {
      const la = Math.round(lat * 50) / 50; const ln = Math.round(lng * 50) / 50; // mřížka ~2 km kvůli mezipaměti
      const r = Math.min(10000, Math.max(1000, Math.round(radius / 1000) * 1000));
      return cached(`explore:${la},${ln}:${r}`, 7 * DAY, async () => {
        const [cs, en] = await Promise.allSettled([geosearch('cs', la, ln, r), geosearch('en', la, ln, r)]);
        if (cs.status === 'rejected' && en.status === 'rejected') throw cs.reason;
        const out = [];
        for (const p of [...(cs.value || []), ...(en.value || [])]) {
          if (out.some((q) => haversineKm(q, p) < 0.08 || q.title === p.title)) continue;
          out.push(p);
        }
        // Místa s fotkou napřed, příroda a památky mají přednost.
        const score = (p) => (p.thumb ? 0 : 10) + { nature: 0, sight: 1, culture: 2, other: 4 }[p.category];
        return out.sort((a, b) => score(a) - score(b)).slice(0, 70);
      });
    },
    async place(lang, title) {
      const l = ['cs', 'en'].includes(lang) ? lang : 'en';
      return cached(`wiki-summary:${l}:${title}`, 30 * DAY, async () => {
        const res = await getJson(`https://${l}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers: UA });
        const big = res.thumbnail?.source && /\/\d+px-/.test(res.thumbnail.source) ? res.thumbnail.source.replace(/\/\d+px-/, '/960px-') : res.originalimage?.source;
        return {
          title: res.title, description: res.description || '', extract: res.extract || '', image: big || null,
          url: res.content_urls?.desktop?.page || null, lat: res.coordinates?.lat, lng: res.coordinates?.lon,
          category: classify(`${res.title} ${res.description || ''}`),
        };
      });
    },
  };
}

// ---------- Trasy (OSRM na routing.openstreetmap.de) ----------
const TURN = { left: 'doleva', right: 'doprava', 'slight left': 'mírně doleva', 'slight right': 'mírně doprava', 'sharp left': 'ostře doleva', 'sharp right': 'ostře doprava', straight: 'rovně', uturn: 'otočte se' };
function stepText(s) {
  const m = s.maneuver || {}; const road = s.name ? ` na ${s.name}` : '';
  switch (m.type) {
    case 'depart': return `Vyrazte${road}`;
    case 'arrive': return 'Jste v cíli';
    case 'roundabout': case 'rotary': return `Na kruhovém objezdu ${m.exit ? `${m.exit}. výjezdem` : 'pokračujte'}${road}`;
    case 'merge': return `Připojte se${road}`;
    case 'on ramp': return `Najeďte${road}`;
    case 'off ramp': return `Sjeďte ${TURN[m.modifier] || ''}${road}`.replace('  ', ' ');
    case 'fork': return `Na rozcestí ${TURN[m.modifier] || 'pokračujte'}${road}`;
    case 'end of road': return `Na konci cesty ${TURN[m.modifier] || ''}${road}`;
    case 'continue': case 'new name': return `Pokračujte ${TURN[m.modifier] || 'rovně'}${road}`;
    default: return `Odbočte ${TURN[m.modifier] || ''}${road}`.replace('  ', ' ');
  }
}
function simplify(coords, max = 500) {
  if (coords.length <= max) return coords;
  const step = Math.ceil(coords.length / max);
  return coords.filter((_, i) => i % step === 0 || i === coords.length - 1);
}

export function createDirections({ cached }) {
  return async function directions(from, to, mode) {
    const profile = mode === 'foot' ? 'foot' : 'car';
    const straight = haversineKm(from, to);
    if (profile === 'foot' && straight > 120) throw Object.assign(new Error('Pěšky je to příliš daleko (přes 120 km).'), { status: 400 });
    if (straight > 4000) throw Object.assign(new Error('Na tuhle vzdálenost se po silnici nedá navigovat.'), { status: 400 });
    const key = `osrm:${profile}:${from.lat.toFixed(4)},${from.lng.toFixed(4)}:${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
    try {
      return await cached(key, 7 * DAY, async () => {
        const res = await getJson(`https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`, { headers: UA, timeoutMs: 15000 });
        const r = res.routes?.[0];
        if (!r) throw new Error('Trasa nenalezena.');
        const steps = (r.legs?.[0]?.steps || []).filter((s) => s.distance > 0 || s.maneuver?.type === 'arrive')
          .map((s) => ({ text: stepText(s), distanceM: Math.round(s.distance), durationMin: Math.round(s.duration / 60) }));
        return {
          mode: profile, approx: false, distanceKm: Math.round(r.distance / 100) / 10,
          // OSRM chodec počítá 5 km/h; do hor je to optimistické, tak přidáme 15 %.
          durationMin: Math.round((r.duration / 60) * (profile === 'foot' ? 1.15 : 1)),
          geometry: simplify(r.geometry.coordinates.map(([x, y]) => [Math.round(y * 1e5) / 1e5, Math.round(x * 1e5) / 1e5])),
          steps: steps.slice(0, 80),
        };
      });
    } catch (e) {
      // Služba nedostupná – hrubý odhad po přímce.
      const km = Math.round(straight * (profile === 'foot' ? 1.3 : 1.25) * 10) / 10;
      return {
        mode: profile, approx: true, distanceKm: km,
        durationMin: Math.round((km / (profile === 'foot' ? 4.5 : km > 150 ? 85 : 55)) * 60),
        geometry: [[from.lat, from.lng], [to.lat, to.lng]], steps: [], note: String(e.message || e),
      };
    }
  };
}
