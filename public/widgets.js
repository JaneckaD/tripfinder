// Ovládací prvky TripFinderu: našeptávač míst, grafický kalendář, výběr cestujících,
// mapa (Leaflet + CARTO Voyager) a razítka do cestovatelského pasu.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Popover (kalendář, cestující) ----------
let openPop = null;
export function closePopover() {
  if (!openPop) return;
  openPop.el.remove();
  document.removeEventListener('pointerdown', openPop.outside, true);
  document.removeEventListener('keydown', openPop.key);
  window.removeEventListener('resize', openPop.place);
  openPop.onClose?.();
  openPop = null;
}
export function popover(anchor, html, { className = '', onClose } = {}) {
  closePopover();
  const el = document.createElement('div');
  el.className = `popover ${className}`;
  el.innerHTML = html;
  document.body.appendChild(el);
  const place = () => {
    if (window.innerWidth < 640) { el.classList.add('sheet'); el.style.cssText = ''; return; }
    el.classList.remove('sheet');
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
    el.style.left = `${left + window.scrollX}px`;
    el.style.top = `${r.bottom + window.scrollY + 10}px`;
  };
  const outside = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) closePopover(); };
  const key = (e) => { if (e.key === 'Escape') closePopover(); };
  openPop = { el, outside, key, place, onClose };
  place();
  setTimeout(() => document.addEventListener('pointerdown', outside, true));
  document.addEventListener('keydown', key);
  window.addEventListener('resize', place);
  return el;
}

// ---------- Našeptávač míst ----------
const KIND_ICON = { catalog: 'location_on', city: 'location_city', address: 'home', place: 'location_on', airport: 'flight', recent: 'history', me: 'my_location' };
// Obrysová ikona (Material Symbols Outlined)
export const ms = (name, cls = '') => `<span class="ms${cls ? ` ${cls}` : ''}" aria-hidden="true">${name}</span>`;
export const POPULAR_ORIGINS = [
  { id: 'PRG', name: 'Praha', detail: 'Letiště Václava Havla', airport: 'PRG', kind: 'airport' },
  { id: 'BRQ', name: 'Brno', detail: 'Letiště Brno-Tuřany', airport: 'BRQ', kind: 'airport' },
  { id: 'OSR', name: 'Ostrava', detail: 'Letiště Leoše Janáčka', airport: 'OSR', kind: 'airport' },
  { id: 'VIE', name: 'Vídeň', detail: 'Rakousko', airport: 'VIE', kind: 'airport' },
  { id: 'BTS', name: 'Bratislava', detail: 'Slovensko', airport: 'BTS', kind: 'airport' },
  { id: 'KTW', name: 'Katovice', detail: 'Polsko', airport: 'KTW', kind: 'airport' },
  { id: 'MUC', name: 'Mnichov', detail: 'Německo', airport: 'MUC', kind: 'airport' },
  { id: 'BER', name: 'Berlín', detail: 'Německo', airport: 'BER', kind: 'airport' },
];

