// TripFinder – frontend (vanilla JS, bez build kroku). Jednoduchý hash router.
import { setupSocial, loadProfile, profileBlock, profileHints, ageDiscount, applyHomeOrigin, refreshBadge, viewWelcome, viewChat, viewInvite } from './social.js';
import { ms, autocomplete, calendar, guestsPicker, drawMap, loadLeaflet, baseTiles, stampSvg, touchMapOptions, twoFingerHint, MODE_STYLE, POPULAR_ORIGINS, shortDate, closePopover } from './widgets.js';

const $app = document.getElementById('app');
const state = { user: undefined, meta: null, all: [], photos: {}, search: loadSearch(), roundtrip: loadRoundtrip() };

// ---------- Utility ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const czk = (n) => `${Math.round(n || 0).toLocaleString('cs-CZ')} Kč`;
const MONTHS = ['L', 'Ú', 'B', 'D', 'K', 'Č', 'Č', 'S', 'Z', 'Ř', 'L', 'P'];
const MONTHS_FULL = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
const DAYS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
const COVERS = {
  europe: ['#ebebf0', '#f5f5f7'], asia: ['#e5e5ea', '#f5f5f7'], africa: ['#ebebf0', '#f2f2f4'],
  north_america: ['#e5e5ea', '#f2f2f4'], south_america: ['#ebebf0', '#f5f5f7'], oceania: ['#e5e5ea', '#f5f5f7'],
};
const cover = (c) => `--c1:${COVERS[c]?.[0] || '#eee'};--c2:${COVERS[c]?.[1] || '#f6f6f6'}`;
const fmtDate = (iso, opts = { day: 'numeric', month: 'numeric', year: 'numeric' }) => (iso ? new Date(iso).toLocaleDateString('cs-CZ', opts) : '');
const fmtRange = (a, b) => (a ? `${fmtDate(a, { day: 'numeric', month: 'numeric' })} – ${fmtDate(b)}` : 'Bez data');
const plural = (n, one, few, many) => `${n} ${n === 1 ? one : n > 1 && n < 5 ? few : many}`;
const AVATAR_TONES = ['', 'sky', 'gold', 'lav'];
const initials = (name = '?') => name.replace(/\(.*?\)/g, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?';

const icon = (name, cls = '') => ms(name, cls);
const enc = encodeURIComponent;
const dHref = (id) => `#/d/${enc(id)}`;
const photoUrl = (destId) => `/api/destinations/${enc(destId)}/photo`;
// Známé fotky jdou rovnou z Wikimedie v potřebné velikosti (bez přesměrování přes server).
const photoSrc = (destId, size = 640) => {
  const u = state.photos?.[destId];
  return u ? u.replace(/\/\d+px-/, `/${size}px-`) : photoUrl(destId);
};
const photo = (destId, fb = 'landscape', alt = '', size = 640) => `<img src="${photoSrc(destId, size)}" alt="${esc(alt)}" loading="lazy" decoding="async" onload="this.classList.add('loaded')" onerror="this.remove()"><div class="fallback">${ms(/^[a-z_]+$/.test(fb || '') ? fb : 'landscape')}</div>`;
const time = (t) => (t ? t.slice(11, 16) : '');
const dayLabel = (t) => (t ? new Date(t.slice(0, 10)).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' }) : '');
const fmtMin = (m) => (m ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : '');
const legMinutes = (a, b) => Math.round((new Date(`${b}Z`) - new Date(`${a}Z`)) / 60000);

const CATS = {
  beach: [ms('beach_access')], mountains: [ms('landscape')], city: [ms('location_city')], nature: [ms('park')],
  culture: [ms('account_balance')], food: [ms('restaurant')], adventure: [ms('hiking')], ski: [ms('downhill_skiing')],
};
const QUICK = [
  { label: 'Teplo v zimě', set: { tags: ['beach'], month: '1', continent: 'world' } },
  { label: 'Hory v Evropě', set: { tags: ['mountains'], continent: 'europe', month: '' } },
  { label: 'Gastro víkend', set: { tags: ['food'], continent: 'europe', month: '' } },
  { label: 'Exotika do 40 000 Kč', set: { tags: [], continent: 'asia', maxBudget: '40000', month: '' } },
  { label: 'Safari a příroda', set: { tags: ['nature', 'adventure'], continent: 'africa', month: '' } },
];
const KIND = {
  destination: { icon: 'location_on', label: 'Destinace' },
  transport: { icon: 'flight', label: 'Doprava' },
  lodging: { icon: 'bed', label: 'Ubytování' },
  note: { icon: 'edit_note', label: 'Poznámka' },
};
const MODE_ICON = { flight: 'flight', bus: 'directions_bus', train: 'train', combo: 'alt_route', car: 'directions_car', walk: 'directions_walk' };
const AIRBNB_LOGO = '<svg viewBox="0 0 32 32" width="18" height="18" aria-hidden="true"><path fill="#ff385c" d="M16 1c2 0 3.5 1 4.6 3.2l.2.4 8.2 16.9.2.4c.5 1.2.8 2.3.8 3.4 0 3.5-2.6 5.7-5.6 5.7-2.3 0-4.6-1.4-7.2-4.1l-.4-.4-.4.4c-2.6 2.7-4.9 4.1-7.2 4.1-3 0-5.6-2.2-5.6-5.7 0-1 .2-2 .7-3.2l.3-.6L11.4 4.6C12.5 2.1 14 1 16 1Zm0 2c-1.2 0-2.1.7-2.9 2.4l-.2.4-8.2 16.8c-.5 1.1-.7 2-.7 2.9 0 2.3 1.6 3.7 3.6 3.7 1.7 0 3.6-1.1 5.8-3.4l.6-.6c-1.9-2.4-3.1-4.7-3.1-6.6 0-2.8 2-4.6 5.1-4.6s5.1 1.8 5.1 4.6c0 1.9-1.2 4.2-3.1 6.6l.6.6c2.2 2.3 4.1 3.4 5.8 3.4 2 0 3.6-1.4 3.6-3.7 0-.8-.2-1.7-.7-2.7l-.2-.4L18.9 5.6C18.1 3.8 17.2 3 16 3Zm0 12.6c-2 0-3.1 1-3.1 2.6 0 1.4 1 3.3 3.1 5.9 2.1-2.6 3.1-4.5 3.1-5.9 0-1.6-1.1-2.6-3.1-2.6Z"/></svg>';
const LOGO_TONES = [['var(--sky-soft)', '#0058bc'], ['var(--coral-soft)', '#c4161c'], ['var(--mint-soft)', '#1d8a3a'], ['var(--gold-soft)', '#a35d00'], ['var(--lavender-soft)', '#8a2fb8']];
const logo = (name) => {
  const [bg, fg] = LOGO_TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % LOGO_TONES.length];
  return `<span class="logo" style="background:${bg};color:${fg}">${esc(initials(name))}</span>`;
};

function defaultDates() {
  const start = new Date();
  start.setDate(start.getDate() + 30);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}
function loadSearch() {
  const base = { continent: 'world', q: '', tags: [], maxBudget: '', month: '', sort: 'recommended', persons: 2, adults: 2, children: 0, origin: 'PRG', originLabel: 'Praha', tab: 'trip', ...defaultDates() };
  try {
    const s = { ...base, ...JSON.parse(localStorage.getItem('tf_search') || '{}') };
    if (!s.from || new Date(s.from) < new Date(new Date().toDateString())) Object.assign(s, defaultDates());
    if (!s.originLabel) s.originLabel = POPULAR_ORIGINS.find((o) => o.id === s.origin)?.name || s.origin;
    s.persons = Math.max(1, Number(s.adults || s.persons) + Number(s.children || 0));
    return s;
  } catch { return base; }
}
function saveSearch() { try { localStorage.setItem('tf_search', JSON.stringify(state.search)); } catch { /* ignore */ } }
const nights = () => Math.max(1, Math.round((new Date(state.search.to) - new Date(state.search.from)) / 86400000) || 7);
const originName = () => state.search.originLabel || state.search.origin;
const guestsLabel = (s) => `${plural(Number(s.adults || s.persons), 'dospělý', 'dospělí', 'dospělých')}${Number(s.children) ? `, ${plural(Number(s.children), 'dítě', 'děti', 'dětí')}` : ''}`;
function loadRoundtrip() {
  const base = { stops: [], returnHome: true, start: defaultDates().from };
  try {
    const r = { ...base, ...JSON.parse(localStorage.getItem('tf_roundtrip') || '{}') };
    if (new Date(r.start) < new Date(new Date().toDateString())) r.start = base.start;
    return r;
  } catch { return base; }
}
const saveRoundtrip = () => { try { localStorage.setItem('tf_roundtrip', JSON.stringify(state.roundtrip)); } catch { /* ignore */ } };
const ROUND_PRESETS = [
  { label: 'Střední Evropa', stops: [['vienna', 'Vídeň', 2], ['budapest', 'Budapešť', 3], ['krakow', 'Krakov', 2]] },
  { label: 'Italská klasika', stops: [['venice', 'Benátky', 2], ['florence', 'Florencie a Toskánsko', 3], ['rome', 'Řím', 3]] },
  { label: 'Iberská cesta', stops: [['barcelona', 'Barcelona', 3], ['seville', 'Sevilla a Andalusie', 3], ['lisbon', 'Lisabon', 3], ['porto', 'Porto', 2]] },
  { label: 'Japonsko a Korea', stops: [['tokyo', 'Tokio', 4], ['kyoto', 'Kjóto', 3], ['seoul', 'Soul', 3]] },
  { label: 'Řecko a Balkán', stops: [['split', 'Split', 3], ['dubrovnik', 'Dubrovník', 2], ['athens', 'Athény', 2], ['santorini', 'Santorini', 3]] },
];

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method, credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Chyba připojení.'), { status: res.status });
  return data;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

function modal(html, onMount, { wide = false } = {}) {
  const root = document.getElementById('modal-root');
  closePopover();
  root.innerHTML = `<div class="modal-backdrop"><div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  root.querySelector('.modal-backdrop').addEventListener('click', (e) => e.target === e.currentTarget && close());
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  onMount?.(root.querySelector('.modal'), close);
  if (!wide) root.querySelector('input, button')?.focus();
  return close;
}

async function shareLink(title, url) {
  if (navigator.share) { navigator.share({ title, url }).catch(() => {}); return; }
  await navigator.clipboard?.writeText(url).catch(() => {});
  toast('Odkaz zkopírován');
}

// ---------- Hlavička ----------
function renderAccount() {
  const el = document.getElementById('account');
  const bottom = document.getElementById('bottom-account');
  el.innerHTML = `<button class="btn sm hdr-new" data-new-trip>${ms('add', 'sm')} Vytvořit výlet</button>${state.user
    ? `<a class="avatar me" href="#/account" title="${esc(state.user.name)}" aria-label="Můj profil">${esc(initials(state.user.name))}</a>`
    : `<a class="avatar me" href="#/login" title="Přihlásit se" aria-label="Přihlásit se">${ms('person')}</a>`}`;
  bottom.href = state.user ? '#/account' : '#/login';
}

// Nový výlet odkudkoli (tlačítko v hlavičce, na hlavní stránce…)
function newTrip(prefill = {}) {
  if (!state.user) {
    sessionStorage.setItem('tf_after_login', '#/trips');
    toast('Pro vytvoření výletu se přihlas nebo si založ účet.');
    location.hash = '#/register';
    return;
  }
  modal(`<h2>Nový výlet</h2><p class="muted" style="margin-top:6px">Název a termín. Program, místa a rozpočet doplníte s partou.</p>
    <form id="f" class="stack-form">${tripForm(prefill)}
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Zrušit</button><button class="btn">Vytvořit výlet</button></div></form>`, (m, close) => {
    m.querySelector('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await api('/trips', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
        close();
        location.hash = `#/trips/${res.trip.id}`;
      } catch (err) { toast(err.message); }
    });
  });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-new-trip]');
  if (b) { e.preventDefault(); newTrip(); }
});

// „Zkopírovat odkaz na výlet“ – pozvánka do posledního výletu (nebo založení nového)
async function copyTripLink() {
  if (!state.user) { newTrip(); return; }
  const { trips } = await api('/trips');
  const t = trips.find((x) => x.role === 'owner' && x.status !== 'done');
  if (!t) { newTrip(); return; }
  const { token } = await api(`/trips/${t.id}/invite-link`, { method: 'POST' });
  shareLink(t.title, `${location.origin}/#/join/${token}`);
}

async function logout() {
  await api('/auth/logout', { method: 'POST' }).catch(() => {});
  state.user = null; state.profile = null;
  renderAccount();
  toast('Byl(a) jsi odhlášen(a).');
  location.hash = '#/';
}
function setActiveNav(name) {
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === name));
}

// ---------- Router ----------
const routes = [
  [/^#?\/?$/, viewSearch, 'search'],
  [/^#\/d\/(.+)$/, (id) => viewDestination(decodeURIComponent(id)), 'search'],
  [/^#\/route$/, viewRoundtrip, 'search'],
  [/^#\/explore$/, viewExplore, 'explore'],
  [/^#\/trips$/, viewTrips, 'trips'],
  [/^#\/trips\/(\d+)$/, viewTrip, 'trips'],
  [/^#\/login$/, () => viewAuth('login'), 'account'],
  [/^#\/register$/, () => viewAuth('register'), 'account'],
  [/^#\/account$/, viewAccount, 'account'],
  [/^#\/shared\/([\w-]+)$/, viewShared, 'trips'],
  [/^#\/join\/([\w-]+)$/, viewJoin, 'trips'],
  [/^#\/chat\/t\/(\d+)$/, (id) => viewChat(null, Number(id)), 'chat'],
  [/^#\/welcome$/, viewWelcome, 'account'],
  [/^#\/chat$/, () => viewChat(), 'chat'],
  [/^#\/chat\/(\d+)$/, viewChat, 'chat'],
  [/^#\/invite\/([\w-]+)$/, viewInvite, 'chat'],
];
async function route() {
  const hash = location.hash || '#/';
  for (const [re, view, nav] of routes) {
    const m = hash.match(re);
    if (!m) continue;
    setActiveNav(nav);
    document.getElementById('modal-root').innerHTML = '';
    closePopover();
    document.body.dataset.view = nav;
    try { await view(...m.slice(1)); } catch (e) { $app.innerHTML = emptyState('sentiment_dissatisfied', e.message, '<a class="btn" href="#/">Zpět na objevování</a>'); }
    window.scrollTo(0, 0);
    return;
  }
  $app.innerHTML = emptyState('explore', 'Tahle stránka neexistuje.', '<a class="btn" href="#/">Zpět na objevování</a>');
}
const emptyState = (ic, text, action = '') => `<div class="empty"><div class="big">${ms(ic)}</div><p>${esc(text)}</p>${action}</div>`;

// ---------- Objevování ----------
async function viewSearch() {
  const s = state.search;
  const { continents, tags } = state.meta;
  // Inspirace: destinace s fotkou, v pořadí podle sezóny (aktuální měsíc)
  const month = new Date().getMonth() + 1;
  const inspo = [...state.all].sort((x, y) => (y.bestMonths.includes(month) - x.bestMonths.includes(month))).slice(0, 12);
  const step = (n, title, text, art) => `<div class="card bento step"><div class="step-top"><span class="tag">Krok ${n}</span></div><h3>${title}</h3><p class="muted">${text}</p><div class="step-art">${art}</div></div>`;
  const module = (ic, title, text, foot, href) => `<a class="card bento module" href="${href}"><span class="tile-ic">${ms(ic)}</span><h3>${title}</h3><p class="muted">${text}</p><span class="module-foot"><span>${foot}</span>${ms('arrow_forward', 'sm')}</span></a>`;
  $app.innerHTML = `
    <section class="home-hero">
      <span class="tag">${state.user ? `Ahoj ${esc(state.user.name.split(' ')[0])}, vítej zpět` : 'Wanderly • Minimalistické plánování'}</span>
      <h1 class="display">Plánuj výlety s přáteli jednoduše.</h1>
      <p class="lead">Letenky, místa a společný program přehledně na jednom plátně. Žádné chaotické tabulky ani ztracené zprávy v chatech.</p>
      <div class="hero-cta"><button class="btn" data-new-trip>${ms('add')} Vytvořit výlet</button><a class="link-arrow" href="#/trips">Sdílet odkaz na výlet bez registrace ${ms('arrow_forward', 'sm')}</a></div>
    </section>

    <section class="search-block" id="search">
      <div class="segmented dock-tabs" role="tablist">
        <button role="tab" data-tab="trip" aria-selected="${s.tab !== 'route'}">Jedno místo</button>
        <button role="tab" data-tab="route" aria-selected="${s.tab === 'route'}">Okružní cesta</button>
      </div>
      <div id="dock"></div>
    </section>

    <section class="block">
      <div class="block-head"><span class="eyebrow">Inspirace pro příští trasu</span>
        <div class="arrows"><button class="round-btn" data-scroll="-1" aria-label="Předchozí">${ms('chevron_left')}</button><button class="round-btn" data-scroll="1" aria-label="Další">${ms('chevron_right')}</button></div></div>
      <div class="inspo" id="inspo">${inspo.map((d) => `<a class="inspo-card" href="${dHref(d.id)}">${photo(d.id, 'landscape', d.name, 480)}
        <span class="inspo-txt"><span class="tag dark">${d.bestMonths.includes(month) ? 'Teď v sezóně' : esc(state.meta.tags[d.tags[0]] || '')}</span><b>${esc(d.name)}</b><small>${esc(d.country)}</small></span></a>`).join('')}</div>
    </section>

    <section class="block">
      <div class="split-head"><div><span class="eyebrow">Jak to funguje</span><h2 class="h-lg">Vše podstatné, intuitivně uspořádané.</h2></div>
        <p class="muted">Od prvního nápadu po okamžik odletu. Tři čisté kroky bez zbytečného digitálního šumu.</p></div>
      <div class="bento-3">
        ${step('01', 'Vyber cíl & pozvi partu', 'Sdílej jediný odkaz. Kamarádi se připojí okamžitě, bez stahování aplikace.', `<div class="mini-row"><span>${ms('location_on', 'sm')} Lisabon</span><span class="faint">4 dny</span></div><div class="stack">${['MK', 'TL', 'AK'].map((x) => `<span class="avatar">${x}</span>`).join('')}<span class="small muted">+1</span></div>`)}
        ${step('02', 'Ukládej spoty na jedno kliknutí', 'Kavárny, vyhlídky i ubytování. Parta o nápadech hlasuje.', `<div class="mini-row"><span>${ms('local_cafe', 'sm')} Copenhagen Coffee Lab</span>${ms('check', 'sm')}</div><div class="mini-row"><span>${ms('visibility', 'sm')} Miradouro de Santa Luzia</span>${ms('check', 'sm')}</div>`)}
        ${step('03', 'Přehledný plán & rozpočet', 'Konec dohadování, kdo co platil. Každý náklad se rovnou rozpočítá.', `<div class="mini-row"><span class="small muted">Celkový rozpočet</span><b>12 450 Kč</b></div><div class="progress"><i style="width:68%"></i></div><div class="mini-row"><span class="small muted">Podíl na osobu (1/4)</span><span class="small">3 112 Kč</span></div>`)}
      </div>
    </section>

    <section class="block center-head">
      <span class="eyebrow">Moduly výletu</span><h2 class="h-lg">Všechny součásti cesty v harmonii.</h2>
      <p class="muted">Každý prvek itineráře má své přesně určené místo pro rychlý přehled kdykoli během cesty.</p>
      <div class="bento-4">
        ${module('flight', 'Doprava', 'Letenky, vlaky, autobusy i přestupy v jednom časovém sledu.', 'Spoje & ceny', '#/#search')}
        ${module('bed', 'Ubytování', 'Apartmány z Airbnb s cenou za celý pobyt a odkazem rovnou na nabídku.', 'Airbnb nabídky', '#/#search')}
        ${module('local_activity', 'Zážitky', 'Památky, vyhlídky a hidden gems na mapě s trasou pěšky i autem.', 'Mapa míst', '#/explore')}
        ${module('restaurant', 'Gastronomie', 'Kavárny, trhy a podniky, které parta navrhne a odhlasuje.', 'Nápady party', '#/trips')}
      </div>
    </section>

    <section id="deals" class="deals block"></section>

    <section class="block">
      <div class="split-head"><div><span class="eyebrow">Destinace</span><h2 class="h-lg" id="count">Destinace</h2></div><span class="small muted" id="estimate-note"></span></div>
      <div class="toolbar">
        <div class="chips" role="group" aria-label="Kontinent">
          <button class="chip" data-continent="world" aria-pressed="${s.continent === 'world'}">Celý svět</button>
          ${Object.entries(continents).map(([id, name]) => `<button class="chip" data-continent="${id}" aria-pressed="${s.continent === id}">${esc(name)}</button>`).join('')}
        </div>
        <div class="chips" role="group" aria-label="Styl cesty">${Object.entries(tags).map(([id, name]) => `<button class="chip" data-tag="${id}" aria-pressed="${s.tags.includes(id)}">${esc(name)}</button>`).join('')}</div>
        <div class="selects">
          <select id="maxBudget" aria-label="Rozpočet na osobu">${[['', 'Rozpočet: bez limitu'], [15000, 'do 15 000 Kč / os.'], [25000, 'do 25 000 Kč / os.'], [40000, 'do 40 000 Kč / os.'], [60000, 'do 60 000 Kč / os.'], [90000, 'do 90 000 Kč / os.']]
            .map(([v, l]) => `<option value="${v}" ${String(s.maxBudget) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <select id="month" aria-label="Sezóna"><option value="">Sezóna: kdykoli</option>${MONTHS_FULL.map((m, i) => `<option value="${i + 1}" ${String(s.month) === String(i + 1) ? 'selected' : ''}>Ideální v: ${m}</option>`).join('')}</select>
          <select id="sort" aria-label="Řazení">${[['recommended', 'Řadit: doporučené'], ['price', 'Řadit: nejlevnější'], ['distance', 'Řadit: nejblíž'], ['name', 'Řadit: podle názvu']]
            .map(([v, l]) => `<option value="${v}" ${s.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </div>
      </div>
      <div class="grid" id="results">${'<div class="skeleton" style="height:340px"></div>'.repeat(6)}</div>
    </section>

    <section class="card bento collab block">
      <div><span class="tag">${ms('link', 'sm')} Náhled i bez registrace</span>
        <h2 class="h-lg">Společné plánování v reálném čase.</h2>
        <p class="muted">Pozvi partu jedním odkazem. Přátelé hlasují o návrzích, připisují poznámky a doplňují program. Prohlédnout si plán může kdokoli i bez účtu.</p>
        <div class="hero-cta left"><button class="btn" id="copy-trip-link">${ms('link')} Zkopírovat odkaz na výlet</button><span class="small muted">Kdo se přidá, může hned přispívat</span></div></div>
      <div class="collab-list"><div class="mini-head"><span class="eyebrow">Spoluautoři výletu</span></div>
        ${[['MK', 'Martin', 'Přidává kavárnu…'], ['TL', 'Tereza', 'Upravuje rozpočet'], ['AK', 'Adam', 'Prohlíží letenky']].map(([i, n, t]) => `<div class="collab-row"><span class="avatar">${i}</span><span class="grow"><b>${n}</b><small>${t}</small></span><i class="dot"></i></div>`).join('')}</div>
    </section>

    <section class="cta-band">
      <div><h2>Váš příští výlet začíná zde.</h2><p>Bez reklam, bez zbytečností. Čisté plátno pro nezapomenutelné dny na cestách.</p></div>
      <button class="btn light" data-new-trip>${ms('add')} Vytvořit nový výlet</button>
    </section>`;
  const strip = document.getElementById('inspo');
  $app.querySelectorAll('[data-scroll]').forEach((b) => b.addEventListener('click', () => strip.scrollBy({ left: Number(b.dataset.scroll) * strip.clientWidth * 0.8, behavior: 'smooth' })));
  $app.querySelectorAll('a[href="#/#search"]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('search').scrollIntoView({ behavior: 'smooth' }); document.getElementById('q')?.focus({ preventScroll: true }); }));
  document.getElementById('copy-trip-link').onclick = copyTripLink;

  const update = (patch, rerender = false) => {
    Object.assign(state.search, patch);
    saveSearch();
    if (rerender) viewSearch(); else { syncFilters(); viewSearchResults(); }
  };
  $app.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    state.search.tab = b.dataset.tab; saveSearch();
    $app.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', x === b));
    renderDock();
  }));
  $app.querySelectorAll('[data-quick]').forEach((b) => b.addEventListener('click', () => {
    update({ q: '', maxBudget: '', ...QUICK[b.dataset.quick].set }, true);
    setTimeout(() => document.getElementById('count')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }));
  $app.querySelectorAll('[data-continent]').forEach((b) => b.addEventListener('click', () => update({ continent: b.dataset.continent })));
  $app.querySelectorAll('[data-tag]').forEach((b) => b.addEventListener('click', () => {
    const t = new Set(state.search.tags);
    t.has(b.dataset.tag) ? t.delete(b.dataset.tag) : t.add(b.dataset.tag);
    update({ tags: [...t] });
  }));
  ['maxBudget', 'month', 'sort'].forEach((id) => document.getElementById(id).addEventListener('change', (e) => update({ [id]: e.target.value })));
  renderDock();
  syncFilters();
  viewSearchResults();
  loadDeals();
}

// Pole „Odkud“ s našeptávačem (letiště, města i adresy).
function originField(id = 'origin-input') {
  return `<div class="dock-field ac-wrap"><label for="${id}">Odkud</label><input id="${id}" placeholder="Město, adresa, letiště" value="${esc(originName())}"></div>`;
}
function bindOrigin(id = 'origin-input', after) {
  const input = document.getElementById(id);
  autocomplete(input, {
    suggestions: () => POPULAR_ORIGINS,
    onSelect: (r) => {
      Object.assign(state.search, { origin: r.kind === 'airport' ? r.airport : r.id, originLabel: r.name, originTouched: true });
      saveSearch();
      after?.();
    },
  });
  input.addEventListener('blur', () => setTimeout(() => { if (!input.value.trim()) input.value = originName(); }, 150));
}
function bindDates(btn, after) {
  btn.addEventListener('click', () => calendar(btn, {
    from: state.search.from, to: state.search.to,
    onChange: ({ from, to }) => {
      Object.assign(state.search, { from, to });
      saveSearch();
      btn.querySelector('b').textContent = `${shortDate(from)} – ${shortDate(to)}`;
      after?.();
    },
  }));
}
function bindGuests(btn, after) {
  btn.addEventListener('click', () => guestsPicker(btn, {
    adults: Number(state.search.adults || state.search.persons), children: Number(state.search.children || 0),
    onChange: ({ adults, children }) => {
      Object.assign(state.search, { adults, children, persons: adults + children });
      saveSearch();
      btn.querySelector('b').textContent = guestsLabel(state.search);
      after?.();
    },
  }));
}

function renderDock() {
  const s = state.search;
  const el = document.getElementById('dock');
  if (s.tab === 'route') return renderRoundtripDock(el);
  el.innerHTML = `<form class="dock" id="searchform">
    <div class="dock-fields">
      <div class="dock-field wide ac-wrap"><label for="q">Kam</label><input id="q" name="q" placeholder="Město, adresa, ostrov… nebo pláž, safari" value="${esc(s.q)}"></div>
      ${originField()}
      <button type="button" class="dock-field picker" id="dates"><label>Termín</label><b>${shortDate(s.from)} – ${shortDate(s.to)}</b></button>
      <button type="button" class="dock-field picker" id="guests"><label>Cestující</label><b>${guestsLabel(s)}</b></button>
      <button class="btn" type="submit">${icon('search')} Vyhledat</button>
    </div>
  </form>`;
  const form = document.getElementById('searchform');
  autocomplete(form.q, {
    suggestions: () => [],
    onSelect: (r) => { location.hash = dHref(r.id); },
  });
  bindOrigin('origin-input', syncFilters);
  bindDates(document.getElementById('dates'), syncFilters);
  bindGuests(document.getElementById('guests'), syncFilters);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    state.search.q = form.q.value.trim();
    saveSearch();
    syncFilters();
    viewSearchResults();
    document.getElementById('count').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function renderRoundtripDock(el) {
  const s = state.search;
  const r = state.roundtrip;
  const total = r.stops.reduce((a, x) => a + Number(x.nights), 0);
  el.innerHTML = `<div class="dock round-dock">
    <div class="dock-fields">
      ${originField('rt-origin')}
      <button type="button" class="dock-field picker" id="rt-start"><label>Odjezd</label><b>${shortDate(r.start)}</b></button>
      <button type="button" class="dock-field picker" id="rt-guests"><label>Cestující</label><b>${guestsLabel(s)}</b></button>
      <div class="dock-field wide ac-wrap"><label for="rt-add">Přidat zastávku</label><input id="rt-add" placeholder="Město nebo místo kdekoli na světě…"></div>
    </div>
    <ol class="stops">${r.stops.map((x, i) => `
      <li><span class="num">${i + 1}</span><span class="grow"><b>${esc(x.name)}</b><small>${esc(x.detail || '')}</small></span>
        <span class="stepper sm"><button type="button" data-n="${i}" data-d="-1" aria-label="Méně nocí">−</button><span>${plural(Number(x.nights), 'noc', 'noci', 'nocí')}</span><button type="button" data-n="${i}" data-d="1" aria-label="Více nocí">+</button></span>
        <button type="button" class="btn ghost sm icon-only" data-up="${i}" ${i ? '' : 'disabled'} aria-label="Posunout výš">↑</button>
        <button type="button" class="btn ghost sm icon-only" data-rm="${i}" aria-label="Odebrat">${icon('close', 'sm')}</button></li>`).join('')
      || '<li class="stops-empty">Přidej města, která chceš projet – třeba Vídeň, Budapešť a Krakov. Nebo vyber hotovou trasu níž.</li>'}</ol>
    <div class="round-foot">
      <label class="check"><input type="checkbox" id="rt-home" ${r.returnHome ? 'checked' : ''}> Vrátit se domů (${esc(originName())})</label>
      <span class="small muted">${r.stops.length ? `${plural(r.stops.length, 'zastávka', 'zastávky', 'zastávek')} · ${plural(total, 'noc', 'noci', 'nocí')} · návrat ${shortDate(new Date(new Date(r.start).getTime() + total * 86400000).toISOString().slice(0, 10))}` : ''}</span>
      <button class="btn" id="rt-go" ${r.stops.length ? '' : 'disabled'}>Naplánovat trasu</button>
    </div>
    <div class="presets"><span class="eyebrow">Hotové trasy:</span>${ROUND_PRESETS.map((p, i) => `<button type="button" class="chip" data-preset="${i}">${p.label}</button>`).join('')}</div>
  </div>`;
  const rerender = () => { saveRoundtrip(); renderRoundtripDock(el); };
  bindOrigin('rt-origin', rerender);
  const startBtn = document.getElementById('rt-start');
  startBtn.addEventListener('click', () => calendar(startBtn, { from: r.start, single: true, title: 'Den odjezdu', onChange: ({ from }) => { r.start = from; rerender(); } }));
  bindGuests(document.getElementById('rt-guests'));
  autocomplete(document.getElementById('rt-add'), {
    onSelect: (p) => {
      if (r.stops.length >= 8) return toast('Okružní cesta může mít nejvýš 8 zastávek.');
      r.stops.push({ id: p.id, name: p.name, detail: p.detail, nights: 2 });
      rerender();
      document.getElementById('rt-add').focus();
    },
  });
  el.querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => {
    const x = r.stops[b.dataset.n];
    x.nights = Math.min(30, Math.max(1, Number(x.nights) + Number(b.dataset.d)));
    rerender();
  }));
  el.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { r.stops.splice(Number(b.dataset.rm), 1); rerender(); }));
  el.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.up);
    [r.stops[i - 1], r.stops[i]] = [r.stops[i], r.stops[i - 1]];
    rerender();
  }));
  el.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    r.stops = ROUND_PRESETS[b.dataset.preset].stops.map(([id, name, nights]) => ({ id, name, nights, detail: state.all.find((d) => d.id === id)?.country || '' }));
    rerender();
  }));
  document.getElementById('rt-home').addEventListener('change', (e) => { r.returnHome = e.target.checked; saveRoundtrip(); });
  document.getElementById('rt-go').addEventListener('click', () => { location.hash = '#/route'; });
}

// ---------- Akční nabídky na půl roku ----------
async function loadDeals() {
  const el = document.getElementById('deals');
  if (!el) return;
  el.innerHTML = `<div class="section-head"><div><span class="eyebrow coral">Akční letenky a ubytování</span><h2>Nejlevnější termíny na půl roku dopředu</h2></div></div><div class="deal-row">${'<div class="skeleton deal-skel"></div>'.repeat(4)}</div>`;
  let data;
  try { data = await api(`/deals?${new URLSearchParams({ origin: state.search.origin })}`); } catch { el.innerHTML = ''; return; }
  if (!document.body.contains(el)) return;
  let month = data.months[0]?.month;
  const render = () => {
    const deals = data.months.find((m) => m.month === month)?.deals || [];
    el.innerHTML = `
      <div class="section-head"><div><span class="eyebrow coral">Akční letenky a ubytování</span><h2>Nejlevnější termíny na půl roku dopředu</h2></div>
        <span class="small muted">Odlet z ${esc(data.origin.name)} (${esc(data.origin.code)}) · ${data.live ? 'skutečné ceny Aviasales' : 'ukázkové ceny, skutečné po vložení klíče Travelpayouts'}</span></div>
      <div class="chips months-chips">${data.months.map((m) => {
        const d = new Date(`${m.month}-01`);
        return `<button class="chip" data-month="${m.month}" aria-pressed="${m.month === month}">${MONTHS_FULL[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''}</button>`;
      }).join('')}</div>
      <div class="deal-row">${deals.map((x, i) => `
        <button class="card deal" data-deal="${i}">
          <div class="media" style="${cover('europe')}">${photo(x.destinationId, x.emoji, x.name)}<span class="pill coral off">−${x.discount} %</span></div>
          <div class="deal-body">
            <div class="small faint">${dayLabel(x.depart)} – ${dayLabel(x.return)} · ${plural(x.nights, 'noc', 'noci', 'nocí')}</div>
            <h3>${esc(x.name)}</h3>
            <div class="deal-lines">
              <span>${ms('flight')} Letenka <s>${czk(x.oldFlight)}</s> <b>${czk(x.flight)}</b></span>
              <span>${ms('bed')} Hotel / noc <s>${czk(x.oldHotelPerNight)}</s> <b>${czk(x.hotelPerNight)}</b></span>
            </div>
            <div class="deal-foot"><span class="small faint">celkem od</span><span class="price">${czk(x.perPerson)} <small>/ os.</small></span></div>
          </div>
        </button>`).join('') || '<p class="muted">Na tento měsíc teď nic nemáme.</p>'}</div>`;
    el.querySelectorAll('[data-month]').forEach((b) => b.addEventListener('click', () => { month = b.dataset.month; render(); }));
    el.querySelectorAll('[data-deal]').forEach((b) => b.addEventListener('click', () => {
      const x = deals[b.dataset.deal];
      Object.assign(state.search, { from: x.depart, to: x.return });
      saveSearch();
      location.hash = dHref(x.destinationId);
    }));
  };
  render();
}

function syncFilters() {
  const s = state.search;
  $app.querySelectorAll('[data-continent]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.continent === s.continent));
  $app.querySelectorAll('[data-tag]').forEach((x) => x.setAttribute('aria-pressed', s.tags.includes(x.dataset.tag)));
  const note = document.getElementById('estimate-note');
  if (note) note.textContent = `Odhad za ${plural(Number(s.persons), 'osobu', 'osoby', 'osob')} · ${plural(nights(), 'noc', 'noci', 'nocí')} z ${originName()}`;
}

async function viewSearchResults() {
  const s = state.search;
  const params = new URLSearchParams({ continent: s.continent, q: s.q, tags: s.tags.join(','), maxBudget: s.maxBudget, month: s.month, sort: s.sort, persons: s.persons, nights: nights() });
  const { results } = await api(`/destinations?${params}`);
  const el = document.getElementById('results');
  if (!el) return;
  document.getElementById('count').textContent = results.length ? plural(results.length, 'destinace', 'destinace', 'destinací') : 'Nic jsme nenašli';
  if (!results.length) {
    el.innerHTML = `<div style="grid-column:1/-1">${emptyState('search_off', 'Těmto filtrům nic neodpovídá. Zkus uvolnit rozpočet nebo typ výletu.', '<button class="btn glass" id="reset">Zrušit filtry</button>')}</div>`;
    document.getElementById('reset').onclick = () => { Object.assign(state.search, { continent: 'world', q: '', tags: [], maxBudget: '', month: '' }); saveSearch(); viewSearch(); };
    return;
  }
  const limit = viewSearchResults.all ? results.length : 9;
  el.innerHTML = results.slice(0, limit).map((d) => `
    <a class="card dest-card" href="${dHref(d.id)}">
      <div class="media" style="${cover(d.continent)}">
        ${photo(d.id, d.emoji, d.name)}
        <div class="badges"><span class="pill glass">${icon('location_on', 'sm')} ${esc(state.meta.continents[d.continent])}</span>${s.month && d.bestMonths.includes(Number(s.month)) ? '<span class="pill mint">Ideální sezóna</span>' : ''}</div>
        <button class="heart" data-save="${d.id}" aria-label="Uložit ${esc(d.name)} do výletu">${icon('favorite')}</button>
      </div>
      <div class="dest-body">
        <div class="loc">${esc(d.country)} · ${d.distanceKm.toLocaleString('cs-CZ')} km</div>
        <h3>${esc(d.name)}</h3>
        <p>${esc(d.description)}</p>
        <div class="tags">${d.tags.slice(0, 3).map((t) => `<span class="pill">${esc(state.meta.tags[t])}</span>`).join('')}</div>
        <div class="dest-foot">
          <div><span class="small faint">od</span><div class="price">${czk(d.estimate.perPerson)} <small>/ os.</small></div></div>
          <span class="pill sky">${icon('flight', 'sm')} ~${flightHours(d.distanceKm)}</span>
        </div>
      </div>
    </a>`).join('') + (results.length > limit ? `<div class="more-row"><button class="btn soft" id="more-dest">Zobrazit všech ${plural(results.length, 'destinaci', 'destinace', 'destinací')}</button></div>` : '');
  document.getElementById('more-dest')?.addEventListener('click', () => { viewSearchResults.all = true; viewSearchResults(); });
  el.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault();
    const d = results.find((x) => x.id === b.dataset.save);
    saveToTrip('destination', destItem(d), () => b.classList.add('on'));
  }));
}

const flightHours = (km) => {
  const total = Math.round((km / 780 + (km > 3000 ? 2 : 0.6)) * 6) * 10; // minuty, zaokrouhleno na 10
  const h = Math.floor(total / 60); const m = total % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
};
const destItem = (d) => ({ destinationId: d.id, title: d.name, name: d.name, subtitle: `${d.country} · ${state.meta.continents[d.continent] || ''}`, emoji: d.emoji, cc: d.cc || '', lat: d.lat, lng: d.lng });

// ---------- Detail destinace ----------
async function viewDestination(id) {
  const { destination: d, continentName, tagNames, langCodes } = await api(`/destinations/${enc(id)}`);
  const s = state.search;
  $app.innerHTML = `
    <a href="#/" class="back">${icon('arrow_back', 'sm')} Zpět na objevování</a>
    <section class="photo-hero">
      <div class="media" style="${cover(d.continent)}">${photo(d.id, d.emoji, d.name, 1280)}</div>
      <span class="credit">Foto: Wikimedia Commons</span>
      <div class="content">
        <div class="tags"><span class="pill glass">${icon('location_on', 'sm')} ${esc(d.country.toUpperCase())} · ${esc((continentName || '').toUpperCase())}</span>${tagNames.slice(0, 2).map((t) => `<span class="pill glass">${esc(t)}</span>`).join('')}</div>
        <h1 style="margin-top:12px">${esc(d.name)}</h1>
        <p>${esc(d.description)}</p>
        <div class="actions">
          <button class="btn glass" id="save-dest">${icon('favorite')} Uložit destinaci</button>
          <button class="btn glass" id="add-round">${ms('route')} Přidat do okružní cesty</button>
          <button class="btn" id="go-offers">${icon('search')} Najít dopravu a ubytování</button>
        </div>
      </div>
    </section>
    <div class="glass-card facts">
      <div class="fact"><span class="ico">${ms('sunny')}</span><div><span class="label">Počasí</span><b id="f-weather">…</b></div></div>
      <div class="fact"><span class="ico">${ms('flight')}</span><div><span class="label">Letiště</span><b>${esc(d.airport)}${d.airportDistanceKm > 5 ? ` · ${d.airportDistanceKm} km` : ''}</b></div></div>
      <div class="fact"><span class="ico">${ms('payments')}</span><div><span class="label">Měna</span><b>${esc(d.currency || '—')}</b></div></div>
      <div class="fact"><span class="ico">${ms('schedule')}</span><div><span class="label">Časový posun</span><b id="f-tz">…</b></div></div>
      <div class="fact"><span class="ico">${ms('restaurant')}</span><div><span class="label">Denní útrata</span><b>~${czk(d.dailyCost)} / os.</b></div></div>
    </div>
    ${profileHints(d, langCodes)}

    <div class="glass-card route-bar" id="route-bar"></div>

    <div class="detail-grid">
      <div id="offers"><div class="offers">${'<div class="skeleton"></div>'.repeat(4)}</div></div>
      <aside class="side sticky">
        <div class="card summary" id="summary"><div class="skeleton" style="height:140px"></div></div>
        <div class="card map-card"><div class="map" id="dest-map"></div></div>
        <div class="card pad" id="weather-card"><h3>Předpověď počasí</h3><div class="weather">${'<div class="skeleton" style="height:96px;border-radius:14px"></div>'.repeat(5)}</div></div>
        ${d.bestMonths.length ? `<div class="card pad"><h3>Nejlepší sezóna</h3><div class="months">${MONTHS.map((m, i) => `<span class="${d.bestMonths.includes(i + 1) ? 'on' : ''}" title="${MONTHS_FULL[i]}">${m}</span>`).join('')}</div>
          <p class="small muted" style="margin-top:10px">Ideálně: ${d.bestMonths.map((m) => MONTHS_FULL[m - 1]).join(', ')}.</p></div>` : ''}
      </aside>
    </div>`;

  const renderRoute = () => {
    document.getElementById('route-bar').innerHTML = `
      <div class="route-fields">
        ${originField('o-origin')}
        <button type="button" class="dock-field picker" id="o-dates"><label>Termín</label><b>${shortDate(s.from)} – ${shortDate(s.to)}</b></button>
        <button type="button" class="dock-field picker" id="o-guests"><label>Cestující</label><b>${guestsLabel(s)}</b></button>
        <label class="check"><input type="checkbox" id="o-oneway" ${s.oneWay ? 'checked' : ''}> Jen tam</label>
      </div>
      <span class="meta">${icon('flight', 'sm')} → ${esc(d.name)}</span>`;
    const reload = () => loadOffers(d);
    bindOrigin('o-origin', reload);
    bindDates(document.getElementById('o-dates'), reload);
    bindGuests(document.getElementById('o-guests'), () => { clearTimeout(renderRoute.t); renderRoute.t = setTimeout(reload, 500); });
    document.getElementById('o-oneway').addEventListener('change', (e) => { s.oneWay = e.target.checked; saveSearch(); reload(); });
  };
  renderRoute();
  document.getElementById('save-dest').onclick = () => saveToTrip('destination', { ...destItem(d), subtitle: `${d.country} · ${continentName}` });
  document.getElementById('add-round').onclick = () => {
    const r = state.roundtrip;
    if (r.stops.some((x) => x.id === d.id)) return toast('Už je v okružní cestě.');
    r.stops.push({ id: d.id, name: d.name, detail: d.country, nights: 2 });
    state.search.tab = 'route';
    saveRoundtrip(); saveSearch();
    toast(`Přidáno do okružní cesty (${r.stops.length})`);
  };
  document.getElementById('go-offers').onclick = () => document.getElementById('route-bar').scrollIntoView({ behavior: 'smooth' });
  loadWeather(d);
  loadOffers(d);
}

async function loadWeather(d) {
  const card = document.getElementById('weather-card');
  try {
    const w = await api(`/destinations/${enc(d.id)}/weather`);
    if (w.current) document.getElementById('f-weather').textContent = `${w.current.temp} °C ${w.current.text}`;
    if (w.utcOffsetSeconds != null) {
      const diff = Math.round((w.utcOffsetSeconds / 60 + new Date().getTimezoneOffset()) / 60 * 10) / 10;
      document.getElementById('f-tz').textContent = diff === 0 ? 'Stejný čas' : `${diff > 0 ? '+' : ''}${String(diff).replace('.', ',')} h`;
    }
    card.innerHTML = `<h3>Předpověď pro ${esc(d.name)}</h3>
      <div class="weather">${w.days.map((x) => `<div><span>${DAYS[new Date(x.date).getDay()]} ${new Date(x.date).getDate()}.</span><div class="w-ico">${x.icon}</div><b>${x.max}°</b><span class="faint">${x.min}°</span></div>`).join('')}</div>
      <p class="small muted" style="margin-top:10px">Aktuální předpověď na 5 dní (Open-Meteo).</p>`;
  } catch {
    document.getElementById('f-weather')?.replaceChildren('—');
    document.getElementById('f-tz')?.replaceChildren('—');
    card.innerHTML = '<h3>Předpověď počasí</h3><p class="small muted" style="margin-top:8px">Počasí se teď nepodařilo načíst.</p>';
  }
}

async function loadOffers(d) {
  const s = state.search;
  const el = document.getElementById('offers');
  el.innerHTML = `<div class="offers">${'<div class="skeleton"></div>'.repeat(4)}</div>`;
  const my = (loadOffers.seq = (loadOffers.seq || 0) + 1);
  const data = await api(`/destinations/${enc(d.id)}/offers?${new URLSearchParams({ from: s.from, to: s.to, persons: s.persons, origin: s.origin, oneWay: s.oneWay ? '1' : '' })}`);
  if (my !== loadOffers.seq || !document.body.contains(el)) return;
  const { transport, lodging } = data.offers;
  const links = data.links || { transport: [], lodging: [] };
  const ctx = data.context;
  const spend = d.dailyCost * ctx.persons * ctx.nights;
  const t0 = transport[0]?.price || 0;
  const l0 = lodging[0]?.price || 0;
  const total = t0 + l0 + spend;
  const anyMock = [...transport, ...lodging].some((o) => o.mock);

  document.getElementById('summary').innerHTML = `
    <span class="eyebrow faint">Nejlevnější kombinace</span>
    <div class="big num">${czk(total)}</div>
    <div class="small muted">${plural(ctx.persons, 'osoba', 'osoby', 'osob')} · ${plural(ctx.nights, 'noc', 'noci', 'nocí')} · ${fmtRange(ctx.from, ctx.to)} · <b>${czk(total / ctx.persons)}</b> na osobu</div>
    <div class="bar" style="margin-top:14px"><span style="width:${(t0 / total) * 100}%;background:var(--coral)"></span><span style="width:${(l0 / total) * 100}%;background:var(--sky)"></span><span style="width:${(spend / total) * 100}%;background:var(--gold)"></span></div>
    <div class="legend">
      <div><i style="background:var(--coral)"></i>Doprava<b>${czk(t0)}</b></div>
      <div><i style="background:var(--sky)"></i>Ubytování<b>${czk(l0)}</b></div>
      <div><i style="background:var(--gold)"></i>Útrata na místě (odhad)<b>${czk(spend)}</b></div>
    </div>`;

  el.innerHTML = `
    <div class="toolbar">
      <div class="segmented" role="group" aria-label="Zobrazit">
        <button data-show="all" aria-pressed="true">Vše ${transport.length + lodging.length}</button>
        <button data-show="transport" aria-pressed="false">Jen doprava ${transport.length}</button>
        <button data-show="lodging" aria-pressed="false">Jen ubytování ${lodging.length}</button>
      </div>
      ${transport[0] ? `<span class="pill mint">Nejlevnější let od ${czk(transport[0].price / ctx.persons)} / os.</span>` : ''}
    </div>
    ${anyMock ? `<div class="notice">${ms('info')}<span>Některé ceny jsou <b>ukázkové</b>, protože pro ně ještě nejsou vložené API klíče. Tlačítka „Otevřít“ vedou na skutečné hledání u poskytovatele.</span></div>` : ''}
    ${data.errors?.length ? `<div class="notice">${ms('warning')}<span>Některé vyhledávače teď neodpověděly: ${data.errors.map((e) => esc(e.providerName)).join(', ')}.</span></div>` : ''}
    <section data-kind="transport">
      <div class="section-title"><span class="ico" style="background:var(--sky-soft);color:var(--sky)">${icon('flight', 'sm')}</span><h2 style="font-size:20px">Doprava z ${esc(ctx.originName)}</h2><span class="count">${plural(transport.length, 'nabídka', 'nabídky', 'nabídek')}</span></div>
      <div class="offers">${transport.map((o, i) => transportCard(o, i, ctx, d)).join('') || '<p class="muted">Pro tuto destinaci tu zatím nic nemáme.</p>'}</div>
      ${compareLinks(links.transport)}
    </section>
    <section data-kind="lodging">
      <div class="section-title"><span class="ico airbnb-ico">${AIRBNB_LOGO}</span><h2 style="font-size:20px">Airbnb v destinaci ${esc(d.name)}</h2><span class="count">${plural(lodging.length, 'nabídka', 'nabídky', 'nabídek')}</span></div>
      ${lodging.some((o) => o.mock) ? '<p class="small muted" style="margin:-4px 0 12px">Ukázkové nabídky – klik otevře Airbnb s tímto místem, termínem a počtem hostů. Skutečné inzeráty s fotkami a přímým odkazem se ukážou po vložení klíče SerpApi.</p>' : ''}
      <div class="bnb-grid">${lodging.map((o, i) => lodgingCard(o, i, d)).join('') || '<p class="muted">Pro tuto destinaci tu zatím nic nemáme.</p>'}</div>
      ${links.lodging[0] ? `<a class="btn glass" style="margin-top:14px" href="${esc(links.lodging[0].url)}" target="_blank" rel="noopener">Všechny nabídky v mapě Airbnb ${icon('arrow_outward', 'sm')}</a>` : ''}
    </section>`;

  el.querySelectorAll('[data-show]').forEach((b) => b.addEventListener('click', () => {
    el.querySelectorAll('[data-show]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    el.querySelectorAll('section[data-kind]').forEach((sec) => { sec.hidden = b.dataset.show !== 'all' && sec.dataset.kind !== b.dataset.show; });
  }));
  const all = [...transport, ...lodging];
  const saveOffer = (o) => saveToTrip(o.kind, { ...o, destinationId: d.id, destinationName: d.name, from: ctx.from, to: ctx.to, persons: ctx.persons, cc: d.cc, lat: d.lat, lng: d.lng });
  el.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); saveOffer(all.find((x) => x.id === b.dataset.save)); }));
  el.querySelectorAll('.offer a.btn').forEach((a) => a.addEventListener('click', (e) => e.stopPropagation()));
  el.querySelectorAll('[data-open]').forEach((c) => {
    const open = () => {
      const o = all.find((x) => x.id === c.dataset.open);
      transportDetail(o, ctx, d, saveOffer);
    };
    c.addEventListener('click', open);
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === c) open(); });
  });

  // Mapa: odkud → kam, ubytování jako špendlíky, trasa nejlevnějšího spoje
  const best = transport[0];
  const segs = (best?.legs || []).filter((l) => l.fromPt && l.toPt).map((l) => ({ from: l.fromPt, to: l.toPt, mode: l.mode, label: `${l.from} → ${l.to}` }));
  if (!segs.length && ctx.originPoint) segs.push({ from: [ctx.originPoint.lat, ctx.originPoint.lng], to: [d.lat, d.lng], mode: 'flight', label: `${ctx.originName} → ${d.name}` });
  drawMap(document.getElementById('dest-map'), {
    points: [
      ctx.originPoint && { lat: ctx.originPoint.lat, lng: ctx.originPoint.lng, label: ctx.originName, sub: 'Odjezd', kind: 'origin', color: '#3a3a3c' },
      { lat: d.lat, lng: d.lng, label: d.name, sub: d.country, num: ms('location_on'), color: '#111111' },
      ...lodging.filter((o) => o.location).map((o) => ({ lat: o.location.lat, lng: o.location.lng, label: o.title, sub: `${czk(o.price)} · ${o.providerName}`, kind: 'stay', color: '#3a3a3c' })),
    ].filter(Boolean),
    segments: segs,
  });
}

// ---------- Detail spoje ----------
function legsTimeline(legs) {
  if (!legs?.length) return '<p class="small muted">Podrobný jízdní řád ukáže poskytovatel po otevření nabídky.</p>';
  return `<ol class="legs">${legs.map((l, i) => {
    const st = MODE_STYLE[l.mode] || MODE_STYLE.car;
    const next = legs[i + 1];
    const wait = next?.depart && l.arrive ? legMinutes(l.arrive, next.depart) : null;
    return `<li class="leg" style="--c:${st.color}">
      <div class="leg-stop"><span class="t">${time(l.depart)}</span><span class="dot"></span><span><b>${esc(l.from)}</b>${l.fromCode ? ` <span class="code">${esc(l.fromCode)}</span>` : ''}<small>${dayLabel(l.depart)}</small></span></div>
      <div class="leg-ride"><span class="t"></span><span class="bar ${l.mode}"></span><span class="ride">${st.icon} <b>${esc(st.label)}</b>${l.carrier ? ` · ${esc(l.carrier)}` : ''}${l.number ? ` · ${esc(l.number)}` : ''}<small>${fmtMin(l.durationMin || (l.arrive ? legMinutes(l.depart, l.arrive) : 0))}${l.stopsNote ? ` · ${esc(l.stopsNote)}` : ''}${(l.extras || []).length ? ` · ${esc(l.extras.join(' · '))}` : ''}</small></span></div>
      <div class="leg-stop"><span class="t">${time(l.arrive)}</span><span class="dot"></span><span><b>${esc(l.to)}</b>${l.toCode ? ` <span class="code">${esc(l.toCode)}</span>` : ''}</span></div>
      ${wait != null && wait > 0 ? `<div class="transfer">${ms('sync_alt')} Přestup ${esc(l.to)} · ${fmtMin(wait)}${next.mode !== l.mode ? ` · ${esc(MODE_STYLE[l.mode]?.label || '')} → ${esc(MODE_STYLE[next.mode]?.label || '')}` : ''}</div>` : ''}
    </li>`;
  }).join('')}</ol>`;
}

function transportDetail(o, ctx, d, onSave) {
  const per = o.price / ctx.persons;
  const legs = [...(o.legs || []), ...(o.returnLegs || [])];
  modal(`
    <div class="detail-head">
      ${logo(o.providerName)}
      <div class="grow"><span class="small muted">${esc(o.providerName)}${o.mock ? ' · ukázková data' : ''}</span><h2>${ms(MODE_ICON[o.mode] || 'flight')} ${esc(o.title)}</h2><div class="small muted">${esc(o.subtitle)}</div></div>
      <button class="btn ghost sm icon-only" data-close aria-label="Zavřít">${icon('close', 'sm')}</button>
    </div>
    <div class="detail-price"><div><div class="price">${czk(per)}</div><span class="small muted">za osobu · ${esc(o.priceNote.split('·').pop().trim())}</span></div><div style="text-align:right"><b>${czk(o.price)}</b><span class="small muted" style="display:block">celkem za ${plural(ctx.persons, 'osobu', 'osoby', 'osob')}</span></div></div>
    <div class="map small-map" id="offer-map"></div>
    <h3 class="leg-title">Tam · ${dayLabel(o.legs?.[0]?.depart || ctx.from)}${o.durationMin ? ` · ${fmtMin(o.durationMin)}` : ''}</h3>
    ${o.legs?.[0]?.routable ? '<div id="own-route"><div class="skeleton" style="height:80px"></div></div>' : legsTimeline(o.legs)}
    ${o.returnLegs?.length && !o.own ? `<h3 class="leg-title">Zpět · ${dayLabel(o.returnLegs[0].depart)}</h3>${legsTimeline(o.returnLegs)}` : ''}
    <div class="tags" style="margin-top:12px">${o.details.map((x) => `<span class="pill">${esc(x)}</span>`).join('')}</div>
    ${discountNote(o, per, true)}
    ${searchLinksHtml(o)}
    <div class="modal-actions"><button class="btn glass" id="m-save">${icon('add', 'sm')} Do výletu</button><a class="btn sky" href="${esc(o.deepLink)}" target="_blank" rel="noopener">${o.own ? 'Otevřít v Google Maps' : (o.searchLinks?.[0]?.url === o.deepLink ? `Vyhledat spoj – ${esc(o.searchLinks[0].name.split(' – ')[0])}` : `Koupit u ${esc(o.providerName)}`)} ${icon('arrow_outward', 'sm')}</a></div>`, (m) => {
    m.querySelector('#m-save').onclick = () => onSave(o);
    const own = o.legs?.[0]?.routable ? o.legs[0] : null;
    if (own) {
      // Pěšky / autem: skutečná trasa po silnicích a stezkách + pokyny po krocích
      const box = m.querySelector('#own-route');
      const from = { lat: own.fromPt[0], lng: own.fromPt[1] }; const to = { lat: own.toPt[0], lng: own.toPt[1] };
      api(`/directions?${new URLSearchParams({ from: own.fromPt.join(','), to: own.toPt.join(','), mode: own.mode === 'walk' ? 'foot' : 'car' })}`).then((r) => {
        box.innerHTML = directionsHtml(r, from, to);
        drawMap(m.querySelector('#offer-map'), { points: [{ ...from, label: own.from, num: 'A', color: '#3a3a3c' }, { ...to, label: own.to, num: 'B' }], segments: [{ from: own.fromPt, to: own.toPt, mode: own.mode, path: r.geometry, label: `${own.from} → ${own.to}` }] });
      }).catch(() => { box.innerHTML = ''; });
    }
    const segs = legs.filter((l) => l.fromPt && l.toPt).map((l) => ({ from: l.fromPt, to: l.toPt, mode: l.mode, label: `${l.from} → ${l.to}` }));
    const stops = [];
    for (const l of o.legs || []) if (l.fromPt) stops.push({ lat: l.fromPt[0], lng: l.fromPt[1], label: l.from, sub: `odjezd ${time(l.depart)}` });
    const last = o.legs?.at(-1);
    if (last?.toPt) stops.push({ lat: last.toPt[0], lng: last.toPt[1], label: last.to, sub: `příjezd ${time(last.arrive)}` });
    if (segs.length) drawMap(m.querySelector('#offer-map'), { points: stops.map((p, i) => ({ ...p, num: i + 1, color: i === 0 ? '#3a3a3c' : i === stops.length - 1 ? '#111111' : '#ff9f0a' })), segments: segs });
    else if (ctx.originPoint) drawMap(m.querySelector('#offer-map'), { points: [{ lat: ctx.originPoint.lat, lng: ctx.originPoint.lng, label: ctx.originName, num: 1, color: '#3a3a3c' }, { lat: d.lat, lng: d.lng, label: d.name, num: 2 }], segments: [{ from: [ctx.originPoint.lat, ctx.originPoint.lng], to: [d.lat, d.lng], mode: MODE_STYLE[o.mode] ? o.mode : 'flight' }] });
  }, { wide: true });
}

const compareLinks = (links) => (links.length
  ? `<div class="compare-links"><span class="small muted">Porovnat i na:</span>${links.map((l) => `<a class="chip" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)} ${icon('arrow_outward')}</a>`).join('')}</div>` : '');