export function autocomplete(input, { onSelect, suggestions = () => [], minChars = 2 } = {}) {
  const wrap = input.closest('.ac-wrap') || input.parentElement;
  wrap.classList.add('ac-wrap');
  const list = document.createElement('div');
  list.className = 'ac-list';
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  wrap.appendChild(list);
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  let items = []; let active = -1; let timer = 0; let seq = 0;

  const render = (results, note = '') => {
    items = results;
    active = results.length ? 0 : -1;
    if (!results.length && !note) { list.hidden = true; return; }
    list.innerHTML = results.map((r, i) => `
      <button type="button" class="ac-item${i === active ? ' active' : ''}" data-i="${i}" role="option">
        <span class="ac-ico">${ms(r.icon || KIND_ICON[r.kind] || 'location_on')}</span>
        <span class="ac-text"><b>${esc(r.name)}</b><small>${esc(r.detail || '')}</small></span>
        ${r.airport ? `<span class="ac-code">${esc(r.airport)}</span>` : ''}
      </button>`).join('') + (note ? `<div class="ac-note">${note}</div>` : '');
    list.hidden = false;
  };
  const highlight = () => list.querySelectorAll('.ac-item').forEach((b, i) => b.classList.toggle('active', i === active));
  const choose = (i) => {
    const r = items[i];
    if (!r) return;
    input.value = r.name;
    list.hidden = true;
    onSelect?.(r);
  };
  const search = async () => {
    const q = input.value.trim();
    if (q.length < minChars) { render(suggestions(), ''); return; }
    const my = ++seq;
    list.hidden = false;
    list.innerHTML = '<div class="ac-note">Hledám po celém světě…</div>';
    try {
      const res = await fetch(`/api/places?${new URLSearchParams({ q })}`).then((r) => r.json());
      if (my !== seq) return;
      render(res.results || [], res.results?.length ? '' : 'Nic jsme nenašli. Zkus město, ulici nebo památku.');
    } catch { if (my === seq) render([], 'Našeptávač je teď nedostupný.'); }
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 220); });
  input.addEventListener('focus', () => { if (input.value.trim().length < minChars) render(suggestions()); else if (input.dataset.dirty) search(); });
  input.addEventListener('input', () => { input.dataset.dirty = '1'; });
  input.addEventListener('keydown', (e) => {
    if (list.hidden || !items.length) return;
    if (e.key === 'ArrowDown') { active = (active + 1) % items.length; highlight(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = (active - 1 + items.length) % items.length; highlight(); e.preventDefault(); }
    else if (e.key === 'Enter' && active >= 0 && input.dataset.dirty) { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') list.hidden = true;
  });
  list.addEventListener('pointerdown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) choose(Number(b.dataset.i)); });
  input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 120));
}

// ---------- Grafický kalendář ----------
const MONTHS_CS = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const nightsBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
export const shortDate = (s) => (s ? parse(s).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' }) : '');

export function calendar(anchor, { from, to, single = false, onChange, title } = {}) {
  let a = from || null; let b = single ? null : to || null; let hover = null;
  const today = parse(iso(new Date()));
  let view = new Date((a ? parse(a) : today).getFullYear(), (a ? parse(a) : today).getMonth(), 1);
  const el = popover(anchor, '', { className: 'cal-pop' });
  const months = () => (window.innerWidth < 760 ? 1 : 2);

  const monthHtml = (m) => {
    const first = new Date(m.getFullYear(), m.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // pondělí první
    const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const end = b || (a && hover && hover > a ? hover : null);
    let cells = '<span></span>'.repeat(offset);
    for (let d = 1; d <= days; d++) {
      const date = iso(new Date(m.getFullYear(), m.getMonth(), d));
      const past = parse(date) < today;
      const cls = [
        past && 'past', date === iso(today) && 'today',
        date === a && 'start', end && date === end && 'end',
        a && end && date > a && date < end && 'in',
        !single && a && end && 'ranged',
      ].filter(Boolean).join(' ');
      cells += `<button type="button" class="${cls}" data-d="${date}" ${past ? 'disabled' : ''}>${d}</button>`;
    }
    return `<div class="cal-month"><h4>${MONTHS_CS[m.getMonth()]} ${m.getFullYear()}</h4>
      <div class="cal-dow"><span>Po</span><span>Út</span><span>St</span><span>Čt</span><span>Pá</span><span>So</span><span>Ne</span></div>
      <div class="cal-days">${cells}</div></div>`;
  };
  const label = () => {
    if (single) return a ? `Odjezd ${shortDate(a)}` : 'Vyber den odjezdu';
    if (a && b) { const n = nightsBetween(a, b); return `${shortDate(a)} – ${shortDate(b)} · ${n} ${n === 1 ? 'noc' : n < 5 ? 'noci' : 'nocí'}`; }
    return a ? 'Teď vyber den návratu' : 'Vyber den odjezdu';
  };
  const render = () => {
    const list = Array.from({ length: months() }, (_, i) => new Date(view.getFullYear(), view.getMonth() + i, 1));
    const canPrev = view > new Date(today.getFullYear(), today.getMonth(), 1);
    el.innerHTML = `
      <div class="cal-head">
        <button type="button" class="cal-nav" data-nav="-1" ${canPrev ? '' : 'disabled'} aria-label="Předchozí měsíc">‹</button>
        <div class="cal-title"><span class="eyebrow">${esc(title || (single ? 'Datum' : 'Termín cesty'))}</span><b>${label()}</b></div>
        <button type="button" class="cal-nav" data-nav="1" aria-label="Další měsíc">›</button>
      </div>
      <div class="cal-months">${list.map(monthHtml).join('')}</div>
      ${single ? '' : `<div class="cal-quick">${[['Víkend', 2], ['Týden', 7], ['10 dní', 10], ['14 dní', 14]].map(([l, n]) => `<button type="button" class="chip" data-n="${n}">${l}</button>`).join('')}
        <span class="grow"></span><button type="button" class="btn sm" data-done ${a && b ? '' : 'disabled'}>Hotovo</button></div>`}`;
  };
  render();
  el.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) { view = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.nav), 1); render(); return; }
    const n = e.target.closest('[data-n]');
    if (n) {
      const start = a ? parse(a) : new Date(today.getTime() + 14 * 86400000);
      a = iso(start); b = iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + Number(n.dataset.n)));
      render(); return;
    }
    if (e.target.closest('[data-done]')) { onChange?.({ from: a, to: b }); closePopover(); return; }
    const day = e.target.closest('[data-d]');
    if (!day) return;
    const d = day.dataset.d;
    if (single) { a = d; onChange?.({ from: a }); closePopover(); return; }
    if (!a || b || d <= a) { a = d; b = null; } else { b = d; onChange?.({ from: a, to: b }); }
    render();
  });
  // Náhled rozsahu při najetí myší – jen přepíná třídy, DOM se nepřekresluje (klik by se ztratil)
  el.addEventListener('mouseover', (e) => {
    const day = e.target.closest('[data-d]');
    if (single || !a || b || !day || day.dataset.d === hover) return;
    hover = day.dataset.d;
    el.querySelectorAll('[data-d]').forEach((x) => {
      const d = x.dataset.d;
      x.classList.toggle('in', hover > a && d > a && d < hover);
      x.classList.toggle('end', hover > a && d === hover);
      x.classList.toggle('ranged', hover > a && d === a);
    });
  });
}

// ---------- Cestující ----------
export function guestsPicker(anchor, { adults = 2, children = 0, onChange }) {
  const el = popover(anchor, '', { className: 'guests-pop' });
  const row = (key, label, hint, val, min) => `<div class="stepper-row"><div><b>${label}</b><small>${hint}</small></div>
    <div class="stepper"><button type="button" data-k="${key}" data-d="-1" ${val <= min ? 'disabled' : ''} aria-label="Ubrat">−</button><span>${val}</span><button type="button" data-k="${key}" data-d="1" ${adults + children >= 20 ? 'disabled' : ''} aria-label="Přidat">+</button></div></div>`;
  const render = () => {
    el.innerHTML = `${row('adults', 'Dospělí', '13 let a více', adults, 1)}${row('children', 'Děti', '2–12 let', children, 0)}
      <button type="button" class="btn sm" data-done style="width:100%;margin-top:6px">Hotovo</button>`;
  };
  render();
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-done]')) { closePopover(); return; }
    const b = e.target.closest('[data-k]');
    if (!b) return;
    if (b.dataset.k === 'adults') adults = Math.max(1, adults + Number(b.dataset.d)); else children = Math.max(0, children + Number(b.dataset.d));
    render();
    onChange?.({ adults, children });
  });
}