const stayEmoji = (o) => (/pokoj|hostel/i.test(o.title) ? 'bed' : /vila|dům|chata/i.test(o.title) ? 'cottage' : 'home');

// Sleva podle věku z profilu (jen vlaky a autobusy; u letenek se věkové slevy skoro nedávají).
function discountNote(o, per, long = false) {
  const disc = ageDiscount();
  if (!disc || !['train', 'bus', 'combo'].includes(o.mode)) return '';
  const after = Math.round(per * (1 - disc.pct / 100));
  return long ? `<div class="notice mint">${ms('confirmation_number')}<span>${esc(disc.label)}. Odhad pro tebe: <b>${czk(after)}</b> místo ${czk(per)}.</span></div>`
    : `<span class="pill mint" title="${esc(disc.label)}">${ms('confirmation_number')} ${disc.pct === 100 ? 'zdarma' : `−${disc.pct} % ≈ ${czk(after)}`}</span>`;
}
const searchLinksHtml = (o) => (o.searchLinks?.length
  ? `<div class="search-links"><span class="small muted">Tenhle spoj už vyhledaný na:</span>${o.searchLinks.map((l) => `<a class="chip" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)} ${icon('arrow_outward')}</a>`).join('')}</div>` : '');

function transportCard(o, i, ctx, d) {
  const per = o.price / ctx.persons;
  const direct = /přímý/i.test(o.subtitle);
  const duration = o.details.find((x) => /h|min/.test(x) && x.startsWith('~')) || '';
  const extra = o.details.filter((x) => x !== duration && !x.includes('→'));
  const legs = o.legs || [];
  return `<article class="card offer clickable" data-open="${esc(o.id)}" tabindex="0" aria-label="Podrobnosti: ${esc(o.title)}">
    <div class="offer-head">
      ${logo(o.providerName)}
      <div class="grow">
        <h3>${esc(o.title.replace(/^Let \S+ → \S+ · /, '') || o.providerName)}</h3>
        <div class="tagline"><span class="small muted">${esc(o.providerName)}</span>${i === 0 ? '<span class="pill coral">NEJLEVNĚJŠÍ</span>' : ''}${direct ? '<span class="pill mint">PŘÍMÝ</span>' : ''}${o.mock ? '<span class="pill">UKÁZKA</span>' : ''}</div>
      </div>
      <div class="amount"><div class="price">${czk(per)}</div><div class="small">za osobu · celkem ${czk(o.price)}</div></div>
    </div>
    <div class="flightline">
      <div class="code">${esc(time(legs[0]?.depart) || legs[0]?.fromCode || ctx.origin)}<small>${esc(legs[0]?.from || ctx.originName)}</small></div>
      <div class="mid"><span>${ms(MODE_ICON[o.mode] || 'flight')} ${esc(o.durationMin ? fmtMin(o.durationMin) : duration.replace('~', ''))}</span>
        <div class="line legline">${legs.map((l) => `<i class="seg ${l.mode}" style="flex:${Math.max(1, l.durationMin || 1)}" title="${esc(`${MODE_STYLE[l.mode]?.label || ''} ${l.from} → ${l.to}`)}"></i>`).join('')}</div>
        <span class="${direct ? 'direct' : ''}">${legs.length > 1 ? legs.map((l) => ms(MODE_STYLE[l.mode]?.icon || 'flight', 'sm')).join(' ') + ' · ' : ''}${esc(o.subtitle)}</span></div>
      <div class="code" style="text-align:right">${esc(time(legs.at(-1)?.arrive) || d.airport)}<small>${esc(legs.at(-1)?.to || d.name)}</small></div>
    </div>
    <div class="offer-foot">
      <div class="meta">${extra.map((x) => `<span>${esc(x)}</span>`).join('')}${discountNote(o, per)}</div>
      <div class="actions">
        <button class="btn glass sm" data-save="${esc(o.id)}">${icon('add', 'sm')} Do výletu</button>
        <span class="btn ghost sm">Podrobnosti</span>
        <a class="btn sky sm" href="${esc(o.deepLink)}" target="_blank" rel="noopener">Vybrat ${icon('arrow_outward', 'sm')}</a>
      </div>
    </div>
  </article>`;
}

// Karta Airbnb: klik vede přímo na inzerát (u ukázkových dat na hledání Airbnb ve stejném místě a termínu).
const ratingText = (o) => (o.rating ? `★ ${String(o.rating).replace('.', ',')}${o.reviews ? ` (${o.reviews})` : ''}` : 'Nové');
function lodgingCard(o, i, d) {
  const pics = o.photos?.length ? o.photos.slice(0, 5) : [];
  return `<a class="bnb" href="${esc(o.deepLink)}" target="_blank" rel="noopener" aria-label="${esc(o.title)} na Airbnb">
    <div class="bnb-photo" style="${cover(d.continent)}">
      ${pics.length ? `<div class="bnb-strip">${pics.map((u) => `<img src="${esc(u)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`).join('')}</div>`
        : `${photo(d.id, stayEmoji(o), d.name, 640)}<span class="bnb-note">${o.mock ? 'Foto destinace · ukázková nabídka' : 'Bez fotky'}</span>`}
      ${o.badges?.[0] ? `<span class="bnb-badge">${esc(o.badges[0])}</span>` : i === 0 ? '<span class="bnb-badge">Nejlevnější</span>' : ''}
      <button class="bnb-heart" data-save="${esc(o.id)}" aria-label="Uložit do výletu">${icon('favorite')}</button>
      ${pics.length > 1 ? `<span class="bnb-dots">${pics.map((_, k) => `<i class="${k ? '' : 'on'}"></i>`).join('')}</span>` : ''}
    </div>
    <div class="bnb-body">
      <div class="bnb-row"><b class="bnb-title">${esc(o.title)}</b><span class="bnb-rating">${ratingText(o)}</span></div>
      <span class="bnb-sub">${esc(o.subtitle)}</span>
      <span class="bnb-sub">${esc(o.details.slice(0, 3).join(' · '))}</span>
      <div class="bnb-price">${o.oldPrice ? `<s>${czk(o.oldPrice)}</s> ` : ''}<b>${czk(o.price)}</b> celkem <span>· ${esc(o.priceNote.split('·')[0].trim())}</span></div>
      <span class="bnb-open">${o.direct ? 'Otevřít inzerát na Airbnb' : 'Hledat na Airbnb v tomto místě'} ${icon('arrow_outward', 'sm')}</span>
    </div>
  </a>`;
}

// ---------- Okružní cesta ----------
const STOP_COLORS = ['#111111', '#3a3a3c', '#6e6e73'];

async function viewRoundtrip() {
  const r = state.roundtrip;
  const s = state.search;
  if (!r.stops.length) {
    $app.innerHTML = emptyState('map', 'Okružní cesta zatím nemá žádné zastávky.', '<a class="btn" href="#/">Naplánovat na hlavní stránce</a>');
    return;
  }
  $app.innerHTML = `<a href="#/" class="back">${icon('arrow_back', 'sm')} Upravit trasu</a>
    <section class="glass-card trip-head"><div><span class="eyebrow">Okružní cesta</span><h1>${esc([originName(), ...r.stops.map((x) => x.name)].join(' → '))}</h1>
    <p class="muted">Hledám spoje mezi zastávkami a ubytování v každé z nich…</p></div></section>
    <div class="route-layout"><div class="card map-card big"><div class="map" id="route-map"></div></div><div>${'<div class="skeleton" style="height:120px;margin-bottom:12px"></div>'.repeat(4)}</div></div>`;
  const plan = await api('/route-plan', { method: 'POST', body: { origin: s.origin, start: r.start, persons: s.persons, returnHome: r.returnHome, stops: r.stops.map((x) => ({ id: x.id, nights: x.nights })) } });
  const sel = { legs: plan.legs.map(() => 0), stays: plan.stays.map(() => 0) };
  const persons = plan.persons;

  const render = () => {
    const legCost = plan.legs.reduce((a, l, i) => a + (l.options[sel.legs[i]]?.price || 0), 0);
    const stayCost = plan.stays.reduce((a, st, i) => a + (st.options[sel.stays[i]]?.price || 0), 0);
    const total = legCost + stayCost;
    const nightsTotal = plan.stays.reduce((a, x) => a + x.nights, 0);
    const countries = [...new Set(plan.stays.map((x) => x.place.country).filter(Boolean))];
    let html = '';
    plan.legs.forEach((leg, i) => {
      const o = leg.options[sel.legs[i]];
      html += `<div class="rt-item leg-item">
        <span class="rt-dot" style="background:${MODE_STYLE[o?.legs?.[0]?.mode || o?.mode]?.color || '#8e8e93'}">${ms(MODE_ICON[o?.mode] || 'explore')}</span>
        <div class="card rt-card">
          <div class="rt-row"><div class="grow"><span class="eyebrow faint">${dayLabel(leg.date)} · ${leg.distanceKm.toLocaleString('cs-CZ')} km</span>
            <h3>${esc(leg.from.name)} → ${esc(leg.to.name)}</h3>
            ${o ? `<div class="small muted">${esc(o.title)} · ${esc(o.subtitle)}${o.legs?.length ? ` · ${time(o.legs[0].depart)} → ${time(o.legs.at(-1).arrive)}` : ''}</div>` : '<div class="small muted">Žádný spoj jsme nenašli – zkus odkazy níže.</div>'}</div>
            ${o ? `<div class="amount"><div class="price">${czk(o.price)}</div><span class="small faint">${czk(o.price / persons)} / os.</span></div>` : ''}</div>
          ${leg.options.length ? `<div class="opts">${leg.options.map((x, k) => `<button class="opt" data-leg="${i}" data-k="${k}" aria-pressed="${k === sel.legs[i]}">
            <span>${ms(MODE_ICON[x.mode] || 'flight')} ${esc(x.mode === 'flight' ? 'Let' : x.mode === 'combo' ? 'Kombinace' : x.mode === 'bus' ? 'Autobus' : 'Vlak')}</span><b>${czk(x.price)}</b><small>${fmtMin(x.durationMin)}${x.changes ? ` · ${plural(x.changes, 'přestup', 'přestupy', 'přestupů')}` : ' · přímo'}</small></button>`).join('')}
            ${o ? `<button class="opt more" data-detail-leg="${i}">Detail spoje →</button>` : ''}</div>` : ''}
          ${!leg.options.length && leg.links?.length ? compareLinks(leg.links) : ''}
        </div></div>`;
      const st = plan.stays[i];
      if (!st) return;
      const h = st.options[sel.stays[i]];
      html += `<div class="rt-item stay-item">
        <span class="rt-dot num" style="background:${STOP_COLORS[i % STOP_COLORS.length]}">${i + 1}</span>
        <div class="card rt-card">
          <div class="rt-row">
            <div class="rt-photo">${photo(st.place.id, st.place.emoji || '📍', st.place.name)}</div>
            <div class="grow"><span class="eyebrow faint">${dayLabel(st.from)} – ${dayLabel(st.to)} · ${plural(st.nights, 'noc', 'noci', 'nocí')}</span>
              <h3><a href="${dHref(st.place.id)}">${esc(st.place.name)}</a> <span class="small muted">${esc(st.place.country || '')}</span></h3>
              ${h ? `<div class="small muted">${ms('bed', 'sm')} ${esc(h.title)}${h.rating ? ` · ★ ${h.rating}` : ''} · ${esc(h.providerName)}</div>` : ''}</div>
            ${h ? `<div class="amount"><div class="price">${czk(h.price)}</div><span class="small faint">${esc(h.priceNote.split('·')[0])}</span></div>` : ''}
          </div>
          ${st.options.length ? `<div class="opts">${st.options.map((x, k) => `<button class="opt" data-stay="${i}" data-k="${k}" aria-pressed="${k === sel.stays[i]}"><span>${ms(stayEmoji(x))} ${esc(x.title.length > 26 ? `${x.title.slice(0, 24)}…` : x.title)}</span><b>${czk(x.price)}</b><small>${esc(x.providerName)}${x.rating ? ` · ★ ${x.rating}` : ''}</small></button>`).join('')}
            ${h ? `<a class="opt more" href="${esc(h.deepLink)}" target="_blank" rel="noopener">Otevřít na Airbnb →</a>` : ''}</div>` : ''}
        </div></div>`;
    });

    $app.innerHTML = `<a href="#/" class="back">${icon('arrow_back', 'sm')} Upravit trasu</a>
      <section class="glass-card trip-head">
        <div>
          <div class="badges"><span class="pill">${icon('calendar_today', 'sm')} ${fmtRange(plan.start, plan.end)}</span><span class="pill sky">${icon('group', 'sm')} ${plural(persons, 'osoba', 'osoby', 'osob')}</span><span class="pill mint">${plural(plan.stays.length, 'zastávka', 'zastávky', 'zastávek')} · ${plural(countries.length, 'země', 'země', 'zemí')}</span></div>
          <h1>${esc([plan.origin.name, ...plan.stays.map((x) => x.place.name), ...(plan.returnHome ? [plan.origin.name] : [])].join(' → '))}</h1>
          <div class="actions"><button class="btn" id="rt-save">${icon('favorite')} Uložit jako výlet</button><button class="btn glass" id="rt-cheap">Vybrat nejlevnější</button><button class="btn glass" id="rt-fast">⚡ Vybrat nejrychlejší</button></div>
        </div>
        <div class="budget"><div><span class="eyebrow faint">Doprava + ubytování</span><div class="price" style="font-size:26px">${czk(total)}</div>
          <div class="small muted">${czk(total / persons)} na osobu · ${plural(nightsTotal, 'noc', 'noci', 'nocí')}</div>
          <div class="bar" style="margin-top:10px;width:220px"><span style="width:${total ? (legCost / total) * 100 : 0}%;background:var(--coral)"></span><span style="width:${total ? (stayCost / total) * 100 : 0}%;background:var(--sky)"></span></div>
          <div class="small faint" style="margin-top:6px">Doprava ${czk(legCost)} · Ubytování ${czk(stayCost)}</div></div></div>
      </section>
      <div class="route-layout">
        <div class="card map-card big sticky"><div class="map" id="route-map"></div></div>
        <div class="rt-timeline">
          <div class="rt-item"><span class="rt-dot" style="background:var(--text)">${ms('home')}</span><div class="rt-start"><b>Start: ${esc(plan.origin.name)}</b><span class="small muted">${dayLabel(plan.start)}</span></div></div>
          ${html}
          ${plan.returnHome ? `<div class="rt-item"><span class="rt-dot" style="background:var(--text)">${ms('flag')}</span><div class="rt-start"><b>Doma: ${esc(plan.origin.name)}</b><span class="small muted">${dayLabel(plan.end)}</span></div></div>` : ''}
        </div>
      </div>`;

    // Mapa – zastávky očíslované, úseky barevně podle dopravy
    const segments = [];
    plan.legs.forEach((leg, i) => {
      const o = leg.options[sel.legs[i]];
      const parts = (o?.legs || []).filter((l) => l.fromPt && l.toPt);
      if (parts.length) parts.forEach((l) => segments.push({ from: l.fromPt, to: l.toPt, mode: l.mode, label: `${dayLabel(l.depart)} ${l.from} → ${l.to}` }));
      else segments.push({ from: [leg.from.lat, leg.from.lng], to: [leg.to.lat, leg.to.lng], mode: o?.mode === 'flight' ? 'flight' : o?.mode || 'car', label: `${leg.from.name} → ${leg.to.name}` });
    });
    drawMap(document.getElementById('route-map'), {
      points: [
        { lat: plan.origin.lat, lng: plan.origin.lng, label: plan.origin.name, sub: `Start ${dayLabel(plan.start)}`, kind: 'origin', color: '#3a3a3c' },
        ...plan.stays.map((st, i) => ({ lat: st.place.lat, lng: st.place.lng, num: i + 1, color: STOP_COLORS[i % STOP_COLORS.length], label: st.place.name, sub: `${dayLabel(st.from)} – ${dayLabel(st.to)} · ${plural(st.nights, 'noc', 'noci', 'nocí')}` })),
        ...plan.stays.map((st, i) => st.options[sel.stays[i]]?.location && ({ ...st.options[sel.stays[i]].location, kind: 'stay', label: st.options[sel.stays[i]].title, color: STOP_COLORS[i % STOP_COLORS.length] })).filter(Boolean),
      ],
      segments,
    });

    $app.querySelectorAll('[data-leg]').forEach((b) => b.addEventListener('click', () => { sel.legs[b.dataset.leg] = Number(b.dataset.k); render(); }));
    $app.querySelectorAll('[data-stay]').forEach((b) => b.addEventListener('click', () => { sel.stays[b.dataset.stay] = Number(b.dataset.k); render(); }));
    const legCtx = (leg) => ({ persons, nights: 1, from: leg.date, to: leg.date, originName: leg.from.name, originPoint: { lat: leg.from.lat, lng: leg.from.lng } });
    $app.querySelectorAll('[data-detail-leg]').forEach((b) => b.addEventListener('click', () => {
      const leg = plan.legs[b.dataset.detailLeg];
      transportDetail(leg.options[sel.legs[b.dataset.detailLeg]], legCtx(leg), leg.to, () => toast('Celou trasu ulož tlačítkem „Uložit jako výlet“.'));
    }));
    const pickBy = (fn) => {
      plan.legs.forEach((l, i) => { const best = [...l.options].sort(fn)[0]; sel.legs[i] = Math.max(0, l.options.indexOf(best)); });
      render();
    };
    document.getElementById('rt-cheap').onclick = () => { plan.stays.forEach((st, i) => { sel.stays[i] = 0; }); pickBy((a, b) => a.price - b.price); };
    document.getElementById('rt-fast').onclick = () => pickBy((a, b) => (a.durationMin || 1e9) - (b.durationMin || 1e9));
    document.getElementById('rt-save').onclick = async () => {
      if (!state.user) { sessionStorage.setItem('tf_after_login', '#/route'); toast('Pro uložení se přihlas.'); location.hash = '#/login'; return; }
      const items = [];
      plan.legs.forEach((leg, i) => {
        const o = leg.options[sel.legs[i]];
        if (o) items.push({ kind: 'transport', data: { ...o, title: `${leg.from.name} → ${leg.to.name}`, subtitle: `${o.title} · ${o.subtitle}`, from: leg.date, to: leg.date, persons } });
        const st = plan.stays[i];
        if (!st) return;
        items.push({ kind: 'destination', data: { destinationId: st.place.id, title: st.place.name, name: st.place.name, subtitle: `${st.place.country || ''} · ${plural(st.nights, 'noc', 'noci', 'nocí')}`, emoji: st.place.emoji || '📍', cc: st.place.cc, lat: st.place.lat, lng: st.place.lng, from: st.from, to: st.to } });
        const h = st.options[sel.stays[i]];
        if (h) items.push({ kind: 'lodging', data: { ...h, destinationId: st.place.id, destinationName: st.place.name, from: st.from, to: st.to, persons } });
      });
      try {
        const res = await api('/trips', { method: 'POST', body: { title: `Okruh: ${plan.stays.map((x) => x.place.name).join(', ')}`.slice(0, 120), start_date: plan.start, end_date: plan.end, persons, items } });
        toast('Okružní cesta uložena');
        location.hash = `#/trips/${res.trip.id}`;
      } catch (e) { toast(e.message); }
    };
  };
  render();
}