// ---------- Mapa ----------
let leafletPromise = null;
// Leaflet + (když to prohlížeč zvládne) vektorová mapa MapLibre: hladké přibližování a barevný styl jako Apple Mapy.
const webglOK = () => { try { const c = document.createElement('canvas'); return Boolean(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };
const addScript = (src) => new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s); });
const addCss = (href) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); };
function loadGL() {
  if (!webglOK()) return Promise.resolve(false);
  return Promise.race([
    (async () => {
      addCss('/vendor/maplibre/maplibre-gl.css');
      await addScript('/vendor/maplibre/maplibre-gl.js');
      await addScript('/vendor/maplibre-leaflet/leaflet-maplibre-gl.js');
      return Boolean(window.maplibregl && window.L?.maplibreGL);
    })().catch(() => false),
    new Promise((r) => setTimeout(() => r(false), 8000)),
  ]);
}
export function loadLeaflet() {
  if (window.L && leafletPromise) return leafletPromise;
  leafletPromise ||= (async () => {
    if (!window.L) { addCss('/vendor/leaflet/leaflet.css'); await addScript('/vendor/leaflet/leaflet.js'); }
    window.L._tfGL = await loadGL();
    return window.L;
  })();
  return leafletPromise;
}

export const MODE_STYLE = {
  flight: { color: '#0a84ff', dash: '2 9', weight: 3, icon: 'flight', label: 'Let' },
  train: { color: '#ff9f0a', dash: null, weight: 4, icon: 'train', label: 'Vlak' },
  bus: { color: '#30d158', dash: '10 7', weight: 4, icon: 'directions_bus', label: 'Autobus' },
  car: { color: '#5e5ce6', dash: null, weight: 4, icon: 'directions_car', label: 'Autem' },
  ferry: { color: '#64d2ff', dash: '8 8', weight: 4, icon: 'directions_boat', label: 'Loď' },
  walk: { color: '#8e8e93', dash: '1 7', weight: 4, icon: 'directions_walk', label: 'Pěšky' },
};

// Zakřivený oblouk (pro lety) – kvadratická Bézierova křivka.
function arc(a, b) {
  const [lat1, lng1] = a; let [lat2, lng2] = b;
  if (Math.abs(lng2 - lng1) > 180) lng2 += lng2 > lng1 ? -360 : 360;
  const mx = (lat1 + lat2) / 2; const my = (lng1 + lng2) / 2;
  const dx = lat2 - lat1; const dy = lng2 - lng1;
  const k = 0.18;
  const cx = mx - dy * k; const cy = my + dx * k;
  return Array.from({ length: 33 }, (_, i) => {
    const t = i / 32;
    return [(1 - t) ** 2 * lat1 + 2 * (1 - t) * t * cx + t ** 2 * lat2, (1 - t) ** 2 * lng1 + 2 * (1 - t) * t * cy + t ** 2 * lng2];
  });
}

// Podkladové mapy bez API klíče. CARTO na veřejných doménách začalo vracet dlaždice „API key required“,
// proto OpenStreetMap; když dlaždice opakovaně selžou, přepne se na Esri. withLayers přidá přepínač
// Mapa / Turistická / Satelit.
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
// Barevný hladký podklad (OpenFreeMap, bez klíče). Bez WebGL nebo při chybě se použijí rastrové dlaždice OSM.
const VECTOR_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
export function baseTiles(L, map, { withLayers = false, extraAttr = '' } = {}) {
  const raster = () => {
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: OSM_ATTR + extraAttr, crossOrigin: true });
    let fails = 0; let swapped = false;
    osm.on('tileerror', () => {
      if (swapped || ++fails < 4) return;
      swapped = true; map.removeLayer(osm);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: `Tiles &copy; Esri${extraAttr}` }).addTo(map);
    });
    return osm;
  };
  let base;
  if (L._tfGL && L.maplibreGL) {
    base = L.maplibreGL({ style: VECTOR_STYLE, attribution: `<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> ${OSM_ATTR}${extraAttr}` });
    base.addTo(map);
    let ready = false;
    const fallback = () => {
      if (ready || !map.hasLayer(base)) return;
      map.removeLayer(base); base = raster().addTo(map);
    };
    // Vrstva se vytvoří až po nastavení pohledu mapy
    map.whenReady(() => {
      const gl = base.getMaplibreMap?.();
      if (!gl) { fallback(); return; }
      // Méně informací: bez obchodů, restaurací a čísel domů – jen ulice, místa a příroda.
      gl.on('load', () => {
        ready = true;
        for (const l of gl.getStyle().layers) if (/^poi|housenumber|aeroway|building-3d/.test(l.id)) gl.setLayoutProperty(l.id, 'visibility', 'none');
      });
      gl.on('error', () => { if (!ready) fallback(); });
    });
    setTimeout(fallback, 8000);
  } else base = raster().addTo(map);
  if (withLayers) {
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: `&copy; Esri, Maxar${extraAttr}` });
    const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { subdomains: 'abc', maxZoom: 17, attribution: `${OSM_ATTR}, &copy; <a href="https://opentopomap.org">OpenTopoMap</a>${extraAttr}` });
    L.control.layers({ Mapa: base, Turistická: topo, Satelit: sat }, null, { position: 'bottomleft' }).addTo(map);
  }
  return base;
}