// ---------- Mapa výletu ----------
function tripMapData(items) {
  const points = []; const segments = [];
  let n = 0;
  for (const it of items) {
    const d = it.data;
    if (it.kind === 'destination') {
      const cat = state.all.find((x) => x.id === d.destinationId);
      const lat = d.lat ?? cat?.lat; const lng = d.lng ?? cat?.lng;
      if (Number.isFinite(lat)) points.push({ lat, lng, num: ++n, color: STOP_COLORS[(n - 1) % STOP_COLORS.length], label: d.title, sub: d.from ? fmtRange(d.from, d.to) : d.subtitle });
    } else if (it.kind === 'lodging' && d.location) {
      points.push({ ...d.location, kind: 'stay', label: d.title, sub: d.from ? fmtRange(d.from, d.to) : '' });
    } else if (it.kind === 'note' && Number.isFinite(d.lat)) {
      points.push({ lat: d.lat, lng: d.lng, label: d.title, sub: d.place || '', color: '#6e6e73', num: ms('location_on') });
    } else if (it.kind === 'transport') {
      for (const l of [...(d.legs || []), ...(d.returnLegs || [])]) if (l.fromPt && l.toPt) segments.push({ from: l.fromPt, to: l.toPt, mode: l.mode, label: `${dayLabel(l.depart)} ${l.from} → ${l.to}` });
    }
  }
  return { points, segments };
}

// ---------- Prozkoumat: seznam míst vlevo, mapa vpravo ----------
const EXPLORE_CATS = {
  all: [ms('explore'), 'Všechna místa'], gems: [ms('diamond'), 'Hidden gems'], trend: [ms('trending_up'), 'Trendy'], sight: [ms('account_balance'), 'Památky'],
  nature: [ms('park'), 'Příroda'], culture: [ms('theater_comedy'), 'Kultura'], other: [ms('location_on'), 'Ostatní'], dest: [ms('luggage'), 'Destinace'],
};
const exploreState = { cat: 'all', places: [], gems: [], view: null, area: '' };
// Odpovědi pro výřezy mapy si pamatujeme, aby se při posunu zpět nic znovu nenačítalo.
const exploreCache = new Map();
const cachedApi = (url) => {
  if (!exploreCache.has(url)) {
    exploreCache.set(url, api(url).catch((e) => { exploreCache.delete(url); throw e; }));
    if (exploreCache.size > 120) exploreCache.delete(exploreCache.keys().next().value);
  }
  return exploreCache.get(url);
};

async function viewExplore() {
  $app.innerHTML = `
    <section class="ex">
      <div class="ex-head">
        <div class="ex-loc"><span class="ex-loc-ic">${ms('location_on')}</span><div><h1 class="h-md" id="ex-title">${esc(exploreState.area || 'Prozkoumat')}</h1><span class="small muted" id="ex-count">Místa, hidden gems a trendy na mapě</span></div></div>
        <div class="search-pill ac-wrap">${ms('search')}<input id="ex-q" placeholder="Hledat město, vyhlídku, horu…" aria-label="Hledat místo"></div>
      </div>
      <div class="chips ex-cats">${Object.entries(EXPLORE_CATS).filter(([k]) => k !== 'dest').map(([k, [, l]]) => `<button class="chip" data-cat="${k}" aria-pressed="${exploreState.cat === k}">${l}</button>`).join('')}</div>
      <div class="ex-grid">
        <div class="ex-list" id="ex-panel"></div>
        <div class="ex-mapwrap">
          <div class="explore-map" id="explore-map"></div>
          <button class="map-chip" id="ex-locate">${ms('my_location', 'sm')} Moje poloha</button>
          <div class="map-float" id="ex-float" hidden></div>
        </div>
      </div>
    </section>`;
  const L = await loadLeaflet().catch(() => null);
  const el = document.getElementById('explore-map');
  if (!L || !el) { if (el) el.innerHTML = '<div class="map-fallback">Mapu se nepodařilo načíst.</div>'; return; }
  const map = L.map(el, { zoomControl: false, worldCopyJump: true, ...touchMapOptions() });
  twoFingerHint(el);
  L.control.zoom({ position: 'topright' }).addTo(map);
  baseTiles(L, map, { withLayers: true, extraAttr: ' · místa: Wikipedie, OSM, Reddit' });
  map._tfPad = () => ({ padding: [40, 40] });
  const v = exploreState.view;
  if (v) map.setView(v.center, v.zoom); else map.fitBounds([[36, -10], [60, 30]]);
  if ('ResizeObserver' in window) new ResizeObserver(() => map.invalidateSize()).observe(el);
  const fly = (lat, lng, zoom) => map.flyTo([lat, lng], zoom, { duration: 0.8 });

  const layer = L.layerGroup().addTo(map);
  const routeLayer = L.layerGroup().addTo(map);
  const panel = document.getElementById('ex-panel');
  const float = document.getElementById('ex-float');
  let seq = 0; let timer = 0; let selected = null;
  const catOf = (p) => EXPLORE_CATS[p.gem ? 'gems' : p.category] || EXPLORE_CATS.other;
  const catLabel = (p) => (p.gem ? 'Hidden gem' : catOf(p)[1]);

  const pin = (p) => L.divIcon({
    className: `photo-pin${p.gem ? ' gem' : ''}${selected?.id === p.id ? ' sel' : ''}`,
    html: `<span>${p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${catOf(p)[0]}</span>`,
    iconSize: [40, 40], iconAnchor: [20, 20],
  });
  const visible = () => {
    const all = [...exploreState.places, ...exploreState.gems];
    if (exploreState.cat === 'all') return all;
    if (exploreState.cat === 'gems') return exploreState.gems;
    if (exploreState.cat === 'trend') return [];
    return all.filter((p) => p.category === exploreState.cat);
  };
  const trendHtml = (t, title = 'Trendy na sítích') => (t?.posts?.length ? `<div class="card bento trend-box"><div class="card-head"><h3>${ms('trending_up', 'sm')} ${esc(title)}${t.place ? ` · ${esc(t.place)}` : ''}</h3><span class="small muted">${esc(t.source || '')}</span></div>
      ${t.posts.slice(0, 8).map((x) => `<a class="trend-row" href="${esc(x.url)}" target="_blank" rel="noopener">${x.thumb ? `<img src="${esc(x.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span class="ti">${ms('forum')}</span>`}
        <span class="grow"><b>${esc(x.title)}</b><small>${esc(x.sub)} · ${x.score} bodů · ${x.comments} koment. · ${esc(x.created)}</small></span></a>`).join('')}</div>`
    : t?.unavailable ? '<p class="small muted empty-line">Trendy ze sítí se teď nepodařilo načíst.</p>' : t ? '<p class="small muted empty-line">O tomhle místě se teď na sítích moc nepíše. Možná právě proto stojí za to.</p>' : '');
  let areaTrend = null;

  const addBtn = (p, big) => `<button class="btn ${big ? '' : 'soft '}sm" data-add="${esc(p.id)}">${ms('add', 'sm')} ${big ? 'Přidat do itineráře' : 'Přidat'}</button>`;
  const placeCard = (p, i) => (i === 0 ? `<article class="card place-big" data-pid="${esc(p.id)}">
      <div class="pb-img">${p.thumb ? `<img src="${esc(p.image || p.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${catOf(p)[0]}</div>
      <div class="pb-body"><div class="row-between"><span class="eyebrow">${esc(catLabel(p))}</span>${p.gem ? '<span class="tag">Méně známé</span>' : ''}</div>
        <h3 class="h-sm">${esc(p.title)}</h3>${p.description ? `<p class="muted">${esc(p.description)}</p>` : ''}
        <div class="pb-foot"><span class="small muted">${ms('near_me', 'sm')} Zobrazit na mapě</span>${addBtn(p, true)}</div></div></article>`
    : `<article class="card place-row" data-pid="${esc(p.id)}">
      <div class="pr-img">${p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${catOf(p)[0]}</div>
      <div class="pr-body"><span class="eyebrow">${esc(catLabel(p))}</span><h3 class="h-sm">${esc(p.title)}</h3>${p.description ? `<p class="small muted ellipsis-2">${esc(p.description)}</p>` : ''}
        <div class="pr-foot">${addBtn(p)}</div></div></article>`);

  const renderList = () => {
    if (!panel.isConnected || panel.dataset.mode === 'detail') return;
    const list = visible();
    const zoomedOut = map.getZoom() < 9;
    panel.dataset.mode = 'list';
    const trendOnly = exploreState.cat === 'trend';
    document.getElementById('ex-title').textContent = zoomedOut ? 'Svět' : exploreState.area || 'Okolí mapy';
    document.getElementById('ex-count').textContent = zoomedOut ? 'Přibliž mapu a uvidíš místa s fotkami' : trendOnly ? 'Co se teď sdílí na sítích' : plural(list.length, 'zajímavé místo', 'zajímavá místa', 'zajímavých míst');
    panel.innerHTML = `${!zoomedOut && trendOnly ? `<div id="area-trend">${areaTrend ? trendHtml(areaTrend) : '<div class="skeleton" style="height:160px"></div>'}</div>` : ''}
      ${list.slice(0, 30).map(placeCard).join('') || (trendOnly ? '' : '<p class="small muted empty-line">Tady nic nemáme. Zkus jinou kategorii nebo posuň mapu.</p>')}
      ${!zoomedOut && !trendOnly && exploreState.cat === 'all' && areaTrend?.posts?.length ? `<div id="area-trend">${trendHtml(areaTrend)}</div>` : ''}`;
    panel.querySelectorAll('[data-pid]').forEach((b) => b.addEventListener('click', (e) => {
      const p = visible().find((x) => x.id === b.dataset.pid);
      if (e.target.closest('[data-add]')) { addPlace(p); return; }
      select(p, true);
    }));
  };
  const addPlace = (p) => {
    if (!p) return;
    if (p.destId) { const d = state.all.find((x) => x.id === p.destId); if (d) saveToTrip('destination', destItem(d)); return; }
    saveToTrip('note', { title: p.title, note: p.description || '', category: p.category === 'nature' ? 'activity' : 'sight', lat: p.lat, lng: p.lng, image: p.thumb || null });
  };
  const select = (p, flyTo) => {
    if (!p) return;
    selected = p; renderPins();
    if (flyTo) fly(p.lat, p.lng, Math.max(map.getZoom(), p.destId ? 11 : 14));
    float.hidden = false;
    float.innerHTML = `<span class="mf-ic">${catOf(p)[0]}</span><div class="grow"><b class="ellipsis">${esc(p.title)}</b><small class="muted ellipsis">${esc(catLabel(p))}${p.description ? ` • ${esc(p.description)}` : ''}</small></div><button class="btn sm" id="mf-open">Otevřít detail ${ms('arrow_forward', 'sm')}</button>`;
    document.getElementById('mf-open').onclick = () => openPlace(p);
  };
  const renderPins = () => {
    layer.clearLayers();
    // Piny se nesmí překrývat: na malém přiblížení necháme jen ty, které mají kolem sebe místo.
    const kept = []; const shown = []; const gap = 40;
    for (const p of visible()) {
      const pt = map.latLngToContainerPoint([p.lat, p.lng]);
      if (kept.some((k) => Math.abs(k.x - pt.x) < gap && Math.abs(k.y - pt.y) < gap)) continue;
      kept.push(pt); shown.push(p);
      if (shown.length >= 90) break;
    }
    for (const p of shown) L.marker([p.lat, p.lng], { icon: pin(p), riseOnHover: true, zIndexOffset: selected?.id === p.id ? 1000 : 0 }).on('click', () => select(p)).addTo(layer);
  };

  const load = async () => {
    exploreState.view = { center: map.getCenter(), zoom: map.getZoom() };
    const my = ++seq;
    if (map.getZoom() < 9) {
      exploreState.gems = []; areaTrend = null;
      exploreState.places = state.all.map((d) => ({ id: `dest:${d.id}`, destId: d.id, title: d.name, description: d.country, lat: d.lat, lng: d.lng, category: 'dest', thumb: photoSrc(d.id, 320) }));
      renderPins(); renderList();
      return;
    }
    panel.classList.add('loading');
    const c = map.getCenter();
    // Souřadnice zaokrouhlené na mřížku ~2 km – stejné výřezy sdílí mezipaměť prohlížeče i serveru.
    const q = new URLSearchParams({ lat: (Math.round(c.lat * 50) / 50).toFixed(2), lng: (Math.round(c.lng * 50) / 50).toFixed(2), radius: map.getZoom() >= 13 ? 3000 : 10000 });
    const wiki = cachedApi(`/explore?${q}`).then(({ places }) => {
      if (my !== seq) return;
      exploreState.places = places; renderPins(); renderList();
    }).catch((e) => toast(e.message));
    const gemsP = map.getZoom() >= 10 ? cachedApi(`/explore/gems?${q}`).then(({ places }) => {
      if (my !== seq) return;
      exploreState.gems = places; renderPins(); renderList();
    }).catch(() => {}) : (exploreState.gems = [], null);
    const tq = new URLSearchParams({ lat: c.lat.toFixed(1), lng: c.lng.toFixed(1) });
    cachedApi(`/explore/trending?${tq}`).then((t) => {
      if (my !== seq) return;
      areaTrend = t;
      if (t?.place && !exploreState.areaLocked) exploreState.area = t.place;
      renderList();
    }).catch(() => {});
    await Promise.allSettled([wiki, gemsP]);
    if (my === seq) panel.classList.remove('loading');
  };
  map.on('moveend', () => { clearTimeout(timer); timer = setTimeout(load, 350); });
  map.on('dragstart', () => { exploreState.areaLocked = false; });

  async function openPlace(p) {
    if (!p) return;
    panel.dataset.mode = 'detail';
    panel.innerHTML = '<div class="card bento"><div class="skeleton" style="height:220px"></div><div class="skeleton" style="height:80px;margin-top:12px"></div></div>';
    if (window.innerWidth < 900) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    let info = { title: p.title, description: p.description, extract: '', image: p.image || p.thumb, url: null };
    if (p.gem) {
      info = { ...info, extract: 'Méně známé místo z OpenStreetMap. Nemá ani článek na Wikipedii, takže tu nebývají davy.', osm: p.osm, photoPage: p.photoPage };
    } else if (!p.destId) {
      const [lang] = p.id.split(':');
      info = await api(`/explore/place?${new URLSearchParams({ lang, title: p.title })}`).catch(() => info) || info;
    } else {
      const d = state.all.find((x) => x.id === p.destId);
      info = { title: d.name, description: d.country, extract: d.description, image: photoSrc(d.id, 960) };
    }
    const geo = p.destId || `geo:${p.lat.toFixed(4)},${p.lng.toFixed(4)},,${p.title}`;
    panel.innerHTML = `<article class="card bento place-detail">
        <button class="btn ghost sm" id="ex-back">${ms('arrow_back', 'sm')} Zpět na seznam</button>
        <div class="place-hero">${info.image ? `<img src="${esc(info.image)}" alt="${esc(info.title)}" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${catOf(p)[0]}</div>
        <span class="eyebrow">${esc(catLabel(p))}</span>
        <h2 class="h-md">${esc(info.title)}</h2>
        ${info.description ? `<p class="small muted">${esc(info.description)}</p>` : ''}
        ${info.extract ? `<p class="extract">${esc(info.extract)}</p>` : ''}
        <div class="place-actions">
          <button class="btn" id="ex-add">${ms('add', 'sm')} Přidat do itineráře</button>
          <button class="btn soft" id="ex-nav">${ms('directions', 'sm')} Navigovat sem</button>
          <a class="btn soft" href="${dHref(geo)}">${ms('flight', 'sm')} Spoje a ubytování</a>
        </div>
        <div class="place-links">
          ${info.url ? `<a href="${esc(info.url)}" target="_blank" rel="noopener">Wikipedie ${ms('arrow_outward', 'sm')}</a>` : ''}
          ${info.osm ? `<a href="${esc(info.osm)}" target="_blank" rel="noopener">OpenStreetMap ${ms('arrow_outward', 'sm')}</a>` : ''}
          ${info.photoPage ? `<a href="${esc(info.photoPage)}" target="_blank" rel="noopener">Autor fotky ${ms('arrow_outward', 'sm')}</a>` : ''}
        </div>
        <div id="ex-route"></div>
        <div id="ex-trend"></div>
      </article>`;
    document.getElementById('ex-back').onclick = () => { panel.dataset.mode = 'list'; routeLayer.clearLayers(); renderList(); };
    document.getElementById('ex-add').onclick = () => addPlace(p);
    const tbox = document.getElementById('ex-trend');
    cachedApi(`/explore/trending?${new URLSearchParams({ q: info.title })}`).then((t) => { if (tbox.isConnected) tbox.innerHTML = trendHtml(t, 'Co o tom píšou lidé'); }).catch(() => {});
    document.getElementById('ex-nav').onclick = () => navigateForm(document.getElementById('ex-route'), { lat: p.lat, lng: p.lng, name: info.title }, routeLayer, map);
  }

  document.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
    exploreState.cat = b.dataset.cat;
    document.querySelectorAll('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    renderPins(); panel.dataset.mode = 'list'; renderList();
  }));
  autocomplete(document.getElementById('ex-q'), {
    onSelect: (r) => {
      exploreState.area = r.name; exploreState.areaLocked = true;
      fly(r.lat, r.lng, r.kind === 'address' ? 15 : 13);
    },
  });
  document.getElementById('ex-locate').onclick = () => myPosition().then((p) => { exploreState.area = 'Moje okolí'; exploreState.areaLocked = true; fly(p.lat, p.lng, 14); }).catch((e) => toast(e.message));
  load();
}