// Obrázky: zmenšení v prohlížeči před nahráním (rychlé i na mobilních datech).
export function pickImages({ multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', multiple });
    input.onchange = () => resolve([...input.files]);
    input.click();
  });
}
export async function imageToDataUrl(file, { max = 1280, square = false, quality = 0.84 } = {}) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Tenhle soubor neumím otevřít jako obrázek.')); i.src = url; });
    let sx = 0; let sy = 0; let sw = img.naturalWidth; let sh = img.naturalHeight;
    if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
    const k = Math.min(1, max / Math.max(sw, sh));
    const c = document.createElement('canvas');
    c.width = Math.round(sw * k); c.height = Math.round(sh * k);
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  } finally { URL.revokeObjectURL(url); }
}

// Dotyková zařízení: mapu posouvá jen dva prsty (jedním prstem se roluje stránka), přiblížení gestem roztažení.
// Leaflet při dvou prstech mapu posouvá i přibližuje (TouchZoom), stačí vypnout tažení jedním prstem.
export const isTouch = () => matchMedia('(pointer: coarse)').matches;
export function touchMapOptions() { return isTouch() ? { dragging: false, tap: false, touchZoom: true } : {}; }
export function twoFingerHint(el) {
  if (!isTouch()) return;
  el.classList.add('two-finger');
  const hint = document.createElement('div');
  hint.className = 'map-hint';
  hint.innerHTML = '<span>Mapu posuneš dvěma prsty</span>';
  el.appendChild(hint);
  let timer = 0; let start = null;
  el.addEventListener('touchstart', (e) => { start = e.touches.length === 1 ? e.touches[0] : null; if (e.touches.length > 1) el.classList.remove('hint-on'); }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1 || !start) return;
    const t = e.touches[0];
    if (Math.hypot(t.clientX - start.clientX, t.clientY - start.clientY) < 12) return;
    el.classList.add('hint-on'); clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('hint-on'), 1400);
  }, { passive: true });
}

// points: [{lat, lng, label, sub, num, color, kind:'stop'|'stay'|'origin'}]
// segments: [{from:[lat,lng], to:[lat,lng], mode, label}]
export async function drawMap(el, { points = [], segments = [], legend = true } = {}) {
  if (!el) return null;
  let L;
  try { L = await loadLeaflet(); } catch { el.innerHTML = '<div class="map-fallback">Mapu se nepodařilo načíst.</div>'; return null; }
  if (el._map) { el._map.remove(); }
  const map = L.map(el, { scrollWheelZoom: false, zoomControl: true, attributionControl: true, worldCopyJump: true, ...touchMapOptions() });
  twoFingerHint(el);
  el._map = map;
  baseTiles(L, map);
  const bounds = [];
  for (const s of segments) {
    if (!s.from || !s.to) continue;
    const st = MODE_STYLE[s.mode] || MODE_STYLE.car;
    const line = s.path?.length > 1 ? s.path : s.mode === 'flight' ? arc(s.from, s.to) : [s.from, s.to];
    const color = s.color || st.color;
    L.polyline(line, { color: '#fff', weight: st.weight + 5, opacity: 0.9 }).addTo(map);
    const pl = L.polyline(line, { color, weight: st.weight + 1, dashArray: st.dash, lineCap: 'round' }).addTo(map);
    if (s.label) pl.bindTooltip(`${esc(s.label)}`, { sticky: true });
    const mid = line[Math.floor(line.length / 2)];
    L.marker(mid, { icon: L.divIcon({ className: 'map-mode', html: `<span style="--c:${color}">${ms(st.icon)}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }), interactive: false }).addTo(map);
    bounds.push(...line);
  }
  for (const p of points) {
    if (!Number.isFinite(p.lat)) continue;
    const color = p.color || (p.kind === 'stay' ? '#ff375f' : '#0a84ff');
    const inner = p.image ? `<img src="${esc(p.image)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : '';
    const html = `<span class="apin${p.image ? ' photo' : ''}" style="--c:${color}">${inner}${p.num != null && !p.image ? `<b>${p.num}</b>` : ms(p.icon || (p.kind === 'stay' ? 'bed' : p.kind === 'origin' ? 'home' : 'location_on'))}</span>`;
    const size = p.image ? 40 : 30;
    L.marker([p.lat, p.lng], { icon: L.divIcon({ className: 'map-pin', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] }), zIndexOffset: p.z || 0, riseOnHover: true })
      .addTo(map).bindPopup(`${p.image ? `<img class="pop-img" src="${esc(p.image)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<b>${esc(p.label)}</b>${p.sub ? `<br><span>${esc(p.sub)}</span>` : ''}`, { className: 'apple-pop' });
    bounds.push([p.lat, p.lng]);
  }
  if (bounds.length > 1) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13 });
  else if (bounds.length) map.setView(bounds[0], 11);
  else map.setView([48, 14], 4);
  if (legend && segments.length) {
    const modes = [...new Set(segments.map((s) => s.mode))].filter((m) => MODE_STYLE[m]);
    const ctl = L.control({ position: 'bottomleft' });
    ctl.onAdd = () => Object.assign(document.createElement('div'), {
      className: 'map-legend',
      innerHTML: modes.map((m) => `<span><i style="--c:${MODE_STYLE[m].color}" class="${m}"></i>${MODE_STYLE[m].label}</span>`).join(''),
    });
    ctl.addTo(map);
  }
  // Mapa v nově vykresleném / skrytém prvku: přepočítat velikost, jakmile ji prvek opravdu má.
  setTimeout(() => map.invalidateSize(), 60);
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    map.on('unload', () => ro.disconnect());
  }
  return map;
}

// ---------- Cestovatelský pas: razítka zemí ----------
export const MOTIFS = {
  FR: '🥐', IT: '🍕', ES: '🥘', PT: '🐟', GR: '🏛️', IS: '🌋', HR: '⛵', NL: '🌷', AT: '🎻', NO: '🛶', JP: '🗻', ID: '🌺', TH: '🛺',
  VN: '🍜', AE: '🐪', MV: '🐠', NP: '🏔️', LK: '🐘', MA: '🫖', ZA: '🐧', TZ: '🦒', KE: '🦁', EG: '🏺', US: '🗽', CA: '🍁', MX: '🌮',
  CU: '🚗', PE: '🦙', BR: '⚽', AR: '🥩', EC: '🐢', AU: '🦘', NZ: '🥝', FJ: '🌴', CH: '🧀', DE: '🥨', GB: '💂', CZ: '🍺', HU: '🌶️',
  PL: '🥟', IE: '☘️', SK: '🏔️', DK: '🚲', SE: '👑', FI: '🦌', BE: '🧇', TR: '🧿', MT: '⚓', KR: '🥢', SG: '🦁', JO: '🐪', GE: '🍇',
  CR: '🦥', CO: '☕', CN: '🐼', IN: '🕌', SI: '🏞️', BG: '🌹', RO: '🧛', RS: '🎺', ME: '⛰️', CY: '☀️', LU: '🏰', SC: '🐢', MU: '🐬', PH: '🥭',
};
const INKS = ['#111111', '#3a3a3c', '#48484a', '#1d1d1f', '#636366', '#2c2c2e', '#545456', '#3a3a3c'];
const SHAPES = ['rect', 'circle', 'octagon', 'ticket', 'hexagon', 'oval'];
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function stampSvg({ cc, country, date }) {
  const h = hash(cc);
  const ink = INKS[h % INKS.length];
  const shape = SHAPES[(h >> 3) % SHAPES.length];
  const motif = MOTIFS[cc] || '✈️';
  const name = String(country || cc).toUpperCase();
  const when = date ? new Date(date).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\s/g, '') : '';
  const id = `ink-${cc}-${h % 1000}`;
  const W = 170; const H = shape === 'circle' ? 170 : 132;
  const frame = {
    rect: `<rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="10"/><rect x="13" y="13" width="${W - 26}" height="${H - 26}" rx="6" stroke-dasharray="1 0" stroke-width="1.6"/>`,
    circle: `<circle cx="85" cy="85" r="78"/><circle cx="85" cy="85" r="66" stroke-dasharray="3 4" stroke-width="1.6"/>`,
    octagon: `<polygon points="44,6 126,6 164,40 164,92 126,126 44,126 6,92 6,40"/><polygon points="48,14 122,14 156,44 156,88 122,118 48,118 14,88 14,44" stroke-width="1.6"/>`,
    ticket: `<path d="M16 6h138a10 10 0 0 0 10 10v28a12 12 0 0 0 0 24v48a10 10 0 0 0-10 10H16a10 10 0 0 0-10-10V68a12 12 0 0 0 0-24V16A10 10 0 0 0 16 6Z"/><path d="M24 16h122v100H24Z" stroke-dasharray="5 4" stroke-width="1.4"/>`,
    hexagon: `<polygon points="45,6 125,6 164,66 125,126 45,126 6,66"/><polygon points="50,15 120,15 153,66 120,117 50,117 17,66" stroke-width="1.6" stroke-dasharray="2 3"/>`,
    oval: `<ellipse cx="85" cy="66" rx="79" ry="60"/><ellipse cx="85" cy="66" rx="69" ry="50" stroke-width="1.6"/>`,
  }[shape];
  const circle = shape === 'circle';
  const cy = circle ? 92 : shape === 'oval' ? 64 : 70;
  const title = circle
    ? `<path id="arc-${id}" d="M 30 85 A 55 55 0 0 1 140 85" fill="none" stroke="none"/><text font-size="13" font-weight="800" letter-spacing="2" fill="${ink}" stroke="none"><textPath href="#arc-${id}" startOffset="50%" text-anchor="middle">${esc(name.slice(0, 18))}</textPath></text>`
    : `<text x="85" y="${shape === 'ticket' ? 34 : shape === 'oval' ? 40 : 32}" text-anchor="middle" font-size="${name.length > 12 ? 10.5 : 13}" font-weight="800" letter-spacing="1.6" fill="${ink}" stroke="none">${esc(name.slice(0, 20))}</text>`;
  const bottom = circle ? 136 : shape === 'oval' ? 99 : 112;
  return `<svg class="stamp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Razítko ${esc(country)}">
    <defs><filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 ${parseInt(ink.slice(1, 3), 16) / 255} 0 0 0 0 ${parseInt(ink.slice(3, 5), 16) / 255} 0 0 0 0 ${parseInt(ink.slice(5, 7), 16) / 255} -0.45 -0.6 -0.2 1.35 0"/></filter></defs>
    <g fill="none" stroke="${ink}" stroke-width="3">${frame}</g>
    ${title}
    <text x="85" y="${cy + 14}" text-anchor="middle" font-size="${circle ? 46 : 40}" filter="url(#${id})">${motif}</text>
    <text x="85" y="${bottom}" text-anchor="middle" font-size="11" font-weight="700" letter-spacing="1.5" fill="${ink}" stroke="none">${esc(cc)}${when ? ` · ${esc(when)}` : ''}</text>
  </svg>`;
}