const myPosition = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) { reject(new Error('Prohlížeč neumí zjistit polohu.')); return; }
  navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, name: 'Moje poloha' }),
    () => reject(new Error('Polohu se nepodařilo zjistit – povol ji v prohlížeči.')), { enableHighAccuracy: true, timeout: 10000 });
});

// Formulář „Navigovat sem“: odkud, pěšky / autem, trasa na mapě a pokyny po krocích.
function navigateForm(box, to, routeLayer, map) {
  let from = null; let mode = 'foot';
  box.innerHTML = `<div class="nav-form">
    <div class="dock-field ac-wrap"><label for="nav-from">Odkud</label><input id="nav-from" placeholder="Adresa, město… nebo moje poloha"></div>
    <div class="segmented mode-toggle" role="group"><button data-mode="foot" aria-pressed="true">${ms('directions_walk')} Pěšky</button><button data-mode="car" aria-pressed="false">${ms('directions_car')} Autem</button></div>
    <button class="btn glass sm" id="nav-me">${ms('my_location')} Moje poloha</button>
  </div><div id="nav-result"></div>`;
  const km = (a, b) => 111 * Math.hypot(a.lat - b.lat, (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180));
  const run = async () => {
    if (!from) return;
    // Daleko na pěší túru – rovnou autem.
    if (mode === 'foot' && km(from, to) > 40) {
      mode = 'car';
      box.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.mode === 'car'));
      toast('Je to přes 40 km, tak počítám trasu autem.');
    }
    const out = box.querySelector('#nav-result');
    out.innerHTML = '<div class="skeleton" style="height:90px;margin-top:12px"></div>';
    try {
      const r = await api(`/directions?${new URLSearchParams({ from: `${from.lat},${from.lng}`, to: `${to.lat},${to.lng}`, mode })}`);
      out.innerHTML = directionsHtml(r, from, to);
      if (routeLayer && map) {
        const L = window.L;
        routeLayer.clearLayers();
        const st = MODE_STYLE[mode === 'foot' ? 'walk' : 'car'];
        L.polyline(r.geometry, { color: '#fff', weight: 9, opacity: 0.9 }).addTo(routeLayer);
        const line = L.polyline(r.geometry, { color: st.color, weight: 5, dashArray: st.dash }).addTo(routeLayer);
        L.marker([from.lat, from.lng], { icon: L.divIcon({ className: 'map-pin', html: '<span class="pin" style="--c:#3a3a3c">A</span>', iconSize: [32, 32], iconAnchor: [16, 16] }) }).addTo(routeLayer);
        L.marker([to.lat, to.lng], { icon: L.divIcon({ className: 'map-pin', html: '<span class="pin" style="--c:#111111">B</span>', iconSize: [32, 32], iconAnchor: [16, 16] }) }).addTo(routeLayer);
        map.fitBounds(line.getBounds(), map._tfPad?.() || { padding: [60, 60] });
      }
    } catch (e) { out.innerHTML = `<p class="small muted" style="margin-top:10px">${esc(e.message)}</p>`; }
  };
  const useMe = () => myPosition().then((p) => { from = p; box.querySelector('#nav-from').value = 'Moje poloha'; run(); }).catch((e) => toast(e.message));
  autocomplete(box.querySelector('#nav-from'), {
    suggestions: () => [{ id: 'me', kind: 'me', name: 'Moje poloha', detail: 'Použít polohu telefonu', icon: 'my_location' }],
    onSelect: (r) => {
      if (r.kind === 'me') { useMe(); return; }
      from = { lat: r.lat, lng: r.lng, name: r.name };
      run();
    },
  });
  box.querySelector('#nav-me').onclick = useMe;
  box.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    box.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    run();
  }));
}

function directionsHtml(r, from, to) {
  const travel = r.mode === 'foot' ? 'walking' : 'driving';
  const gmaps = `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=${travel}`;
  return `<div class="nav-summary ${r.mode}">
      <span class="big">${ms(r.mode === 'foot' ? 'directions_walk' : 'directions_car')}</span>
      <div><b>${fmtMin(r.durationMin) || 'pár minut'}</b><span>${String(r.distanceKm).replace('.', ',')} km${r.approx ? ' · odhad vzdušnou čarou' : ''}</span></div>
      <a class="btn sm" href="${gmaps}" target="_blank" rel="noopener">Spustit navigaci ${icon('arrow_outward', 'sm')}</a>
    </div>
    ${r.steps?.length ? `<ol class="steps">${r.steps.map((s) => `<li><span>${esc(s.text)}</span><small>${s.distanceM >= 1000 ? `${(s.distanceM / 1000).toFixed(1).replace('.', ',')} km` : `${s.distanceM} m`}</small></li>`).join('')}</ol>`
      : `<p class="small faint" style="margin-top:8px">${r.approx ? 'Podrobnou trasu teď nešlo spočítat – navigace v Google Maps ji ukáže.' : ''}</p>`}`;
}

// ---------- Cestovatelský pas ----------
async function passportBlock() {
  try {
    const { stamps } = await api('/me/stamps');
    return `<section class="passport">
      <div class="passport-head"><div><span class="eyebrow">Cestovatelský pas</span><h2>${stamps.length ? `${plural(stamps.length, 'země', 'země', 'zemí')} v pasu` : 'Zatím prázdný pas'}</h2></div>
        <span class="small muted">${stamps.length ? 'Razítko dostaneš za každou zemi z výletu, který označíš jako dokončený.' : 'Dokonči výlet (tlačítko „Dokončit výlet“ v plánovači) a získáš razítko každé navštívené země.'}</span></div>
      <div class="stamps">${stamps.map((x, i) => `<div class="stamp" title="${esc(`${x.country} – ${x.tripTitle}`)}" style="--rot:${((i * 37) % 13) - 6}deg">${stampSvg(x)}<span class="small muted">${esc(x.place || x.country)}</span></div>`).join('')
        || `<div class="stamp ghost-stamp">${stampSvg({ cc: 'CZ', country: 'Tvoje první země', date: '' })}</div>`}</div>
    </section>`;
  } catch { return ''; }
}

// Uložení položky do výletu (výběr existujícího nebo založení nového).
async function saveToTrip(kind, data, onSaved) {
  if (!state.user) {
    toast('Pro ukládání výletů se přihlas.');
    sessionStorage.setItem('tf_after_login', location.hash);
    location.hash = '#/login';
    return;
  }
  const { trips } = await api('/trips');
  const editable = trips.filter((t) => t.role !== 'viewer');
  modal(`
    <h2>Uložit do výletu</h2>
    <p class="small muted" style="margin-top:4px">${esc(data.title)}${data.price ? ` · ${czk(data.price)}` : ''}</p>
    ${editable.length ? `<div class="list">${editable.map((t) => `<button class="btn glass" data-trip="${t.id}"><span>${esc(t.title)}</span><span class="small faint">${plural(t.item_count, 'položka', 'položky', 'položek')}</span></button>`).join('')}</div>` : ''}
    <form id="newtrip" style="margin-top:12px">
      <div><label for="nt-title">${editable.length ? 'Nebo založ nový výlet' : 'Založ nový výlet'}</label>
      <input id="nt-title" name="title" placeholder="např. Léto v Itálii" value="${editable.length ? '' : esc(data.destinationName || data.title)}" required></div>
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Zrušit</button><button class="btn">${icon('add', 'sm')} Vytvořit a uložit</button></div>
    </form>`, (m, close) => {
    const add = async (tripId) => {
      await api(`/trips/${tripId}/items`, { method: 'POST', body: { kind, data } });
      close();
      onSaved?.();
      toast('Uloženo do výletu');
    };
    m.querySelectorAll('[data-trip]').forEach((b) => b.addEventListener('click', () => add(b.dataset.trip).catch((e) => toast(e.message))));
    m.querySelector('#newtrip').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await api('/trips', { method: 'POST', body: { title: e.target.title.value, start_date: state.search.from, end_date: state.search.to, persons: state.search.persons } });
        await add(res.trip.id);
      } catch (err) { toast(err.message); }
    });
  });
}

// ---------- Výlety ----------
function requireLogin() {
  if (state.user) return true;
  sessionStorage.setItem('tf_after_login', location.hash);
  viewAuth('login', 'Pro zobrazení výletů se přihlas.');
  return false;
}

const tripForm = (t = {}) => `
  <div><label for="t">Název</label><input id="t" name="title" required placeholder="např. Jarní Lisabon 2027" value="${esc(t.title || '')}"></div>
  <div class="two">
    <div><label for="sd">Od</label><input id="sd" name="start_date" type="date" value="${esc(t.start_date ?? state.search.from)}"></div>
    <div><label for="ed">Do</label><input id="ed" name="end_date" type="date" value="${esc(t.end_date ?? state.search.to)}"></div>
  </div>
  <div class="two">
    <div><label for="p">Počet osob</label><input id="p" name="persons" type="number" min="1" max="20" value="${esc(t.persons ?? state.search.persons)}"></div>
    <div><label for="b">Rozpočet (Kč)</label><input id="b" name="budget" type="number" min="0" step="500" placeholder="volitelné" value="${esc(t.budget ?? '')}"></div>
  </div>`;

async function viewTrips() {
  if (!requireLogin()) return;
  const { trips } = await api('/trips');
  const card = (t) => `
      <a class="card trip-card${t.status === 'done' ? ' done' : ''}" href="#/trips/${t.id}">
        <div class="media" style="${cover('europe')}">${t.cover ? photo(t.cover, 'luggage', t.title) : `<div class="fallback">${ms('luggage')}</div>`}
          <div class="badges">${t.status === 'done' ? '<span class="tag light">Dokončeno</span>' : countdown(t.start_date, 'tag light')}</div></div>
        <div class="body">
          <span class="eyebrow">${{ owner: 'Organizátor', editor: 'Spolucestovatel', viewer: 'Jen čtení' }[t.role]}</span>
          <h3>${esc(t.title)}</h3>
          <div class="small muted">${fmtRange(t.start_date, t.end_date)} · ${plural(t.member_count + 1, 'cestovatel', 'cestovatelé', 'cestovatelů')}</div>
          <div class="row"><span class="small muted">${plural(t.item_count, 'položka', 'položky', 'položek')}</span><b class="num">${czk(t.total)}</b></div>
        </div>
      </a>`;
  const active = trips.filter((t) => t.status !== 'done');
  const done = trips.filter((t) => t.status === 'done');
  $app.innerHTML = `
    <div class="page-head">
      <div><span class="eyebrow">Plánovač</span><h1 class="h-lg">Moje výlety</h1></div>
      <button class="btn" data-new-trip>${ms('add')} Vytvořit výlet</button>
    </div>
    ${trips.length ? `${active.length ? `<div class="grid">${active.map(card).join('')}</div>` : ''}
      ${done.length ? `<div class="page-head sub"><div><span class="eyebrow">Archiv</span><h2>Dokončené výlety</h2></div></div><div class="grid">${done.map(card).join('')}</div>` : ''}`
      : emptyState('luggage', 'Zatím nemáš žádný výlet. Založ první a pozvi partu – nebo si najdi destinaci a ulož si ji.', '<div class="row-actions center"><button class="btn" data-new-trip>Vytvořit výlet</button><a class="btn ghost" href="#/">Najít destinaci</a></div>')}`;
}

function countdown(start, cls = 'tag') {
  if (!start) return '';
  const days = Math.ceil((new Date(start) - new Date(new Date().toDateString())) / 86400000);
  if (days < 0) return '';
  return `<span class="${cls}">${days === 0 ? 'Odjezd dnes' : `Zbývá ${plural(days, 'den', 'dny', 'dní')}`}</span>`;
}

// ---------- Plánovač výletu ----------
const ACT_CATS = {
  transport: { ic: 'train', label: 'Doprava', sub: 'Letenky, vlaky, metro' },
  lodging: { ic: 'bed', label: 'Ubytování', sub: 'Check-in, apartmány' },
  sight: { ic: 'museum', label: 'Památky', sub: 'Vstupy a vyhlídky' },
  food: { ic: 'restaurant', label: 'Gastronomie', sub: 'Kavárny, brunche, večeře' },
  activity: { ic: 'local_activity', label: 'Zážitek', sub: 'Cokoli dalšího' },
};
const STATUSES = { '': 'Bez stavu', confirmed: 'Potvrzeno', booked: 'Rezervace', must: 'Must-visit' };
const WX = { Jasno: ms('sunny'), Polojasno: ms('partly_cloudy_day'), Zataženo: ms('cloud'), Mlha: ms('foggy'), Mrholení: ms('rainy_light'), Déšť: ms('rainy'), Sníh: ms('weather_snowy'), Bouřky: ms('thunderstorm') };
const wxIcon = (text) => WX[text] || ms('thermostat');
const WEEKDAYS = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
const dayDate = (iso) => new Date(`${iso}T12:00:00`);
const shortDay = (iso) => { const d = dayDate(iso); return `${DAYS[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}.`; };
const longDay = (iso) => { const d = dayDate(iso); return `${WEEKDAYS[d.getDay()]} ${d.getDate()}. ${d.toLocaleDateString('cs-CZ', { month: 'long', day: 'numeric' }).split(' ').slice(1).join(' ')}`; };

function tripDays(trip) {
  if (!trip.start_date) return [];
  const out = [];
  const end = new Date(`${trip.end_date || trip.start_date}T00:00:00Z`);
  for (let d = new Date(`${trip.start_date}T00:00:00Z`); d <= end && out.length < 60; d = new Date(d.getTime() + 86400000)) out.push(d.toISOString().slice(0, 10));
  return out;
}
const addDays = (iso, n) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

// Kdy se položka koná: ručně zvolený den, nebo odvozený z odjezdu / check-inu.
function itemWhen(it) {
  const d = it.data;
  if (d.day) return { day: d.day, time: d.time || '' };
  if (it.kind === 'transport') {
    const dep = d.legs?.[0]?.depart || d.depart || '';
    if (dep) return { day: dep.slice(0, 10), time: dep.slice(11, 16) };
    if (d.from) return { day: d.from.slice(0, 10), time: '' };
  }
  if (it.kind === 'lodging' && d.from) return { day: d.from.slice(0, 10), time: d.time || '' };
  return { day: null, time: '' };
}
const itemCat = (it) => (it.kind === 'transport' ? 'transport' : it.kind === 'lodging' ? 'lodging' : it.data.category || 'activity');
const itemTitle = (it) => it.data.title || it.data.text || 'Bez názvu';

function tripPlan(items) {
  const scheduled = []; const ideas = []; const places = [];
  for (const it of items) {
    if (it.kind === 'destination') { places.push(it); continue; }
    const w = itemWhen(it);
    if (w.day) scheduled.push({ it, ...w });
    else ideas.push(it);
    // Zpáteční spoj se ukáže i v den návratu
    const back = it.kind === 'transport' && it.data.returnLegs?.[0]?.depart;
    if (back && !it.data.day) scheduled.push({ it, day: back.slice(0, 10), time: back.slice(11, 16), returning: true });
  }
  ideas.sort((a, b) => b.votes - a.votes || a.id - b.id);
  return { scheduled, ideas, places };
}

const ago = (sqlTime) => {
  if (!sqlTime) return '';
  const min = Math.round((Date.now() - new Date(`${sqlTime.replace(' ', 'T')}Z`)) / 60000);
  if (min < 1) return 'právě teď';
  if (min < 60) return `před ${min} min`;
  if (min < 1440) return `před ${Math.round(min / 60)} h`;
  return `před ${plural(Math.round(min / 1440), 'dnem', 'dny', 'dny').replace(/^1 dnem$/, 'dnem')}`;
};

async function viewTrip(id) {
  if (!requireLogin()) return;
  renderTrip(await api(`/trips/${id}`));
}

function renderTrip(detail, { shared = false } = {}) {
  const { trip, role, owner, items, members, total } = detail;
  const canEdit = !shared && role !== 'viewer';
  const isOwner = !shared && role === 'owner';
  const days = tripDays(trip);
  const { scheduled, ideas, places } = tripPlan(items);
  const dayKey = `tf_day_${trip.id}`;
  let day = sessionStorage.getItem(dayKey);
  const today = new Date().toISOString().slice(0, 10);
  if (!days.includes(day)) day = days.includes(today) ? today : days[0] || null;
  const people = [{ name: owner.name, email: owner.email, role: 'owner' }, ...members.map((m) => ({ ...m, name: m.name || m.email }))];
  const mainPlace = places[0]?.data;
  const location = [...new Set(places.map((p) => p.data.title || p.data.name))].slice(0, 3).join(', ') || 'Cíl zatím nevybrán';
  const dayItems = (d) => scheduled.filter((x) => x.day === d).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  const persons = Number(trip.persons) || 1;

  const statusChip = (st) => (st && STATUSES[st] ? `<span class="tag${st === 'confirmed' ? ' dark' : ''}">${STATUSES[st]}</span>` : '');
  const tlItem = ({ it, time, returning }) => {
    const d = it.data; const c = ACT_CATS[itemCat(it)] || ACT_CATS.activity;
    const sub = it.kind === 'note' ? d.note : [d.subtitle, d.providerName].filter(Boolean).join(' · ');
    const cost = it.price != null ? czk(it.price) : '';
    const strong = ['confirmed', 'booked'].includes(d.status) || it.kind !== 'note';
    return `<li class="tl-row${strong ? ' strong' : ''}">
      <i class="tl-dot"></i>
      <${canEdit ? `button type="button" data-edit="${it.id}"` : 'div'} class="tl-card">
        <span class="tl-top"><span class="mono">${esc(time || '—')}</span>${returning ? '<span class="tag">Zpáteční cesta</span>' : statusChip(d.status)}</span>
        <b class="tl-title">${ms(c.ic, 'sm')} ${esc(itemTitle(it))}</b>
        ${sub ? `<span class="tl-note">${esc(sub)}</span>` : ''}
        <span class="tl-meta">${d.place ? `<span>${ms('location_on', 'sm')} ${esc(d.place)}</span>` : ''}${cost && !returning ? `<span>${ms('payments', 'sm')} ${cost}</span>` : ''}${it.kind === 'lodging' && d.to ? `<span>${ms('event', 'sm')} do ${shortDate(d.to)}</span>` : ''}</span>
      </${canEdit ? 'button' : 'div'}>
      ${d.deepLink || d.url ? `<a class="tl-link" href="${esc(d.deepLink || d.url)}" target="_blank" rel="noopener" aria-label="Otevřít odkaz">${ms('arrow_outward', 'sm')}</a>` : ''}
    </li>`;
  };

  const sum = (pred) => items.filter((i) => i.kind !== 'destination' && pred(itemCat(i))).reduce((a, i) => a + (i.price || 0), 0);
  const parts = [['Ubytování', sum((c) => c === 'lodging')], ['Doprava', sum((c) => c === 'transport')], ['Jídlo & kavárny', sum((c) => c === 'food')], ['Vstupy & zážitky', sum((c) => c === 'sight' || c === 'activity')]];
  const pct = trip.budget ? Math.min(100, Math.round((total / trip.budget) * 100)) : total ? 100 : 0;

  const dayBlock = (d) => {
    const list = dayItems(d);
    const idx = days.indexOf(d);
    const dayCost = list.filter((x) => !x.returning).reduce((a, x) => a + (x.it.price || 0), 0);
    const names = list.filter((x) => x.it.kind === 'note').map((x) => itemTitle(x.it)).slice(0, 2);
    return `<div class="day-head"><div><span class="eyebrow">${esc(longDay(d))} <span class="sep">•</span> Den ${idx + 1}</span>
        <h2 class="h-md">${esc(names.join(' & ') || (idx === 0 ? 'Příjezd' : idx === days.length - 1 && days.length > 1 ? 'Odjezd' : 'Volný den'))}</h2></div>
        <div class="chips-inline"><span class="tag">${plural(list.length, 'aktivita', 'aktivity', 'aktivit')}</span>${dayCost ? `<span class="tag">cca ${czk(dayCost / persons)} / os.</span>` : ''}</div></div>
      ${list.length ? `<ol class="timeline">${list.map(tlItem).join('')}</ol>` : `<div class="day-empty">${ms('wb_sunny')}<p class="muted">Na tento den zatím nic není. Přidej aktivitu, nebo přesuň nápad party.</p></div>`}
      ${canEdit ? `<button class="btn wide" data-add-day="${d}">${ms('add_circle')} Přidat aktivitu do tohoto dne</button>` : ''}`;
  };

  $app.innerHTML = `
    ${shared ? `<div class="notice">${ms('visibility')}<span>Díváš se na sdílený výlet od <b>${esc(owner.name)}</b>. ${state.user ? '' : '<a href="#/register">Založ si účet</a> a plánuj vlastní.'}</span></div>` : '<a href="#/trips" class="back">' + ms('arrow_back', 'sm') + ' Moje výlety</a>'}
    <section class="card bento planner-head">
      <div class="ph-top">
        <div class="ph-title">
          <div class="chips-inline"><span class="tag">${ms('sync', 'sm')} Upraveno ${ago(trip.updated_at)}</span>${trip.status === 'done' ? '<span class="tag dark">Dokončený výlet</span>' : countdown(trip.start_date)}</div>
          <h1 class="h-lg">${esc(trip.title)}</h1>
          <div class="ph-meta"><span>${ms('calendar_today', 'sm')} ${days.length ? `${fmtRange(trip.start_date, trip.end_date)} • ${plural(days.length, 'den', 'dny', 'dní')}` : 'Termín zatím není'}</span><span class="dot-sep"></span><span>${ms('location_on', 'sm')} ${esc(location)}</span></div>
        </div>
        <div class="ph-actions">
          <span class="stack">${people.slice(0, 4).map((p, i) => `<span class="avatar${i === 0 ? ' dark' : ''}" title="${esc(p.name)}">${esc(initials(p.name))}</span>`).join('')}${people.length > 4 ? `<span class="avatar">+${people.length - 4}</span>` : ''}</span>
          ${isOwner ? `<button class="btn" id="invite-btn">${ms('person_add')} Pozvat přátele</button>` : ''}
          ${!shared ? `<a class="round-btn" href="#/chat/t/${trip.id}" title="Chat výletu" aria-label="Chat výletu">${ms('chat_bubble')}</a>` : ''}
          ${isOwner ? `<button class="round-btn" id="share-btn" title="Sdílet náhled" aria-label="Sdílet náhled">${ms('ios_share')}</button>` : ''}
          ${!shared ? `<button class="round-btn" id="more-btn" title="Další možnosti" aria-label="Další možnosti">${ms('more_horiz')}</button>` : ''}
        </div>
      </div>
      <div class="day-tabs" role="tablist">
        ${days.map((d) => `<button role="tab" data-day="${d}" aria-selected="${d === day}"><b>${shortDay(d)}</b><span>${esc(dayItems(d).filter((x) => x.it.kind === 'note').map((x) => itemTitle(x.it))[0] || (dayItems(d).length ? plural(dayItems(d).length, 'aktivita', 'aktivity', 'aktivit') : 'Volný den'))}</span></button>`).join('')}
        ${canEdit ? (days.length ? `<button class="add-day" id="add-day">${ms('add', 'sm')} Přidat den</button>` : `<button class="add-day" id="set-dates">${ms('calendar_today', 'sm')} Nastavit termín</button>`) : ''}
      </div>
    </section>

    <div class="planner">
      <div class="pl-left">
        ${canEdit ? `<section class="card bento">
          <div class="card-head"><h3>Rychlé přidání</h3><span class="small muted">Kliknutím vložit</span></div>
          <p class="muted small">Vyber typ a doplň detaily. Uloží se do ${day ? 'vybraného dne' : 'nápadů party'}.</p>
          <div class="quick-tiles">${['transport', 'lodging', 'sight', 'food'].map((k) => `<button class="q-tile" data-quick="${k}">${ms(ACT_CATS[k].ic)}<b>${ACT_CATS[k].label}</b><small>${ACT_CATS[k].sub}</small></button>`).join('')}</div>
          ${mainPlace?.destinationId ? `<a class="link-arrow small" href="${dHref(mainPlace.destinationId)}">Najít spoje a ubytování pro ${esc(mainPlace.title || mainPlace.name)} ${ms('arrow_forward', 'sm')}</a>` : ''}
        </section>` : ''}
        <section class="card bento">
          <div class="card-head"><h3>Nápady party</h3><span class="tag">${plural(ideas.length, 'návrh', 'návrhy', 'návrhů')}</span></div>
          <p class="muted small">Zatím nezařazeno do konkrétních časů. Hlasujte o nejlepších místech.</p>
          <div class="ideas">${ideas.map((it) => `<div class="idea">
              <button class="idea-main" ${canEdit ? `data-edit="${it.id}"` : 'disabled'}>${ms((ACT_CATS[itemCat(it)] || ACT_CATS.activity).ic)}<span class="grow"><b class="ellipsis">${esc(itemTitle(it))}</b><small class="ellipsis">${esc(it.data.note || it.data.place || it.data.subtitle || (ACT_CATS[itemCat(it)] || ACT_CATS.activity).label)}</small></span></button>
              <button class="vote${it.voted ? ' on' : ''}" data-vote="${it.id}" ${shared ? 'disabled' : ''} aria-label="Hlasovat">${ms('thumb_up', 'sm')} ${it.votes}</button>
            </div>`).join('') || '<p class="small muted empty-line">Žádné nápady. Navrhni první místo nebo ho přidej z mapy.</p>'}</div>
          ${canEdit ? `<button class="btn soft wide" id="suggest">${ms('add_location_alt')} Navrhnout místo</button>` : ''}
        </section>
        <section class="tip-card" id="tip-card" hidden></section>
      </div>

      <div class="pl-center">
        <section class="card bento day-card">${day ? dayBlock(day) : `<div class="day-empty">${ms('calendar_month')}<p class="muted">Nastav termín výletu a rozplánuj program po dnech. Do té doby se vše ukládá jako nápady party.</p>${canEdit ? '<button class="btn" id="set-dates-2">Nastavit termín</button>' : ''}</div>`}</section>
        <section class="card bento map-wrap" id="trip-map-card" hidden><div class="card-head"><h3>Mapa výletu</h3></div><div class="map" id="trip-map"></div></section>
      </div>

      <div class="pl-right">
        <section class="card bento budget-card">
          <div class="card-head"><h3>Rozpočet výletu</h3><span class="small muted">${trip.budget ? `Cíl: ${czk(trip.budget)}` : 'Bez cíle'}</span></div>
          <div class="budget-big"><b class="num">${czk(total)}</b><span class="muted small">/ cca ${czk(total / persons)} na osobu</span></div>
          <div class="progress${trip.budget && total > trip.budget ? ' over' : ''}"><i style="width:${pct}%"></i></div>
          ${trip.budget && total > trip.budget ? `<p class="small" style="margin-top:8px">Přes rozpočet o ${czk(total - trip.budget)}</p>` : ''}
          <ul class="legend-list">${parts.map(([l, v], i) => `<li><i class="lg${i}"></i><span class="grow">${l}</span><b class="num">${czk(v)}</b></li>`).join('')}</ul>
          ${canEdit ? '<button class="btn soft wide" id="budget-btn">Spravovat náklady</button>' : ''}
        </section>
        <section class="card bento">
          <div class="card-head"><h3>Spolucestovatelé</h3><span class="small muted">${plural(people.length, 'člen', 'členové', 'členů')}</span></div>
          <ul class="people">${people.map((p, i) => `<li><span class="avatar${i === 1 ? ' dark' : ''}">${esc(initials(p.name))}</span><span class="grow"><b class="ellipsis">${esc(p.name)}</b><small class="ellipsis">${p.role === 'owner' ? 'organizátor' : p.user_id ? esc(p.email || '') : 'čeká na registraci'}</small></span>
            <span class="tag${p.role === 'owner' ? ' dark' : ''}">${{ owner: 'Organizátor', editor: 'Editor', viewer: 'Prohlížení' }[p.role]}</span>
            ${p.id && (isOwner || p.user_id === state.user?.id) ? `<button class="icon-btn" data-rm="${p.id}" aria-label="Odebrat">${ms('close', 'sm')}</button>` : ''}</li>`).join('')}</ul>
          ${isOwner ? `<div class="copy-row">${ms('link', 'sm')}<span class="ellipsis grow" id="invite-url">${trip.invite_token ? esc(`${location.host}/#/join/${trip.invite_token}`) : 'Odkaz pro přidání do výletu'}</span><button class="btn sm light" id="copy-invite">${trip.invite_token ? 'Kopírovat' : 'Vytvořit'}</button></div>` : ''}
        </section>
        <section class="card bento" id="weather-card" hidden></section>
      </div>
    </div>`;

  const run = (p) => p.then((d) => renderTrip(d)).catch((e) => toast(e.message));
  const refresh = () => run(api(`/trips/${trip.id}`));

  // Dny
  $app.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => { sessionStorage.setItem(dayKey, b.dataset.day); renderTrip(detail, { shared }); }));
  document.querySelector('.day-tabs [aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  document.getElementById('add-day')?.addEventListener('click', () => {
    sessionStorage.setItem(dayKey, addDays(days.at(-1), 1));
    run(api(`/trips/${trip.id}`, { method: 'PATCH', body: { end_date: addDays(days.at(-1), 1) } }));
  });
  const editTrip = () => modal(`<h2>Upravit výlet</h2>
    <form id="f" class="stack-form">${tripForm(trip)}
      <div><label for="n">Poznámka</label><textarea id="n" name="note">${esc(trip.note)}</textarea></div>
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Zrušit</button><button class="btn">Uložit</button></div>
    </form>`, (m, close) => m.querySelector('#f').addEventListener('submit', (e) => {
    e.preventDefault(); close();
    run(api(`/trips/${trip.id}`, { method: 'PATCH', body: Object.fromEntries(new FormData(e.target)) }));
  }));
  ['set-dates', 'set-dates-2'].forEach((id) => document.getElementById(id)?.addEventListener('click', editTrip));

  // Aktivity
  const activityModal = (it, preset = {}) => {
    const d = it ? { ...it.data, ...itemWhen(it) } : { category: 'activity', ...preset };
    const isNote = !it || it.kind === 'note';
    const cat = it ? itemCat(it) : d.category;
    modal(`<h2>${it ? 'Upravit' : 'Nová aktivita'}</h2>
      <form id="af" class="stack-form">
        <div><label for="a-title">Název</label><input id="a-title" name="title" required maxlength="160" value="${esc(it ? itemTitle(it) : '')}" placeholder="${cat === 'food' ? 'např. Café Janis' : cat === 'transport' ? 'např. Tramvaj 15E do Belému' : 'např. Klášter Jerónimos'}"></div>
        <div class="two">
          <div><label for="a-day">Den</label><select id="a-day" name="day"><option value="">Nápad (bez dne)</option>${days.map((x) => `<option value="${x}" ${x === d.day ? 'selected' : ''}>${shortDay(x)}</option>`).join('')}</select></div>
          <div><label for="a-time">Čas</label><input id="a-time" name="time" type="time" value="${esc(d.time || '')}"></div>
        </div>
        ${isNote ? `<div class="two">
          <div><label for="a-cat">Typ</label><select id="a-cat" name="category">${Object.entries(ACT_CATS).map(([k, v]) => `<option value="${k}" ${k === cat ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
          <div><label for="a-cost">Cena celkem (Kč)</label><input id="a-cost" name="cost" type="number" min="0" step="10" value="${esc(d.cost ?? '')}" placeholder="volitelné"></div>
        </div>` : ''}
        <div class="two">
          <div><label for="a-place">Místo</label><input id="a-place" name="place" maxlength="160" value="${esc(d.place || '')}" placeholder="adresa nebo zastávka"></div>
          <div><label for="a-status">Stav</label><select id="a-status" name="status">${Object.entries(STATUSES).map(([k, v]) => `<option value="${k}" ${k === (d.status || '') ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        </div>
        <div><label for="a-note">Poznámka</label><textarea id="a-note" name="note" maxlength="1000" placeholder="Rezervace, vstupenky, tipy…">${esc(isNote ? d.note || '' : d.note || '')}</textarea></div>
        <div class="modal-actions">${it ? `<button type="button" class="btn danger" id="a-del">Odebrat</button><span class="grow"></span>` : ''}<button type="button" class="btn ghost" data-close>Zrušit</button><button class="btn">${it ? 'Uložit' : 'Přidat'}</button></div>
      </form>`, (m, close) => {
      m.querySelector('#af').addEventListener('submit', (e) => {
        e.preventDefault();
        const body = Object.fromEntries(new FormData(e.target));
        close();
        if (it) run(api(`/trips/${trip.id}/items/${it.id}`, { method: 'PATCH', body }));
        else run(api(`/trips/${trip.id}/items`, { method: 'POST', body: { kind: 'note', data: { ...preset, ...body, cost: body.cost === '' ? null : Number(body.cost), price: body.cost || undefined } } }));
      });
      m.querySelector('#a-del')?.addEventListener('click', () => { close(); run(api(`/trips/${trip.id}/items/${it.id}`, { method: 'DELETE' })); });
    });
  };
  $app.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => activityModal(items.find((i) => i.id === Number(b.dataset.edit)))));
  $app.querySelectorAll('[data-quick]').forEach((b) => b.addEventListener('click', () => activityModal(null, { category: b.dataset.quick, day: day || '' })));
  $app.querySelectorAll('[data-add-day]').forEach((b) => b.addEventListener('click', () => activityModal(null, { day: b.dataset.addDay, category: 'activity' })));
  document.getElementById('suggest')?.addEventListener('click', () => activityModal(null, { category: 'sight', day: '' }));
  $app.querySelectorAll('[data-vote]').forEach((b) => b.addEventListener('click', () => run(api(`/trips/${trip.id}/items/${b.dataset.vote}/vote`, { method: 'POST' }))));

  // Rozpočet
  document.getElementById('budget-btn')?.addEventListener('click', () => modal(`<h2>Rozpočet výletu</h2>
    <p class="muted" style="margin-top:6px">Celkem zatím ${czk(total)}. Ceny jednotlivých aktivit upravíš kliknutím na ně.</p>
    <form id="bf" class="stack-form"><div class="two">
      <div><label for="bf-b">Cílový rozpočet (Kč)</label><input id="bf-b" name="budget" type="number" min="0" step="500" value="${esc(trip.budget ?? '')}" placeholder="bez cíle"></div>
      <div><label for="bf-p">Počet osob</label><input id="bf-p" name="persons" type="number" min="1" max="20" value="${persons}"></div></div>
      <ul class="legend-list">${items.filter((i) => i.price != null).map((i) => `<li><span class="grow ellipsis">${esc(itemTitle(i))}</span><b class="num">${czk(i.price)}</b></li>`).join('') || '<li class="muted small">Zatím žádné náklady.</li>'}</ul>
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Zavřít</button><button class="btn">Uložit</button></div></form>`, (m, close) => {
    m.querySelector('#bf').addEventListener('submit', (e) => { e.preventDefault(); close(); run(api(`/trips/${trip.id}`, { method: 'PATCH', body: Object.fromEntries(new FormData(e.target)) })); });
  }));

  // Lidé a pozvánky
  $app.querySelectorAll('[data-rm]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('Odebrat z výletu?')) return;
      const res = await api(`/trips/${trip.id}/members/${b.dataset.rm}`, { method: 'DELETE' }).catch((e) => toast(e.message));
      if (res?.left) { toast('Opustil(a) jsi výlet.'); location.hash = '#/trips'; } else if (res) renderTrip(res);
    };
  });
  const inviteUrl = async () => {
    const { token } = await api(`/trips/${trip.id}/invite-link`, { method: 'POST' });
    trip.invite_token = token;
    return `${location.origin}/#/join/${token}`;
  };
  document.getElementById('copy-invite')?.addEventListener('click', async () => {
    const url = await inviteUrl();
    document.getElementById('invite-url').textContent = url.replace(/^https?:\/\//, '');
    document.getElementById('copy-invite').textContent = 'Kopírovat';
    await navigator.clipboard?.writeText(url).catch(() => {});
    toast('Odkaz pro přidání do výletu zkopírován');
  });
  document.getElementById('invite-btn')?.addEventListener('click', async () => {
    const { friends } = await api('/friends').catch(() => ({ friends: [] }));
    const inTrip = new Set(people.map((p) => (p.email || '').toLowerCase()));
    modal(`<h2>Pozvat přátele</h2>
      <p class="muted" style="margin-top:6px">Kdo se přidá, může upravovat program, hlasovat a psát do chatu výletu.</p>
      ${friends.length ? `<div class="pick-list">${friends.map((f) => `<div class="pick"><span class="avatar">${esc(initials(f.name))}</span><span class="grow"><b>${esc(f.name)}</b><small>${esc(f.email)}</small></span>
        ${inTrip.has(f.email.toLowerCase()) ? '<span class="tag">Ve výletu</span>' : `<button class="btn sm" data-add-friend="${esc(f.email)}">Pozvat</button>`}</div>`).join('')}</div>` : ''}
      <form id="inv" class="inline-form"><input name="email" type="email" placeholder="e-mail kamaráda" required><select name="role"><option value="editor">Editor</option><option value="viewer">Prohlížení</option></select><button class="btn">Pozvat</button></form>
      <div class="divider"><span>nebo</span></div>
      <button class="btn soft wide" id="inv-link">${ms('link')} Zkopírovat odkaz pro přidání</button>`, (m, close) => {
      const add = (email, role = 'editor') => api(`/trips/${trip.id}/members`, { method: 'POST', body: { email, role } }).then((d) => { close(); renderTrip(d); toast('Pozvánka přidána'); }).catch((e) => toast(e.message));
      m.querySelectorAll('[data-add-friend]').forEach((b) => { b.onclick = () => add(b.dataset.addFriend); });
      m.querySelector('#inv').addEventListener('submit', (e) => { e.preventDefault(); add(e.target.email.value, e.target.role.value); });
      m.querySelector('#inv-link').onclick = async () => { const url = await inviteUrl(); close(); shareLink(trip.title, url); };
    });
  });

  // Sdílení náhledu, další možnosti
  const share = (enabled) => api(`/trips/${trip.id}/share`, { method: 'POST', body: { enabled } }).then(() => api(`/trips/${trip.id}`));
  document.getElementById('share-btn')?.addEventListener('click', async () => {
    const d = trip.share_token ? detail : await share(true);
    if (!trip.share_token) renderTrip(d);
    shareLink(trip.title, `${location.origin}/#/shared/${d.trip.share_token}`);
  });
  document.getElementById('more-btn')?.addEventListener('click', () => modal(`<h2>${esc(trip.title)}</h2>
    <div class="menu-list">
      ${canEdit ? `<button data-act="edit">${ms('edit')} Upravit název, termín a poznámku</button>` : ''}
      ${mainPlace?.destinationId ? `<a href="${dHref(mainPlace.destinationId)}">${ms('travel_explore')} Najít spoje a ubytování</a>` : `<a href="#/">${ms('travel_explore')} Vybrat destinaci</a>`}
      <a href="#/chat/t/${trip.id}">${ms('chat_bubble')} Chat výletu</a>
      ${isOwner && trip.share_token ? `<button data-act="unshare">${ms('link_off')} Zrušit veřejný náhled</button>` : ''}
      ${isOwner ? (trip.status === 'done' ? `<button data-act="reopen">${ms('undo')} Vrátit mezi plánované</button>` : `<button data-act="complete">${ms('task_alt')} Dokončit výlet</button>`) : ''}
      ${places.length && canEdit ? places.map((p) => `<button data-act="rm-place" data-id="${p.id}">${ms('wrong_location')} Odebrat cíl ${esc(p.data.title || p.data.name)}</button>`).join('') : ''}
      ${isOwner ? `<button class="danger" data-act="delete">${ms('delete')} Smazat výlet</button>` : ''}
    </div>`, (m, close) => {
    m.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
      close();
      const act = b.dataset.act;
      if (act === 'edit') editTrip();
      if (act === 'unshare') run(share(false));
      if (act === 'reopen') run(api(`/trips/${trip.id}/status`, { method: 'POST', body: { status: 'planned' } }));
      if (act === 'rm-place') run(api(`/trips/${trip.id}/items/${b.dataset.id}`, { method: 'DELETE' }));
      if (act === 'complete') completeTrip();
      if (act === 'delete') {
        if (!confirm(`Opravdu smazat výlet „${trip.title}“?`)) return;
        await api(`/trips/${trip.id}`, { method: 'DELETE' });
        toast('Výlet smazán.'); location.hash = '#/trips';
      }
    }));
  }));
  const completeTrip = () => {
    const countries = [...new Set(places.map((i) => i.data.subtitle?.split('·')[0].trim()).filter(Boolean))];
    modal(`<div class="center"><div class="big-ic">${ms('task_alt')}</div><h2>Výlet se povedl?</h2>
      <p class="muted" style="margin-top:8px">Označíme ho jako dokončený${countries.length ? ` a do tvého cestovatelského pasu přibude razítko: <b>${esc(countries.join(', '))}</b>` : ''}.</p></div>
      <div class="modal-actions center"><button class="btn ghost" data-close>Ještě ne</button><button class="btn" id="yes">Ano, dokončit</button></div>`, (m, close) => {
      m.querySelector('#yes').onclick = async () => {
        close();
        await run(api(`/trips/${trip.id}/status`, { method: 'POST', body: { status: 'done' } }));
        toast('Gratulujeme! Razítka najdeš ve svém profilu.');
        celebrate();
      };
    });
  };

  // Mapa, počasí a tip dne (doplní se na pozadí)
  const mapData = tripMapData(items);
  if (mapData.points.length || mapData.segments.length) {
    document.getElementById('trip-map-card').hidden = false;
    drawMap(document.getElementById('trip-map'), mapData);
  }
  const geo = places.find((p) => Number.isFinite(p.data.lat))?.data;
  if (mainPlace?.destinationId) loadTripWeather(mainPlace);
  if (geo) loadTip(geo, Math.max(0, days.indexOf(day)), canEdit ? (p) => run(api(`/trips/${trip.id}/items`, { method: 'POST', body: { kind: 'note', data: { title: p.title, note: p.description || '', category: 'sight', lat: p.lat, lng: p.lng, image: p.thumb } } })) : null);
}

async function loadTripWeather(place) {
  const card = document.getElementById('weather-card');
  try {
    const w = await api(`/destinations/${enc(place.destinationId)}/weather`);
    if (!card.isConnected || !w.current) return;
    card.hidden = false;
    card.innerHTML = `<div class="card-head"><h3>${wxIcon(w.current.text)} Počasí ${esc(place.title || place.name || '')}</h3><span class="small muted">Aktuálně</span></div>
      <div class="wx-now"><b class="num">${w.current.temp} °C</b><span class="muted">${esc(w.current.text)}</span></div>
      <div class="wx-days">${w.days.slice(1, 4).map((x) => `<div><span class="small muted">${DAYS[new Date(x.date).getDay()]}</span>${wxIcon(x.text)}<b>${x.max}°</b><small class="muted">${esc(x.text)}</small></div>`).join('')}</div>`;
  } catch { /* bez počasí */ }
}

async function loadTip(geo, index, onAdd) {
  const box = document.getElementById('tip-card');
  try {
    const q = new URLSearchParams({ lat: (Math.round(geo.lat * 50) / 50).toFixed(2), lng: (Math.round(geo.lng * 50) / 50).toFixed(2), radius: 10000 });
    const { places } = await cachedApi(`/explore?${q}`);
    const withPhoto = places.filter((p) => p.thumb);
    const p = withPhoto[index % (withPhoto.length || 1)] || places[index % (places.length || 1)];
    if (!p || !box.isConnected) return;
    box.hidden = false;
    box.innerHTML = `${p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
      <div class="tip-txt"><span class="eyebrow">Tip dne</span><b>${esc(p.title)}</b>${p.description ? `<small>${esc(p.description)}</small>` : ''}
      ${onAdd ? `<button class="btn sm light" id="tip-add">${ms('add', 'sm')} Do nápadů</button>` : ''}</div>`;
    document.getElementById('tip-add')?.addEventListener('click', () => onAdd(p));
  } catch { /* bez tipu */ }
}

async function viewShared(token) {
  renderTrip(await api(`/shared/${token}`), { shared: true });
}

// Pozvánka do výletu odkazem
async function viewJoin(token) {
  const { trip, member } = await api(`/join/${token}`);
  if (member) { location.hash = `#/trips/${trip.id}`; return; }
  $app.innerHTML = `<div class="card bento auth center">
    <div class="big-ic">${ms('group_add')}</div>
    <h1 class="h-md">${esc(trip.owner)} tě zve do výletu</h1>
    <p class="h-lg" style="margin-top:6px">${esc(trip.title)}</p>
    <p class="muted" style="margin:10px 0 20px">${trip.start_date ? fmtRange(trip.start_date, trip.end_date) : 'Termín se teprve plánuje'} · společný program, hlasování o nápadech a chat výletu.</p>
    ${state.user ? '<button class="btn" id="join">Přidat se k výletu</button>'
      : '<div class="row-actions center"><a class="btn" href="#/register" data-after>Založit účet a přidat se</a><a class="btn ghost" href="#/login" data-after>Mám účet</a></div>'}
  </div>`;
  $app.querySelectorAll('[data-after]').forEach((a) => a.addEventListener('click', () => sessionStorage.setItem('tf_after_login', location.hash)));
  document.getElementById('join')?.addEventListener('click', async () => {
    const r = await api(`/join/${token}`, { method: 'POST' });
    toast('Jsi ve výletu!');
    location.hash = `#/trips/${r.tripId}`;
  });
}

function celebrate() {
  const box = document.createElement('div');
  box.className = 'confetti';
  box.innerHTML = Array.from({ length: 40 }, (_, i) => `<i style="--x:${(i * 37) % 100}vw;--d:${(i % 7) * 0.12}s;--c:${['#111111', '#6e6e73', '#c7c7cc', '#3a3a3c', '#e5e5ea'][i % 5]}"></i>`).join('');
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2600);
}

// ---------- Účet ----------
function viewAuth(mode, hint = '') {
  if (state.user) { location.hash = '#/trips'; return; }
  const reg = mode === 'register';
  $app.innerHTML = `
    <div class="glass-card auth">
      <span class="pill coral">${reg ? 'NOVÝ ÚČET' : 'VÍTEJ ZPĚT'}</span>
      <h1 style="margin-top:12px">${reg ? 'Začni plánovat' : 'Přihlášení'}</h1>
      <p class="muted" style="margin-top:6px">${esc(hint || (reg ? 'Ukládej výlety, zvi spolucestující a sdílej plány.' : 'Tvoje výlety na tebe čekají.'))}</p>
      <form id="f">
        ${reg ? `<div><label for="name">Jméno</label><input id="name" name="name" autocomplete="name" required></div>` : ''}
        <div><label for="email">E-mail</label><input id="email" name="email" type="email" autocomplete="email" required></div>
        <div><label for="password">Heslo</label><input id="password" name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" minlength="${reg ? 8 : 1}" required></div>
        <div class="error" id="err"></div>
        <button class="btn">${reg ? 'Vytvořit účet' : 'Přihlásit se'}</button>
      </form>
      <p class="small muted" style="margin-top:16px;text-align:center">${reg ? 'Už máš účet? <a href="#/login">Přihlas se</a>' : 'Nemáš účet? <a href="#/register">Zaregistruj se</a>'}</p>
    </div>`;
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const { user } = await api(`/auth/${reg ? 'register' : 'login'}`, { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      state.user = user; state.profile = null;
      const profile = await loadProfile().catch(() => null);
      applyHomeOrigin();
      renderAccount(); refreshBadge();
      toast(`Ahoj, ${user.name}!`);
      if (!profile?.onboarded) { location.hash = '#/welcome'; return; }
      const next = sessionStorage.getItem('tf_after_login');
      sessionStorage.removeItem('tf_after_login');
      if (next && next !== location.hash) location.hash = next; else route();
    } catch (err) { document.getElementById('err').textContent = err.message; }
  });
}

async function viewAccount() {
  if (!requireLogin()) return;
  $app.innerHTML = `<div class="profile">
    <div class="glass-card profile-card">
      <span class="avatar" style="width:72px;height:72px;font-size:24px">${esc(initials(state.user.name))}</span>
      <div class="grow"><h1>${esc(state.user.name)}</h1><p class="muted">${esc(state.user.email)}</p></div>
      <div class="actions"><a class="btn sky" href="#/trips">Moje výlety</a><button class="btn danger" id="lo">Odhlásit se</button></div>
    </div>
    <div id="profile-edit"><div class="skeleton" style="height:320px;margin-top:24px"></div></div>
    <div id="passport"><div class="skeleton" style="height:240px;margin-top:24px"></div></div>
  </div>`;
  document.getElementById('lo').onclick = logout;
  profileBlock(document.getElementById('profile-edit')).catch(() => {});
  document.getElementById('passport').innerHTML = await passportBlock();
}

// ---------- Start ----------
async function init() {
  $app.innerHTML = `<div class="grid">${'<div class="skeleton" style="height:340px"></div>'.repeat(3)}</div>`;
  try {
    const [meta, me, all, photos] = await Promise.all([api('/meta'), api('/auth/me'), api('/destinations'), api('/photos').catch(() => ({}))]);
    state.photos = photos;
    state.meta = meta;
    state.user = me.user;
    state.profile = me.profile || null;
    applyHomeOrigin();
    state.all = all.results;
  } catch {
    $app.innerHTML = emptyState('wifi_off', 'Nepodařilo se spojit se serverem. Jsi online?', '<button class="btn" onclick="location.reload()">Zkusit znovu</button>');
    return;
  }
  renderAccount();
  refreshBadge();
  window.addEventListener('hashchange', route);
  route();
}
setupSocial({ api, esc, toast, state, $app, initials, requireLogin, emptyState, route, modal, renderAccount, shareLink, czk, fmtRange });
init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
