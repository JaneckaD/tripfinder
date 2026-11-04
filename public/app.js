// TripFinder – frontend (vanilla JS, bez build kroku). Jednoduchý hash router.
import { setupSocial, loadProfile, profileBlock, profileHints, ageDiscount, applyHomeOrigin, refreshBadge, viewWelcome, viewChat, viewInvite } from './social.js';
import { autocomplete, calendar, guestsPicker, drawMap, loadLeaflet, baseTiles, stampSvg, touchMapOptions, twoFingerHint, MODE_STYLE, POPULAR_ORIGINS, shortDate, closePopover } from './widgets.js';

const $app = document.getElementById('app');
const state = { user: undefined, meta: null, all: [], photos: {}, search: loadSearch(), roundtrip: loadRoundtrip() };

// ---------- Utility ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const czk = (n) => `${Math.round(n || 0).toLocaleString('cs-CZ')} Kč`;
const MONTHS = ['L', 'Ú', 'B', 'D', 'K', 'Č', 'Č', 'S', 'Z', 'Ř', 'L', 'P'];
const MONTHS_FULL = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
const DAYS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
const COVERS = {
  europe: ['#cfe3ff', '#ffe0e0'], asia: ['#ffe7c7', '#ffd1dc'], africa: ['#ffe2c2', '#fff1b8'],
  north_america: ['#e3dcff', '#d3e8ff'], south_america: ['#d3f5df', '#fff3c4'], oceania: ['#cdf0ff', '#d9e4ff'],
};
const cover = (c) => `--c1:${COVERS[c]?.[0] || '#eee'};--c2:${COVERS[c]?.[1] || '#f6f6f6'}`;
const fmtDate = (iso, opts = { day: 'numeric', month: 'numeric', year: 'numeric' }) => (iso ? new Date(iso).toLocaleDateString('cs-CZ', opts) : '');
const fmtRange = (a, b) => (a ? `${fmtDate(a, { day: 'numeric', month: 'numeric' })} – ${fmtDate(b)}` : 'Bez data');
const plural = (n, one, few, many) => `${n} ${n === 1 ? one : n > 1 && n < 5 ? few : many}`;
const AVATAR_TONES = ['', 'sky', 'gold', 'lav'];
const initials = (name = '?') => name.replace(/\(.*?\)/g, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?';

const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  bed: '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
const enc = encodeURIComponent;
const dHref = (id) => `#/d/${enc(id)}`;
const photoUrl = (destId) => `/api/destinations/${enc(destId)}/photo`;
// Známé fotky jdou rovnou z Wikimedie v potřebné velikosti (bez přesměrování přes server).
const photoSrc = (destId, size = 640) => {
  const u = state.photos?.[destId];
  return u ? u.replace(/\/\d+px-/, `/${size}px-`) : photoUrl(destId);
};
const photo = (destId, emoji = '🌍', alt = '', size = 640) => `<img src="${photoSrc(destId, size)}" alt="${esc(alt)}" loading="lazy" decoding="async" onload="this.classList.add('loaded')" onerror="this.remove()"><div class="fallback">${emoji}</div>`;
const time = (t) => (t ? t.slice(11, 16) : '');
const dayLabel = (t) => (t ? new Date(t.slice(0, 10)).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' }) : '');
const fmtMin = (m) => (m ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : '');
const legMinutes = (a, b) => Math.round((new Date(`${b}Z`) - new Date(`${a}Z`)) / 60000);

const CATS = {
  beach: ['🏖️', 'var(--sky-soft)'], mountains: ['🏔️', 'var(--fill)'], city: ['🏙️', 'var(--lavender-soft)'], nature: ['🌿', 'var(--mint-soft)'],
  culture: ['🏛️', 'var(--gold-soft)'], food: ['🍝', 'var(--coral-soft)'], adventure: ['🧗', 'var(--sky-soft)'], ski: ['⛷️', 'var(--fill)'],
};
const QUICK = [
  { label: '☀️ Teplo v zimě', set: { tags: ['beach'], month: '1', continent: 'world' } },
  { label: '🏔️ Hory v Evropě', set: { tags: ['mountains'], continent: 'europe', month: '' } },
  { label: '🍝 Gastro víkend', set: { tags: ['food'], continent: 'europe', month: '' } },
  { label: '🐘 Exotika do 40 000 Kč', set: { tags: [], continent: 'asia', maxBudget: '40000', month: '' } },
  { label: '🦁 Safari a příroda', set: { tags: ['nature', 'adventure'], continent: 'africa', month: '' } },
];
const KIND = {
  destination: { icon: '📍', bg: 'var(--lavender-soft)', label: 'Destinace' },
  transport: { icon: '✈️', bg: 'var(--sky-soft)', label: 'Doprava' },
  lodging: { icon: '🏨', bg: 'var(--coral-soft)', label: 'Ubytování' },
  note: { icon: '📝', bg: 'var(--gold-soft)', label: 'Poznámka' },
};
const MODE_ICON = { flight: '✈️', bus: '🚌', train: '🚆', combo: '🔀', car: '🚗', walk: '🥾' };
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
  { label: '🎻 Střední Evropa', stops: [['vienna', 'Vídeň', 2], ['budapest', 'Budapešť', 3], ['krakow', 'Krakov', 2]] },
  { label: '🍝 Italská klasika', stops: [['venice', 'Benátky', 2], ['florence', 'Florencie a Toskánsko', 3], ['rome', 'Řím', 3]] },
  { label: '💃 Iberská cesta', stops: [['barcelona', 'Barcelona', 3], ['seville', 'Sevilla a Andalusie', 3], ['lisbon', 'Lisabon', 3], ['porto', 'Porto', 2]] },
  { label: '⛩️ Japonsko a Korea', stops: [['tokyo', 'Tokio', 4], ['kyoto', 'Kjóto', 3], ['seoul', 'Soul', 3]] },
  { label: '🏝️ Řecko a Balkán', stops: [['split', 'Split', 3], ['dubrovnik', 'Dubrovník', 2], ['athens', 'Athény', 2], ['santorini', 'Santorini', 3]] },
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
  toast('Odkaz zkopírován ✓');
}

// ---------- Hlavička ----------
function renderAccount() {
  const el = document.getElementById('account');
  const bottom = document.getElementById('bottom-account');
  if (state.user) {
    el.innerHTML = `<a class="hdr-icon" href="#/chat" title="Přátelé a zprávy" aria-label="Přátelé a zprávy"><svg class="icon" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg><span class="badge" data-chat-badge hidden></span></a>
      <span class="user-name">${esc(state.user.name)}</span>
      <a class="avatar" href="#/account" title="${esc(state.user.email)}">${esc(initials(state.user.name))}</a>`;
    bottom.href = '#/account';
  } else {
    el.innerHTML = `<a class="btn glass sm" href="#/login">Přihlásit</a><a class="btn sm" href="#/register">Registrace</a>`;
    bottom.href = '#/login';
  }
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
    document.body.dataset.view = nav === 'explore' ? 'explore' : '';
    try { await view(...m.slice(1)); } catch (e) { $app.innerHTML = emptyState('😕', e.message, '<a class="btn" href="#/">Zpět na objevování</a>'); }
    window.scrollTo(0, 0);
    return;
  }
  $app.innerHTML = emptyState('🧭', 'Tahle stránka neexistuje.', '<a class="btn" href="#/">Zpět na objevování</a>');
}
const emptyState = (emoji, text, action = '') => `<div class="empty"><div class="big">${emoji}</div><p>${esc(text)}</p>${action}</div>`;

// ---------- Objevování ----------
async function viewSearch() {
  const s = state.search;
  const { continents, tags } = state.meta;
  const count = (tag) => state.all.filter((d) => d.tags.includes(tag)).length;
  $app.innerHTML = `
    <section class="hero">
      ${state.user ? `<span class="pill sky hello">AHOJ ${esc(state.user.name.split(' ')[0].toUpperCase())}, VÍTEJ ZPĚT</span>` : `<span class="pill coral hello">✨ ${state.all.length} DESTINACÍ + JAKÉKOLI MÍSTO NA SVĚTĚ</span>`}
      <h1>Kam tě srdce táhne <span class="accent">tentokrát?</span></h1>
      <p class="lead">Napiš město, adresu nebo zemi kdekoli na světě. Ukážeme ti letenky, vlaky, autobusy i ubytování na jednom místě.</p>
      <div class="dock-tabs" role="tablist">
        <button role="tab" data-tab="trip" aria-selected="${s.tab !== 'route'}">${icon('pin', 'sm')} <span>Výlet do jednoho místa</span><span class="short">Jedno místo</span></button>
        <button role="tab" data-tab="route" aria-selected="${s.tab === 'route'}">🔁 <span>Okružní cesta po více městech</span><span class="short">Okružní cesta</span></button>
      </div>
      <div id="dock"></div>
      <div class="quick"><span class="eyebrow">Rychlá volba:</span>${QUICK.map((q, i) => `<button class="chip" data-quick="${i}">${q.label}</button>`).join('')}</div>
    </section>

    <section id="deals" class="deals"></section>

    <div class="section-head"><div><span class="eyebrow">Kategorie</span><h2>Prozkoumej podle stylu cesty</h2></div></div>
    <div class="cats">${Object.entries(tags).map(([id, name]) => `
      <button class="cat" data-tag="${id}" aria-pressed="${s.tags.includes(id)}">
        <span class="ico" style="background:${CATS[id]?.[1]}">${CATS[id]?.[0] || '✨'}</span>
        <b>${esc(name)}</b><span class="small">${plural(count(id), 'destinace', 'destinace', 'destinací')}</span>
      </button>`).join('')}</div>

    <div class="section-head">
      <div><span class="eyebrow coral">Výběr pro tebe</span><h2 id="count">Destinace</h2></div>
      <span class="small muted" id="estimate-note"></span>
    </div>
    <div class="toolbar">
      <div class="chips" role="group" aria-label="Kontinent">
        <button class="chip" data-continent="world" aria-pressed="${s.continent === 'world'}">🌍 Celý svět</button>
        ${Object.entries(continents).map(([id, name]) => `<button class="chip" data-continent="${id}" aria-pressed="${s.continent === id}">${esc(name)}</button>`).join('')}
      </div>
      <div class="selects">
        <select id="maxBudget" aria-label="Rozpočet na osobu">${[['', 'Rozpočet: bez limitu'], [15000, 'do 15 000 Kč / os.'], [25000, 'do 25 000 Kč / os.'], [40000, 'do 40 000 Kč / os.'], [60000, 'do 60 000 Kč / os.'], [90000, 'do 90 000 Kč / os.']]
          .map(([v, l]) => `<option value="${v}" ${String(s.maxBudget) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select id="month" aria-label="Sezóna"><option value="">Sezóna: kdykoli</option>${MONTHS_FULL.map((m, i) => `<option value="${i + 1}" ${String(s.month) === String(i + 1) ? 'selected' : ''}>Ideální v: ${m}</option>`).join('')}</select>
        <select id="sort" aria-label="Řazení">${[['recommended', 'Řadit: doporučené'], ['price', 'Řadit: nejlevnější'], ['distance', 'Řadit: nejblíž'], ['name', 'Řadit: podle názvu']]
          .map(([v, l]) => `<option value="${v}" ${s.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>
    </div>
    <div class="grid" id="results">${'<div class="skeleton" style="height:340px"></div>'.repeat(6)}</div>`;

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
        <button type="button" class="btn ghost sm icon-only" data-rm="${i}" aria-label="Odebrat">${icon('x', 'sm')}</button></li>`).join('')
      || '<li class="stops-empty">Přidej města, která chceš projet – třeba Vídeň, Budapešť a Krakov. Nebo vyber hotovou trasu níž.</li>'}</ol>
    <div class="round-foot">
      <label class="check"><input type="checkbox" id="rt-home" ${r.returnHome ? 'checked' : ''}> Vrátit se domů (${esc(originName())})</label>
      <span class="small muted">${r.stops.length ? `${plural(r.stops.length, 'zastávka', 'zastávky', 'zastávek')} · ${plural(total, 'noc', 'noci', 'nocí')} · návrat ${shortDate(new Date(new Date(r.start).getTime() + total * 86400000).toISOString().slice(0, 10))}` : ''}</span>
      <button class="btn" id="rt-go" ${r.stops.length ? '' : 'disabled'}>🗺️ Naplánovat trasu</button>
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
  el.innerHTML = `<div class="section-head"><div><span class="eyebrow coral">🔥 Akční letenky a ubytování</span><h2>Nejlevnější termíny na půl roku dopředu</h2></div></div><div class="deal-row">${'<div class="skeleton deal-skel"></div>'.repeat(4)}</div>`;
  let data;
  try { data = await api(`/deals?${new URLSearchParams({ origin: state.search.origin })}`); } catch { el.innerHTML = ''; return; }
  if (!document.body.contains(el)) return;
  let month = data.months[0]?.month;
  const render = () => {
    const deals = data.months.find((m) => m.month === month)?.deals || [];
    el.innerHTML = `
      <div class="section-head"><div><span class="eyebrow coral">🔥 Akční letenky a ubytování</span><h2>Nejlevnější termíny na půl roku dopředu</h2></div>
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
              <span>✈️ Letenka <s>${czk(x.oldFlight)}</s> <b>${czk(x.flight)}</b></span>
              <span>🛏️ Hotel / noc <s>${czk(x.oldHotelPerNight)}</s> <b>${czk(x.hotelPerNight)}</b></span>
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
    el.innerHTML = `<div style="grid-column:1/-1">${emptyState('🏝️', 'Těmto filtrům nic neodpovídá. Zkus uvolnit rozpočet nebo typ výletu.', '<button class="btn glass" id="reset">Zrušit filtry</button>')}</div>`;
    document.getElementById('reset').onclick = () => { Object.assign(state.search, { continent: 'world', q: '', tags: [], maxBudget: '', month: '' }); saveSearch(); viewSearch(); };
    return;
  }
  el.innerHTML = results.map((d) => `
    <a class="card dest-card" href="${dHref(d.id)}">
      <div class="media" style="${cover(d.continent)}">
        ${photo(d.id, d.emoji, d.name)}
        <div class="badges"><span class="pill glass">${icon('pin', 'sm')} ${esc(state.meta.continents[d.continent])}</span>${s.month && d.bestMonths.includes(Number(s.month)) ? '<span class="pill mint">Ideální sezóna</span>' : ''}</div>
        <button class="heart" data-save="${d.id}" aria-label="Uložit ${esc(d.name)} do výletu">${icon('heart')}</button>
      </div>
      <div class="dest-body">
        <div class="loc">${esc(d.country)} · ${d.distanceKm.toLocaleString('cs-CZ')} km</div>
        <h3>${esc(d.name)}</h3>
        <p>${esc(d.description)}</p>
        <div class="tags">${d.tags.slice(0, 3).map((t) => `<span class="pill">${esc(state.meta.tags[t])}</span>`).join('')}</div>
        <div class="dest-foot">
          <div><span class="small faint">od</span><div class="price">${czk(d.estimate.perPerson)} <small>/ os.</small></div></div>
          <span class="pill sky">${icon('plane', 'sm')} ~${flightHours(d.distanceKm)}</span>
        </div>
      </div>
    </a>`).join('');
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
    <a href="#/" class="back">${icon('back', 'sm')} Zpět na objevování</a>
    <section class="photo-hero">
      <div class="media" style="${cover(d.continent)}">${photo(d.id, d.emoji, d.name, 1280)}</div>
      <span class="credit">Foto: Wikimedia Commons</span>
      <div class="content">
        <div class="tags"><span class="pill glass">${icon('pin', 'sm')} ${esc(d.country.toUpperCase())} · ${esc((continentName || '').toUpperCase())}</span>${tagNames.slice(0, 2).map((t) => `<span class="pill glass">${esc(t)}</span>`).join('')}</div>
        <h1 style="margin-top:12px">${esc(d.name)}</h1>
        <p>${esc(d.description)}</p>
        <div class="actions">
          <button class="btn glass" id="save-dest">${icon('heart')} Uložit destinaci</button>
          <button class="btn glass" id="add-round">🔁 Přidat do okružní cesty</button>
          <button class="btn" id="go-offers">${icon('search')} Najít dopravu a ubytování</button>
        </div>
      </div>
    </section>
    <div class="glass-card facts">
      <div class="fact"><span class="ico" style="background:var(--gold-soft)">☀️</span><div><span class="label">Počasí</span><b id="f-weather">…</b></div></div>
      <div class="fact"><span class="ico" style="background:var(--sky-soft)">✈️</span><div><span class="label">Letiště</span><b>${esc(d.airport)}${d.airportDistanceKm > 5 ? ` · ${d.airportDistanceKm} km` : ''}</b></div></div>
      <div class="fact"><span class="ico" style="background:var(--mint-soft)">💶</span><div><span class="label">Měna</span><b>${esc(d.currency || '—')}</b></div></div>
      <div class="fact"><span class="ico" style="background:var(--lavender-soft)">🕒</span><div><span class="label">Časový posun</span><b id="f-tz">…</b></div></div>
      <div class="fact"><span class="ico" style="background:var(--coral-soft)">🍽️</span><div><span class="label">Denní útrata</span><b>~${czk(d.dailyCost)} / os.</b></div></div>
    </div>
    ${profileHints(d, langCodes)}

    <div class="glass-card route-bar" id="route-bar"></div>

    <div class="detail-grid">
      <div id="offers"><div class="offers">${'<div class="skeleton"></div>'.repeat(4)}</div></div>
      <aside class="side sticky">
        <div class="card summary" id="summary"><div class="skeleton" style="height:140px"></div></div>
        <div class="card map-card"><div class="map" id="dest-map"></div></div>
        <div class="card pad" id="weather-card"><h3>☀️ Předpověď počasí</h3><div class="weather">${'<div class="skeleton" style="height:96px;border-radius:14px"></div>'.repeat(5)}</div></div>
        ${d.bestMonths.length ? `<div class="card pad"><h3>🗓️ Nejlepší sezóna</h3><div class="months">${MONTHS.map((m, i) => `<span class="${d.bestMonths.includes(i + 1) ? 'on' : ''}" title="${MONTHS_FULL[i]}">${m}</span>`).join('')}</div>
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
      <span class="meta">${icon('plane', 'sm')} → ${esc(d.name)}</span>`;
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
    toast(`Přidáno do okružní cesty (${r.stops.length}) ✓`);
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
    card.innerHTML = `<h3>☀️ Předpověď pro ${esc(d.name)}</h3>
      <div class="weather">${w.days.map((x) => `<div><span>${DAYS[new Date(x.date).getDay()]} ${new Date(x.date).getDate()}.</span><div class="w-ico">${x.icon}</div><b>${x.max}°</b><span class="faint">${x.min}°</span></div>`).join('')}</div>
      <p class="small muted" style="margin-top:10px">Aktuální předpověď na 5 dní (Open-Meteo).</p>`;
  } catch {
    document.getElementById('f-weather')?.replaceChildren('—');
    document.getElementById('f-tz')?.replaceChildren('—');
    card.innerHTML = '<h3>☀️ Předpověď počasí</h3><p class="small muted" style="margin-top:8px">Počasí se teď nepodařilo načíst.</p>';
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
    ${anyMock ? `<div class="notice">ℹ️ <span>Některé ceny jsou <b>ukázkové</b>, protože pro ně ještě nejsou vložené API klíče. Tlačítka „Otevřít“ vedou na skutečné hledání u poskytovatele.</span></div>` : ''}
    ${data.errors?.length ? `<div class="notice">⚠️ <span>Některé vyhledávače teď neodpověděly: ${data.errors.map((e) => esc(e.providerName)).join(', ')}.</span></div>` : ''}
    <section data-kind="transport">
      <div class="section-title"><span class="ico" style="background:var(--sky-soft);color:var(--sky)">${icon('plane', 'sm')}</span><h2 style="font-size:20px">Doprava z ${esc(ctx.originName)}</h2><span class="count">${plural(transport.length, 'nabídka', 'nabídky', 'nabídek')}</span></div>
      <div class="offers">${transport.map((o, i) => transportCard(o, i, ctx, d)).join('') || '<p class="muted">Pro tuto destinaci tu zatím nic nemáme.</p>'}</div>
      ${compareLinks(links.transport)}
    </section>
    <section data-kind="lodging">
      <div class="section-title"><span class="ico airbnb-ico">${AIRBNB_LOGO}</span><h2 style="font-size:20px">Airbnb v destinaci ${esc(d.name)}</h2><span class="count">${plural(lodging.length, 'nabídka', 'nabídky', 'nabídek')}</span></div>
      ${lodging.some((o) => o.mock) ? '<p class="small muted" style="margin:-4px 0 12px">Ukázkové nabídky – klik otevře Airbnb s tímto místem, termínem a počtem hostů. Skutečné inzeráty s fotkami a přímým odkazem se ukážou po vložení klíče SerpApi.</p>' : ''}
      <div class="bnb-grid">${lodging.map((o, i) => lodgingCard(o, i, d)).join('') || '<p class="muted">Pro tuto destinaci tu zatím nic nemáme.</p>'}</div>
      ${links.lodging[0] ? `<a class="btn glass" style="margin-top:14px" href="${esc(links.lodging[0].url)}" target="_blank" rel="noopener">Všechny nabídky v mapě Airbnb ${icon('ext', 'sm')}</a>` : ''}
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
      ctx.originPoint && { lat: ctx.originPoint.lat, lng: ctx.originPoint.lng, label: ctx.originName, sub: 'Odjezd', kind: 'origin', color: '#007aff' },
      { lat: d.lat, lng: d.lng, label: d.name, sub: d.country, num: '📍', color: '#ff5a5f' },
      ...lodging.filter((o) => o.location).map((o) => ({ lat: o.location.lat, lng: o.location.lng, label: o.title, sub: `${czk(o.price)} · ${o.providerName}`, kind: 'stay', color: '#007aff' })),
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
      ${wait != null && wait > 0 ? `<div class="transfer">🔁 Přestup ${esc(l.to)} · ${fmtMin(wait)}${next.mode !== l.mode ? ` · ${esc(MODE_STYLE[l.mode]?.label || '')} → ${esc(MODE_STYLE[next.mode]?.label || '')}` : ''}</div>` : ''}
    </li>`;
  }).join('')}</ol>`;
}

function transportDetail(o, ctx, d, onSave) {
  const per = o.price / ctx.persons;
  const legs = [...(o.legs || []), ...(o.returnLegs || [])];
  modal(`
    <div class="detail-head">
      ${logo(o.providerName)}
      <div class="grow"><span class="small muted">${esc(o.providerName)}${o.mock ? ' · ukázková data' : ''}</span><h2>${MODE_ICON[o.mode] || '✈️'} ${esc(o.title)}</h2><div class="small muted">${esc(o.subtitle)}</div></div>
      <button class="btn ghost sm icon-only" data-close aria-label="Zavřít">${icon('x', 'sm')}</button>
    </div>
    <div class="detail-price"><div><div class="price">${czk(per)}</div><span class="small muted">za osobu · ${esc(o.priceNote.split('·').pop().trim())}</span></div><div style="text-align:right"><b>${czk(o.price)}</b><span class="small muted" style="display:block">celkem za ${plural(ctx.persons, 'osobu', 'osoby', 'osob')}</span></div></div>
    <div class="map small-map" id="offer-map"></div>
    <h3 class="leg-title">Tam · ${dayLabel(o.legs?.[0]?.depart || ctx.from)}${o.durationMin ? ` · ${fmtMin(o.durationMin)}` : ''}</h3>
    ${o.legs?.[0]?.routable ? '<div id="own-route"><div class="skeleton" style="height:80px"></div></div>' : legsTimeline(o.legs)}
    ${o.returnLegs?.length && !o.own ? `<h3 class="leg-title">Zpět · ${dayLabel(o.returnLegs[0].depart)}</h3>${legsTimeline(o.returnLegs)}` : ''}
    <div class="tags" style="margin-top:12px">${o.details.map((x) => `<span class="pill">${esc(x)}</span>`).join('')}</div>
    ${discountNote(o, per, true)}
    ${searchLinksHtml(o)}
    <div class="modal-actions"><button class="btn glass" id="m-save">${icon('plus', 'sm')} Do výletu</button><a class="btn sky" href="${esc(o.deepLink)}" target="_blank" rel="noopener">${o.own ? 'Otevřít v Google Maps' : (o.searchLinks?.[0]?.url === o.deepLink ? `Vyhledat spoj – ${esc(o.searchLinks[0].name.split(' – ')[0])}` : `Koupit u ${esc(o.providerName)}`)} ${icon('ext', 'sm')}</a></div>`, (m) => {
    m.querySelector('#m-save').onclick = () => onSave(o);
    const own = o.legs?.[0]?.routable ? o.legs[0] : null;
    if (own) {
      // Pěšky / autem: skutečná trasa po silnicích a stezkách + pokyny po krocích
      const box = m.querySelector('#own-route');
      const from = { lat: own.fromPt[0], lng: own.fromPt[1] }; const to = { lat: own.toPt[0], lng: own.toPt[1] };
      api(`/directions?${new URLSearchParams({ from: own.fromPt.join(','), to: own.toPt.join(','), mode: own.mode === 'walk' ? 'foot' : 'car' })}`).then((r) => {
        box.innerHTML = directionsHtml(r, from, to);
        drawMap(m.querySelector('#offer-map'), { points: [{ ...from, label: own.from, num: 'A', color: '#007aff' }, { ...to, label: own.to, num: 'B' }], segments: [{ from: own.fromPt, to: own.toPt, mode: own.mode, path: r.geometry, label: `${own.from} → ${own.to}` }] });
      }).catch(() => { box.innerHTML = ''; });
    }
    const segs = legs.filter((l) => l.fromPt && l.toPt).map((l) => ({ from: l.fromPt, to: l.toPt, mode: l.mode, label: `${l.from} → ${l.to}` }));
    const stops = [];
    for (const l of o.legs || []) if (l.fromPt) stops.push({ lat: l.fromPt[0], lng: l.fromPt[1], label: l.from, sub: `odjezd ${time(l.depart)}` });
    const last = o.legs?.at(-1);
    if (last?.toPt) stops.push({ lat: last.toPt[0], lng: last.toPt[1], label: last.to, sub: `příjezd ${time(last.arrive)}` });
    if (segs.length) drawMap(m.querySelector('#offer-map'), { points: stops.map((p, i) => ({ ...p, num: i + 1, color: i === 0 ? '#007aff' : i === stops.length - 1 ? '#ff5a5f' : '#ff9f0a' })), segments: segs });
    else if (ctx.originPoint) drawMap(m.querySelector('#offer-map'), { points: [{ lat: ctx.originPoint.lat, lng: ctx.originPoint.lng, label: ctx.originName, num: 1, color: '#007aff' }, { lat: d.lat, lng: d.lng, label: d.name, num: 2 }], segments: [{ from: [ctx.originPoint.lat, ctx.originPoint.lng], to: [d.lat, d.lng], mode: MODE_STYLE[o.mode] ? o.mode : 'flight' }] });
  }, { wide: true });
}

const compareLinks = (links) => (links.length
  ? `<div class="compare-links"><span class="small muted">Porovnat i na:</span>${links.map((l) => `<a class="chip" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)} ${icon('ext')}</a>`).join('')}</div>` : '');

const stayEmoji = (o) => (/pokoj|hostel/i.test(o.title) ? '🛏️' : /vila|dům|chata/i.test(o.title) ? '🏡' : '🏠');

// Sleva podle věku z profilu (jen vlaky a autobusy; u letenek se věkové slevy skoro nedávají).
function discountNote(o, per, long = false) {
  const disc = ageDiscount();
  if (!disc || !['train', 'bus', 'combo'].includes(o.mode)) return '';
  const after = Math.round(per * (1 - disc.pct / 100));
  return long ? `<div class="notice mint">🎟️ <span>${esc(disc.label)}. Odhad pro tebe: <b>${czk(after)}</b> místo ${czk(per)}.</span></div>`
    : `<span class="pill mint" title="${esc(disc.label)}">🎟️ ${disc.pct === 100 ? 'zdarma' : `−${disc.pct} % ≈ ${czk(after)}`}</span>`;
}
const searchLinksHtml = (o) => (o.searchLinks?.length
  ? `<div class="search-links"><span class="small muted">Tenhle spoj už vyhledaný na:</span>${o.searchLinks.map((l) => `<a class="chip" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)} ${icon('ext')}</a>`).join('')}</div>` : '');

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
      <div class="mid"><span>${MODE_ICON[o.mode] || '✈️'} ${esc(o.durationMin ? fmtMin(o.durationMin) : duration.replace('~', ''))}</span>
        <div class="line legline">${legs.map((l) => `<i class="seg ${l.mode}" style="flex:${Math.max(1, l.durationMin || 1)}" title="${esc(`${MODE_STYLE[l.mode]?.label || ''} ${l.from} → ${l.to}`)}"></i>`).join('')}</div>
        <span class="${direct ? 'direct' : ''}">${legs.length > 1 ? legs.map((l) => MODE_STYLE[l.mode]?.icon || '').join(' ') + ' · ' : ''}${esc(o.subtitle)}</span></div>
      <div class="code" style="text-align:right">${esc(time(legs.at(-1)?.arrive) || d.airport)}<small>${esc(legs.at(-1)?.to || d.name)}</small></div>
    </div>
    <div class="offer-foot">
      <div class="meta">${extra.map((x) => `<span>${esc(x)}</span>`).join('')}${discountNote(o, per)}</div>
      <div class="actions">
        <button class="btn glass sm" data-save="${esc(o.id)}">${icon('plus', 'sm')} Do výletu</button>
        <span class="btn ghost sm">Podrobnosti</span>
        <a class="btn sky sm" href="${esc(o.deepLink)}" target="_blank" rel="noopener">Vybrat ${icon('ext', 'sm')}</a>
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
      <button class="bnb-heart" data-save="${esc(o.id)}" aria-label="Uložit do výletu">${icon('heart')}</button>
      ${pics.length > 1 ? `<span class="bnb-dots">${pics.map((_, k) => `<i class="${k ? '' : 'on'}"></i>`).join('')}</span>` : ''}
    </div>
    <div class="bnb-body">
      <div class="bnb-row"><b class="bnb-title">${esc(o.title)}</b><span class="bnb-rating">${ratingText(o)}</span></div>
      <span class="bnb-sub">${esc(o.subtitle)}</span>
      <span class="bnb-sub">${esc(o.details.slice(0, 3).join(' · '))}</span>
      <div class="bnb-price">${o.oldPrice ? `<s>${czk(o.oldPrice)}</s> ` : ''}<b>${czk(o.price)}</b> celkem <span>· ${esc(o.priceNote.split('·')[0].trim())}</span></div>
      <span class="bnb-open">${o.direct ? 'Otevřít inzerát na Airbnb' : 'Hledat na Airbnb v tomto místě'} ${icon('ext', 'sm')}</span>
    </div>
  </a>`;
}

// ---------- Okružní cesta ----------
const STOP_COLORS = ['#ff5a5f', '#ff9f0a', '#34c759', '#007aff', '#af52de', '#ff2d55', '#5ac8fa', '#a2845e'];

async function viewRoundtrip() {
  const r = state.roundtrip;
  const s = state.search;
  if (!r.stops.length) {
    $app.innerHTML = emptyState('🗺️', 'Okružní cesta zatím nemá žádné zastávky.', '<a class="btn" href="#/">Naplánovat na hlavní stránce</a>');
    return;
  }
  $app.innerHTML = `<a href="#/" class="back">${icon('back', 'sm')} Upravit trasu</a>
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
        <span class="rt-dot" style="background:${MODE_STYLE[o?.legs?.[0]?.mode || o?.mode]?.color || '#8e8e93'}">${MODE_ICON[o?.mode] || '🧭'}</span>
        <div class="card rt-card">
          <div class="rt-row"><div class="grow"><span class="eyebrow faint">${dayLabel(leg.date)} · ${leg.distanceKm.toLocaleString('cs-CZ')} km</span>
            <h3>${esc(leg.from.name)} → ${esc(leg.to.name)}</h3>
            ${o ? `<div class="small muted">${esc(o.title)} · ${esc(o.subtitle)}${o.legs?.length ? ` · ${time(o.legs[0].depart)} → ${time(o.legs.at(-1).arrive)}` : ''}</div>` : '<div class="small muted">Žádný spoj jsme nenašli – zkus odkazy níže.</div>'}</div>
            ${o ? `<div class="amount"><div class="price">${czk(o.price)}</div><span class="small faint">${czk(o.price / persons)} / os.</span></div>` : ''}</div>
          ${leg.options.length ? `<div class="opts">${leg.options.map((x, k) => `<button class="opt" data-leg="${i}" data-k="${k}" aria-pressed="${k === sel.legs[i]}">
            <span>${MODE_ICON[x.mode] || '✈️'} ${esc(x.mode === 'flight' ? 'Let' : x.mode === 'combo' ? 'Kombinace' : x.mode === 'bus' ? 'Autobus' : 'Vlak')}</span><b>${czk(x.price)}</b><small>${fmtMin(x.durationMin)}${x.changes ? ` · ${plural(x.changes, 'přestup', 'přestupy', 'přestupů')}` : ' · přímo'}</small></button>`).join('')}
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
              ${h ? `<div class="small muted">🛏️ ${esc(h.title)}${h.rating ? ` · ★ ${h.rating}` : ''} · ${esc(h.providerName)}</div>` : ''}</div>
            ${h ? `<div class="amount"><div class="price">${czk(h.price)}</div><span class="small faint">${esc(h.priceNote.split('·')[0])}</span></div>` : ''}
          </div>
          ${st.options.length ? `<div class="opts">${st.options.map((x, k) => `<button class="opt" data-stay="${i}" data-k="${k}" aria-pressed="${k === sel.stays[i]}"><span>${stayEmoji(x)} ${esc(x.title.length > 26 ? `${x.title.slice(0, 24)}…` : x.title)}</span><b>${czk(x.price)}</b><small>${esc(x.providerName)}${x.rating ? ` · ★ ${x.rating}` : ''}</small></button>`).join('')}
            ${h ? `<a class="opt more" href="${esc(h.deepLink)}" target="_blank" rel="noopener">Otevřít na Airbnb →</a>` : ''}</div>` : ''}
        </div></div>`;
    });

    $app.innerHTML = `<a href="#/" class="back">${icon('back', 'sm')} Upravit trasu</a>
      <section class="glass-card trip-head">
        <div>
          <div class="badges"><span class="pill">${icon('calendar', 'sm')} ${fmtRange(plan.start, plan.end)}</span><span class="pill sky">${icon('users', 'sm')} ${plural(persons, 'osoba', 'osoby', 'osob')}</span><span class="pill mint">${plural(plan.stays.length, 'zastávka', 'zastávky', 'zastávek')} · ${plural(countries.length, 'země', 'země', 'zemí')}</span></div>
          <h1>${esc([plan.origin.name, ...plan.stays.map((x) => x.place.name), ...(plan.returnHome ? [plan.origin.name] : [])].join(' → '))}</h1>
          <div class="actions"><button class="btn" id="rt-save">${icon('heart')} Uložit jako výlet</button><button class="btn glass" id="rt-cheap">💸 Vybrat nejlevnější</button><button class="btn glass" id="rt-fast">⚡ Vybrat nejrychlejší</button></div>
        </div>
        <div class="budget"><div><span class="eyebrow faint">Doprava + ubytování</span><div class="price" style="font-size:26px">${czk(total)}</div>
          <div class="small muted">${czk(total / persons)} na osobu · ${plural(nightsTotal, 'noc', 'noci', 'nocí')}</div>
          <div class="bar" style="margin-top:10px;width:220px"><span style="width:${total ? (legCost / total) * 100 : 0}%;background:var(--coral)"></span><span style="width:${total ? (stayCost / total) * 100 : 0}%;background:var(--sky)"></span></div>
          <div class="small faint" style="margin-top:6px">Doprava ${czk(legCost)} · Ubytování ${czk(stayCost)}</div></div></div>
      </section>
      <div class="route-layout">
        <div class="card map-card big sticky"><div class="map" id="route-map"></div></div>
        <div class="rt-timeline">
          <div class="rt-item"><span class="rt-dot" style="background:var(--sky)">🏠</span><div class="rt-start"><b>Start: ${esc(plan.origin.name)}</b><span class="small muted">${dayLabel(plan.start)}</span></div></div>
          ${html}
          ${plan.returnHome ? `<div class="rt-item"><span class="rt-dot" style="background:var(--sky)">🏁</span><div class="rt-start"><b>Doma: ${esc(plan.origin.name)}</b><span class="small muted">${dayLabel(plan.end)}</span></div></div>` : ''}
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
        { lat: plan.origin.lat, lng: plan.origin.lng, label: plan.origin.name, sub: `Start ${dayLabel(plan.start)}`, kind: 'origin', color: '#007aff' },
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
        toast('Okružní cesta uložena ✓');
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
    } else if (it.kind === 'transport') {
      for (const l of [...(d.legs || []), ...(d.returnLegs || [])]) if (l.fromPt && l.toPt) segments.push({ from: l.fromPt, to: l.toPt, mode: l.mode, label: `${dayLabel(l.depart)} ${l.from} → ${l.to}` });
    }
  }
  return { points, segments };
}

// ---------- Prozkoumat: mapa s piny s fotkami ----------
const EXPLORE_CATS = {
  all: ['✨', 'Vše', '#1c1c1e'], gems: ['💎', 'Hidden gems', '#00a6a6'], trend: ['🔥', 'Trendy', '#ff3b30'], nature: ['🌲', 'Příroda', '#34c759'], sight: ['🏰', 'Památky', '#ff9f0a'],
  culture: ['🎭', 'Kultura', '#af52de'], other: ['📍', 'Ostatní', '#007aff'], dest: ['🧳', 'Destinace', '#ff5a5f'],
};
const exploreState = { cat: 'all', places: [], gems: [], view: null };
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
    <section class="explore">
      <div class="explore-map" id="explore-map"></div>
      <div class="explore-top">
        <div class="glass-card explore-search ac-wrap">${icon('search')}<input id="ex-q" placeholder="Najdi místo, horu, město…"></div>
        <div class="chips explore-cats">${Object.entries(EXPLORE_CATS).filter(([k]) => k !== 'dest').map(([k, [e, l]]) => `<button class="chip" data-cat="${k}" aria-pressed="${exploreState.cat === k}">${e} ${l}</button>`).join('')}</div>
      </div>
      <button class="btn glass sm locate" id="ex-locate">📍 Moje poloha</button>
      <aside class="explore-panel" id="ex-panel"></aside>
    </section>`;
  const L = await loadLeaflet().catch(() => null);
  const el = document.getElementById('explore-map');
  if (!L || !el) { if (el) el.innerHTML = '<div class="map-fallback">Mapu se nepodařilo načíst.</div>'; return; }
  const map = L.map(el, { zoomControl: false, worldCopyJump: true, ...touchMapOptions() });
  twoFingerHint(el);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  baseTiles(L, map, { withLayers: true, extraAttr: ' · místa: Wikipedie, OSM, Reddit' });
  // Panel zakrývá pravý (na mobilu spodní) okraj mapy – při posunech s tím počítáme.
  const pad = () => (window.innerWidth >= 900 ? { paddingTopLeft: [20, 120], paddingBottomRight: [420, 20] } : { paddingTopLeft: [10, 110], paddingBottomRight: [10, Math.round(window.innerHeight * 0.46)] });
  const v = exploreState.view;
  if (v) map.setView(v.center, v.zoom); else map.fitBounds([[36, -10], [60, 30]], pad());
  if ('ResizeObserver' in window) new ResizeObserver(() => map.invalidateSize()).observe(el);

  map._tfPad = pad;
  // Přelet tak, aby cíl nebyl schovaný pod panelem.
  const flyPad = (lat, lng, zoom) => {
    const off = window.innerWidth >= 900 ? [205, -40] : [0, Math.round(window.innerHeight * 0.2)];
    const target = map.unproject(map.project([lat, lng], zoom).add(off), zoom);
    map.flyTo(target, zoom, { duration: 0.8 });
  };
  const layer = L.layerGroup().addTo(map);
  const routeLayer = L.layerGroup().addTo(map);
  const panel = document.getElementById('ex-panel');
  let seq = 0; let timer = 0;

  const pin = (p) => {
    const c = EXPLORE_CATS[p.category] || EXPLORE_CATS.other;
    const em = p.emoji || c[0];
    const img = p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createTextNode('${em}'))">` : em;
    return L.divIcon({ className: `photo-pin${p.gem ? ' gem' : ''}`, html: `<span style="--c:${p.gem ? EXPLORE_CATS.gems[2] : c[2]}">${img}</span>${p.gem ? '<i>💎</i>' : ''}`, iconSize: [46, 46], iconAnchor: [23, 23] });
  };
  const visible = () => {
    const all = [...exploreState.places, ...exploreState.gems];
    if (exploreState.cat === 'all') return all;
    if (exploreState.cat === 'gems') return exploreState.gems;
    if (exploreState.cat === 'trend') return [];
    return all.filter((p) => p.category === exploreState.cat);
  };
  const trendHtml = (t, title = 'Trendy na sítích') => (t?.posts?.length ? `<div class="trend-box"><div class="trend-head"><span>🔥 ${esc(title)}${t.place ? ` · ${esc(t.place)}` : ''}</span><span class="small muted">${esc(t.source || '')}</span></div>
      ${t.posts.slice(0, 8).map((x) => `<a class="trend-row" href="${esc(x.url)}" target="_blank" rel="noopener">${x.thumb ? `<img src="${esc(x.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : '<span class="ti">💬</span>'}
        <span class="grow"><b>${esc(x.title)}</b><small>${esc(x.sub)} · ▲ ${x.score} · ${x.comments} koment. · ${esc(x.created)}</small></span></a>`).join('')}</div>`
    : t?.unavailable ? '<p class="small muted" style="padding:8px 4px">Trendy ze sítí se teď nepodařilo načíst.</p>' : t ? '<p class="small muted" style="padding:8px 4px">O tomhle místě se teď na sítích moc nepíše – možná právě proto stojí za to. 💎</p>' : '');
  let areaTrend = null;

  const renderList = () => {
    if (panel.dataset.mode === 'detail') return;
    const list = visible();
    const zoomedOut = map.getZoom() < 9;
    panel.dataset.mode = 'list';
    const trendOnly = exploreState.cat === 'trend';
    panel.innerHTML = `<div class="panel-handle"></div>
      <div class="panel-head"><div><span class="eyebrow">${zoomedOut ? 'Destinace' : exploreState.cat === 'gems' ? 'Hidden gems v okolí' : 'V okolí'}</span><h3>${zoomedOut ? 'Přibliž mapu a uvidíš místa s fotkami' : trendOnly ? 'Co se teď sdílí na sítích' : plural(list.length, 'zajímavé místo', 'zajímavá místa', 'zajímavých míst')}</h3></div></div>
      ${!zoomedOut && (trendOnly || exploreState.cat === 'all' || exploreState.cat === 'gems') ? `<div id="area-trend">${areaTrend ? trendHtml(areaTrend) : trendOnly ? '<div class="skeleton" style="height:120px"></div>' : ''}</div>` : ''}
      <div class="panel-list">${list.slice(0, 40).map((p) => `<button class="place-row" data-pid="${esc(p.id)}">
        <span class="place-thumb" style="--c:${(EXPLORE_CATS[p.category] || EXPLORE_CATS.other)[2]}">${p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : (EXPLORE_CATS[p.category] || EXPLORE_CATS.other)[0]}</span>
        <span class="grow"><b>${p.gem ? '💎 ' : ''}${esc(p.title)}</b><small>${esc(p.description || (EXPLORE_CATS[p.category] || EXPLORE_CATS.other)[1])}</small></span></button>`).join('')
        || (trendOnly ? '' : '<p class="small muted" style="padding:8px 4px">Tady nic nemáme – zkus jinou kategorii nebo posuň mapu.</p>')}</div>`;
    panel.querySelectorAll('[data-pid]').forEach((b) => b.addEventListener('click', () => openPlace(visible().find((p) => p.id === b.dataset.pid))));
  };
  const renderPins = () => {
    layer.clearLayers();
    // Piny se nesmí překrývat: na malém přiblížení necháme jen ty, které mají kolem sebe místo.
    const kept = []; const shown = []; const gap = window.innerWidth < 600 ? 40 : 46;
    for (const p of visible()) {
      const pt = map.latLngToContainerPoint([p.lat, p.lng]);
      if (kept.some((k) => Math.abs(k.x - pt.x) < gap && Math.abs(k.y - pt.y) < gap)) continue;
      kept.push(pt); shown.push(p);
      if (shown.length >= 90) break;
    }
    for (const p of shown) L.marker([p.lat, p.lng], { icon: pin(p), riseOnHover: true }).on('click', () => openPlace(p)).addTo(layer);
  };

  const load = async () => {
    exploreState.view = { center: map.getCenter(), zoom: map.getZoom() };
    const my = ++seq;
    if (map.getZoom() < 9) {
      exploreState.gems = []; areaTrend = null;
      exploreState.places = state.all.map((d) => ({ id: `dest:${d.id}`, destId: d.id, title: d.name, description: d.country, lat: d.lat, lng: d.lng, category: 'dest', thumb: photoSrc(d.id, 320), emoji: d.emoji }));
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
      const box = panel.querySelector('#area-trend'); if (box) box.innerHTML = trendHtml(t);
    }).catch(() => {});
    await Promise.allSettled([wiki, gemsP]);
    if (my === seq) panel.classList.remove('loading');
  };
  map.on('moveend', () => { clearTimeout(timer); timer = setTimeout(load, 350); });

  async function openPlace(p) {
    if (!p) return;
    if (p.destId) flyPad(p.lat, p.lng, 11);
    panel.dataset.mode = 'detail';
    panel.innerHTML = `<div class="panel-handle"></div><div class="place-detail"><div class="place-hero skeleton"></div><div class="skeleton" style="height:80px;margin-top:12px"></div></div>`;
    let info = { title: p.title, description: p.description, extract: '', image: p.image || p.thumb, url: null };
    if (p.gem) {
      info = { ...info, extract: 'Méně známé místo z OpenStreetMap – nemá ani článek na Wikipedii, takže tu nebývají davy.', osm: p.osm, photoPage: p.photoPage };
    } else if (!p.destId) {
      const [lang] = p.id.split(':');
      info = await api(`/explore/place?${new URLSearchParams({ lang, title: p.title })}`).catch(() => info) || info;
    } else {
      const d = state.all.find((x) => x.id === p.destId);
      info = { title: d.name, description: d.country, extract: d.description, image: photoSrc(d.id, 960) };
    }
    const c = EXPLORE_CATS[p.category] || EXPLORE_CATS.other;
    const geo = p.destId || `geo:${p.lat.toFixed(4)},${p.lng.toFixed(4)},,${p.title}`;
    panel.innerHTML = `<div class="panel-handle"></div>
      <div class="place-detail">
        <div class="place-hero" style="${cover('europe')}">${info.image ? `<img src="${esc(info.image)}" alt="${esc(info.title)}" referrerpolicy="no-referrer" onload="this.classList.add('loaded')" onerror="this.remove()">` : ''}<div class="fallback">${p.emoji || c[0]}</div>
          <button class="btn glass sm icon-only back-btn" id="ex-back" aria-label="Zpět na seznam">${icon('back', 'sm')}</button>
          <span class="pill glass cat-pill" style="color:${c[2]}">${c[0]} ${c[1]}</span></div>
        <h2>${esc(info.title)}</h2>
        ${info.description ? `<p class="small muted">${esc(info.description)}</p>` : ''}
        ${info.extract ? `<p class="extract">${esc(info.extract)}</p>` : ''}
        <div class="place-actions">
          <button class="btn" id="ex-nav">🧭 Navigovat sem</button>
          <a class="btn glass" href="${dHref(geo)}">✈️ Naplánovat cestu</a>
          ${info.url ? `<a class="btn ghost sm" href="${esc(info.url)}" target="_blank" rel="noopener">Wikipedie ${icon('ext', 'sm')}</a>` : ''}
          ${info.osm ? `<a class="btn ghost sm" href="${esc(info.osm)}" target="_blank" rel="noopener">OpenStreetMap ${icon('ext', 'sm')}</a>` : ''}
          ${info.photoPage ? `<a class="btn ghost sm" href="${esc(info.photoPage)}" target="_blank" rel="noopener">Autor fotky ${icon('ext', 'sm')}</a>` : ''}
        </div>
        <div id="ex-route"></div>
        <div id="ex-trend"></div>
      </div>`;
    document.getElementById('ex-back').onclick = () => { panel.dataset.mode = 'list'; routeLayer.clearLayers(); renderList(); };
    const tbox = document.getElementById('ex-trend');
    {
      cachedApi(`/explore/trending?${new URLSearchParams({ q: info.title })}`).then((t) => { if (tbox.isConnected) tbox.innerHTML = trendHtml(t, 'Co o tom píšou lidé'); }).catch(() => {});
    }
    document.getElementById('ex-nav').onclick = () => navigateForm(document.getElementById('ex-route'), { lat: p.lat, lng: p.lng, name: info.title }, routeLayer, map);
  }

  document.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
    exploreState.cat = b.dataset.cat;
    document.querySelectorAll('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    renderPins(); panel.dataset.mode = 'list'; renderList();
  }));
  autocomplete(document.getElementById('ex-q'), { onSelect: (r) => flyPad(r.lat, r.lng, r.kind === 'address' ? 15 : 12) });
  document.getElementById('ex-locate').onclick = () => myPosition().then((p) => flyPad(p.lat, p.lng, 13)).catch((e) => toast(e.message));
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
    <div class="segmented mode-toggle" role="group"><button data-mode="foot" aria-pressed="true">🥾 Pěšky</button><button data-mode="car" aria-pressed="false">🚗 Autem</button></div>
    <button class="btn glass sm" id="nav-me">📍 Moje poloha</button>
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
        L.marker([from.lat, from.lng], { icon: L.divIcon({ className: 'map-pin', html: '<span class="pin" style="--c:#007aff">A</span>', iconSize: [32, 32], iconAnchor: [16, 16] }) }).addTo(routeLayer);
        L.marker([to.lat, to.lng], { icon: L.divIcon({ className: 'map-pin', html: '<span class="pin" style="--c:#ff5a5f">B</span>', iconSize: [32, 32], iconAnchor: [16, 16] }) }).addTo(routeLayer);
        map.fitBounds(line.getBounds(), map._tfPad?.() || { padding: [60, 60] });
      }
    } catch (e) { out.innerHTML = `<p class="small muted" style="margin-top:10px">${esc(e.message)}</p>`; }
  };
  const useMe = () => myPosition().then((p) => { from = p; box.querySelector('#nav-from').value = 'Moje poloha'; run(); }).catch((e) => toast(e.message));
  autocomplete(box.querySelector('#nav-from'), {
    suggestions: () => [{ id: 'me', kind: 'me', name: 'Moje poloha', detail: 'Použít polohu telefonu', emoji: '📍' }],
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
      <span class="big">${r.mode === 'foot' ? '🥾' : '🚗'}</span>
      <div><b>${fmtMin(r.durationMin) || 'pár minut'}</b><span>${String(r.distanceKm).replace('.', ',')} km${r.approx ? ' · odhad vzdušnou čarou' : ''}</span></div>
      <a class="btn sm" href="${gmaps}" target="_blank" rel="noopener">Spustit navigaci ${icon('ext', 'sm')}</a>
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
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Zrušit</button><button class="btn">${icon('plus', 'sm')} Vytvořit a uložit</button></div>
    </form>`, (m, close) => {
    const add = async (tripId) => {
      await api(`/trips/${tripId}/items`, { method: 'POST', body: { kind, data } });
      close();
      onSaved?.();
      toast('Uloženo do výletu ✓');
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
  $app.innerHTML = `
    <div class="section-head" style="margin-top:0">
      <div><span class="eyebrow">Můj plánovač</span><h1 style="font-size:34px;line-height:40px">Moje výlety</h1></div>
      <button class="btn" id="new">${icon('plus')} Nový výlet</button>
    </div>
    ${trips.length ? [trips.filter((t) => t.status !== 'done'), trips.filter((t) => t.status === 'done')].map((group, gi) => (group.length ? `${gi ? `<div class="section-head"><div><span class="eyebrow">Archiv</span><h2>Dokončené výlety</h2></div></div>` : ''}<div class="grid">${group.map((t) => `
      <a class="card trip-card${t.status === 'done' ? ' done' : ''}" href="#/trips/${t.id}">
        <div class="media" style="${cover('europe')}">${t.cover ? photo(t.cover, '🧳') : '<div class="fallback">🧳</div>'}
          <div class="badges"><span class="pill glass">${{ owner: 'Můj výlet', editor: 'Spolucestující', viewer: 'Jen čtení' }[t.role]}</span>${t.status === 'done' ? '<span class="pill mint">🏆 Dokončeno</span>' : countdown(t.start_date)}</div></div>
        <div class="body">
          <h3>${esc(t.title)}</h3>
          <div class="small muted">${icon('calendar', 'sm')} ${fmtRange(t.start_date, t.end_date)} · ${plural(t.persons, 'osoba', 'osoby', 'osob')}</div>
          <div class="row"><span class="small faint">${plural(t.item_count, 'položka', 'položky', 'položek')} · 👥 ${t.member_count + 1}</span><span class="price" style="font-size:18px">${czk(t.total)}</span></div>
        </div>
      </a>`).join('')}</div>` : '')).join('')
      : emptyState('🧳', 'Zatím nemáš žádný výlet. Najdi destinaci a ulož si dopravu nebo ubytování.', '<a class="btn" href="#/">Začít objevovat</a>')}`;
  document.getElementById('new').onclick = () => modal(`<h2>Nový výlet</h2><form id="f" style="margin-top:16px">${tripForm()}
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Zrušit</button><button class="btn">Vytvořit</button></div></form>`, (m, close) => {
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

function countdown(start) {
  if (!start) return '';
  const days = Math.ceil((new Date(start) - new Date(new Date().toDateString())) / 86400000);
  if (days < 0) return '';
  return `<span class="pill coral">${days === 0 ? 'Odjezd dnes!' : `Zbývá ${plural(days, 'den', 'dny', 'dní')}`}</span>`;
}

function costBreakdown(items, total) {
  const sum = (k) => items.filter((i) => i.kind === k).reduce((a, i) => a + (i.price || 0), 0);
  const parts = [['Ubytování', sum('lodging'), 'var(--sky)'], ['Doprava', sum('transport'), 'var(--coral)'], ['Ostatní', sum('note'), 'var(--gold)']];
  return `<div class="card pad">
    <div class="row" style="display:flex;justify-content:space-between;align-items:center"><h3>Rozpad nákladů</h3><b class="num">${czk(total)}</b></div>
    <div class="bar" style="margin-top:14px">${total ? parts.map(([, v, c]) => `<span style="width:${(v / total) * 100}%;background:${c}"></span>`).join('') : ''}</div>
    <div class="legend">${parts.map(([l, v, c]) => `<div><i style="background:${c}"></i>${l}${total ? ` (${Math.round((v / total) * 100)} %)` : ''}<b>${czk(v)}</b></div>`).join('')}</div>
  </div>`;
}

function timeline(items, canEdit) {
  if (!items.length) return emptyState('🗺️', 'Výlet je zatím prázdný. Najdi destinaci a přidej dopravu nebo ubytování.', '<a class="btn" href="#/">Najít destinaci</a>');
  return `<div class="timeline">${items.map((it) => {
    const d = it.data;
    const k = KIND[it.kind];
    const ico = it.kind === 'transport' ? MODE_ICON[d.mode] || '✈️' : d.emoji || k.icon;
    const title = it.kind === 'destination' && d.destinationId ? `<a href="${dHref(d.destinationId)}">${esc(d.title)}</a>` : esc(d.title || d.text);
    return `<div class="tl-item">
      <span class="dot" style="background:${k.bg}">${ico}</span>
      <div class="card tl-card">
        <div class="grow">
          <div class="tags"><span class="pill">${k.label}</span>${d.providerName ? `<span class="pill sky">${esc(d.providerName)}</span>` : ''}${d.mock ? '<span class="pill">UKÁZKA</span>' : ''}</div>
          <h4 style="margin-top:6px">${title}</h4>
          <div class="small muted" style="margin-top:2px">${esc(d.subtitle || '')}${d.from ? ` · ${fmtRange(d.from, d.to)}` : ''}${d.persons ? ` · ${plural(d.persons, 'osoba', 'osoby', 'osob')}` : ''}</div>
          ${d.deepLink ? `<a class="small" href="${esc(d.deepLink)}" target="_blank" rel="noopener" style="display:inline-flex;gap:4px;margin-top:6px;font-weight:600">Otevřít u poskytovatele ${icon('ext', 'sm')}</a>` : ''}
        </div>
        <div style="text-align:right;display:grid;gap:6px;justify-items:end">
          ${it.price != null ? `<div class="price">${czk(it.price)}</div>` : ''}
          ${canEdit ? `<button class="btn ghost sm icon-only" data-del="${it.id}" aria-label="Odebrat">${icon('x', 'sm')}</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function budgetBlock(total, budget, persons) {
  if (budget) {
    const pct = Math.min(100, Math.round((total / budget) * 100));
    const c = 2 * Math.PI * 27;
    return `<div class="budget">
      <svg class="ring" viewBox="0 0 64 64"><circle class="track" cx="32" cy="32" r="27"/><circle class="val" cx="32" cy="32" r="27" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}" ${total > budget ? 'style="stroke:#d70015"' : ''}/><text x="32" y="37" text-anchor="middle">${pct}%</text></svg>
      <div><span class="eyebrow faint">Rozpočet výletu</span><div class="price" style="font-size:22px">${czk(total)} <small>/ ${czk(budget)}</small></div>
      <div class="small" style="color:${total > budget ? '#d70015' : '#1d8a3a'};font-weight:600">${total > budget ? `Přes rozpočet o ${czk(total - budget)}` : `Zbývá čerpat ${czk(budget - total)}`}</div></div>
    </div>`;
  }
  return `<div class="budget"><div><span class="eyebrow faint">Celkem za výlet</span><div class="price" style="font-size:26px">${czk(total)}</div>
    <div class="small muted">${persons > 1 ? `${czk(total / persons)} na osobu` : 'Nastav si rozpočet v úpravách'}</div></div></div>`;
}

async function viewTrip(id) {
  if (!requireLogin()) return;
  renderTrip(await api(`/trips/${id}`));
}

function renderTrip({ trip, role, owner, items, members, total }) {
  const canEdit = role !== 'viewer';
  const isOwner = role === 'owner';
  const shareUrl = trip.share_token ? `${location.origin}/#/shared/${trip.share_token}` : '';
  const people = [owner, ...members.map((m) => ({ name: m.name || m.email }))];
  const mapData = tripMapData(items);
  $app.innerHTML = `
    <a href="#/trips" class="back">${icon('back', 'sm')} Moje výlety</a>
    <section class="glass-card trip-head">
      <div>
        <div class="badges">${trip.status === 'done' ? '<span class="pill mint">🏆 Dokončený výlet</span>' : countdown(trip.start_date)}<span class="pill">${icon('calendar', 'sm')} ${fmtRange(trip.start_date, trip.end_date)}</span><span class="pill sky">${icon('users', 'sm')} ${plural(trip.persons, 'osoba', 'osoby', 'osob')}</span></div>
        <h1>${esc(trip.title)}</h1>
        <div class="who"><span class="stack">${people.slice(0, 5).map((p, i) => `<span class="avatar ${AVATAR_TONES[i % 4]}">${esc(initials(p.name))}</span>`).join('')}</span>
          ${plural(people.length, 'cestovatel', 'cestovatelé', 'cestovatelů')}: <b>${people.slice(0, 3).map((p) => esc(p.name.split(/[ @]/)[0])).join(', ')}</b>${people.length > 3 ? ' a další' : ''}</div>
        ${trip.note ? `<p class="muted" style="margin-top:10px">${esc(trip.note)}</p>` : ''}
        <div class="actions">
          ${canEdit ? `<a class="btn" href="#/">${icon('plus')} Přidat do plánu</a>` : ''}
          ${isOwner ? `<button class="btn glass" id="invite-btn">${icon('users')} Pozvat přátele</button>` : ''}
          ${canEdit ? `<button class="btn glass" id="edit">${icon('edit')} Upravit</button>` : ''}
          ${isOwner ? `<button class="btn glass" id="share-btn">${icon('link')} Sdílet</button>` : ''}
          ${isOwner ? (trip.status === 'done' ? '<button class="btn ghost" id="reopen">Vrátit mezi plánované</button>' : '<button class="btn glass done-btn" id="complete">🏆 Dokončit výlet</button>') : ''}
        </div>
      </div>
      ${budgetBlock(total, trip.budget, trip.persons)}
    </section>

    <div class="detail-grid" style="margin-top:24px">
      <div>
        ${mapData.points.length || mapData.segments.length ? '<div class="card map-card trip-map"><div class="map" id="trip-map"></div></div>' : ''}
        <div class="section-title"><h2 style="font-size:22px">Plán cesty</h2><span class="count">${plural(items.length, 'položka', 'položky', 'položek')}</span></div>
        ${timeline(items, canEdit)}
        ${canEdit ? `<form class="add-note" id="note"><input name="text" placeholder="Přidat poznámku nebo výdaj (vízum, pojištění…)"><input name="price" type="number" min="0" placeholder="Kč"><button class="btn sky">${icon('plus', 'sm')}</button></form>` : ''}
      </div>
      <aside class="side sticky">
        ${costBreakdown(items, total)}
        <div class="card pad" id="members">
          <h3>Spolucestující</h3>
          <div style="margin-top:8px">
            <div class="member"><span class="avatar">${esc(initials(owner.name))}</span><span class="grow">${esc(owner.name)}<span class="small">organizátor</span></span></div>
            ${members.map((m, i) => `<div class="member">
              <span class="avatar ${AVATAR_TONES[(i + 1) % 4]}">${esc(initials(m.name || m.email))}</span>
              <span class="grow">${esc(m.name || m.email)}<span class="small">${m.user_id ? (m.role === 'editor' ? 'může upravovat' : 'jen čte') : 'čeká na registraci'}</span></span>
              ${isOwner || m.user_id === state.user.id ? `<button class="btn ghost sm icon-only" data-rm="${m.id}" aria-label="Odebrat">${icon('x', 'sm')}</button>` : ''}
            </div>`).join('')}
          </div>
          ${isOwner ? `<form class="inline-form" id="invite">
            <input name="email" type="email" placeholder="e-mail kamaráda" required>
            <select name="role"><option value="editor">upravuje</option><option value="viewer">jen čte</option></select>
            <button class="btn sky sm">Pozvat</button></form>
            <p class="small faint" style="margin-top:8px">Když ještě nemá účet, uvidí výlet hned po registraci s tímto e-mailem.</p>` : ''}
        </div>
        ${isOwner ? `<div class="card pad" id="share-card">
          <h3>Sdílení odkazem</h3>
          <p class="small muted" style="margin-top:4px">Kdokoli s odkazem uvidí výlet, ale nemůže ho upravovat.</p>
          ${shareUrl ? `<div class="share-box"><input readonly value="${esc(shareUrl)}" id="shareurl"><button class="btn sky sm" id="copy">Kopírovat</button></div>
            <button class="btn ghost sm" id="unshare" style="margin-top:6px">Zrušit sdílení</button>`
            : `<button class="btn glass" id="share" style="margin-top:12px;width:100%">${icon('link')} Vytvořit odkaz</button>`}
        </div>
        <button class="btn danger sm" id="delete">Smazat výlet</button>` : ''}
      </aside>
    </div>`;

  const run = (p) => p.then(renderTrip).catch((e) => toast(e.message));
  if (document.getElementById('trip-map')) drawMap(document.getElementById('trip-map'), mapData);
  document.getElementById('complete')?.addEventListener('click', () => {
    const countries = [...new Set(items.filter((i) => i.kind === 'destination').map((i) => i.data.subtitle?.split('·')[0].trim()).filter(Boolean))];
    modal(`<div style="text-align:center"><div style="font-size:56px">🏆</div><h2>Výlet se povedl?</h2>
      <p class="muted" style="margin-top:6px">Označíme ho jako dokončený${countries.length ? ` a do tvého cestovatelského pasu přibude razítko: <b>${esc(countries.join(', '))}</b>` : ''}.</p></div>
      <div class="modal-actions" style="justify-content:center"><button class="btn ghost" data-close>Ještě ne</button><button class="btn" id="yes">Ano, dokončit 🎉</button></div>`, (m, close) => {
      m.querySelector('#yes').onclick = async () => {
        close();
        await run(api(`/trips/${trip.id}/status`, { method: 'POST', body: { status: 'done' } }));
        toast('Gratulujeme! Razítka najdeš ve svém profilu 🛂');
        celebrate();
      };
    });
  });
  document.getElementById('reopen')?.addEventListener('click', () => run(api(`/trips/${trip.id}/status`, { method: 'POST', body: { status: 'planned' } })));
  $app.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => run(api(`/trips/${trip.id}/items/${b.dataset.del}`, { method: 'DELETE' })); });
  $app.querySelectorAll('[data-rm]').forEach((b) => {
    b.onclick = async () => {
      const res = await api(`/trips/${trip.id}/members/${b.dataset.rm}`, { method: 'DELETE' }).catch((e) => toast(e.message));
      if (res?.left) { toast('Opustil(a) jsi výlet.'); location.hash = '#/trips'; } else if (res) renderTrip(res);
    };
  });
  document.getElementById('note')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = e.target.text.value.trim();
    if (!text) return;
    run(api(`/trips/${trip.id}/items`, { method: 'POST', body: { kind: 'note', data: { title: text, price: e.target.price.value || undefined } } }));
  });
  document.getElementById('invite')?.addEventListener('submit', (e) => {
    e.preventDefault();
    run(api(`/trips/${trip.id}/members`, { method: 'POST', body: { email: e.target.email.value, role: e.target.role.value } }).then((r) => { toast('Spolucestující přidán ✓'); return r; }));
  });
  document.getElementById('invite-btn')?.addEventListener('click', () => { document.getElementById('members').scrollIntoView({ behavior: 'smooth' }); document.querySelector('#invite input')?.focus(); });
  const share = (enabled) => api(`/trips/${trip.id}/share`, { method: 'POST', body: { enabled } }).then(() => api(`/trips/${trip.id}`));
  document.getElementById('share')?.addEventListener('click', () => run(share(true)));
  document.getElementById('unshare')?.addEventListener('click', () => run(share(false)));
  document.getElementById('copy')?.addEventListener('click', () => shareLink(trip.title, document.getElementById('shareurl').value));
  document.getElementById('share-btn')?.addEventListener('click', async () => {
    if (shareUrl) return shareLink(trip.title, shareUrl);
    const detail = await share(true);
    renderTrip(detail);
    shareLink(trip.title, `${location.origin}/#/shared/${detail.trip.share_token}`);
  });
  document.getElementById('delete')?.addEventListener('click', async () => {
    if (!confirm(`Opravdu smazat výlet „${trip.title}“?`)) return;
    await api(`/trips/${trip.id}`, { method: 'DELETE' });
    toast('Výlet smazán.');
    location.hash = '#/trips';
  });
  document.getElementById('edit')?.addEventListener('click', () => modal(`<h2>Upravit výlet</h2>
    <form id="f" style="margin-top:16px">${tripForm(trip)}
      <div><label for="n">Poznámka</label><textarea id="n" name="note">${esc(trip.note)}</textarea></div>
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Zrušit</button><button class="btn">Uložit</button></div>
    </form>`, (m, close) => m.querySelector('#f').addEventListener('submit', (e) => {
    e.preventDefault();
    close();
    run(api(`/trips/${trip.id}`, { method: 'PATCH', body: Object.fromEntries(new FormData(e.target)) }));
  })));
}

async function viewShared(token) {
  const { trip, owner, items, members, total } = await api(`/shared/${token}`);
  $app.innerHTML = `
    <div class="notice sky">👀 <span>Díváš se na sdílený výlet od <b>${esc(owner.name)}</b>. ${state.user ? '' : '<a href="#/register">Založ si účet</a> a plánuj vlastní.'}</span></div>
    <section class="glass-card trip-head">
      <div>
        <div class="badges">${countdown(trip.start_date)}<span class="pill">${icon('calendar', 'sm')} ${fmtRange(trip.start_date, trip.end_date)}</span><span class="pill sky">${icon('users', 'sm')} ${plural(members.length + 1, 'cestovatel', 'cestovatelé', 'cestovatelů')}</span></div>
        <h1>${esc(trip.title)}</h1>
        ${trip.note ? `<p class="muted" style="margin-top:10px">${esc(trip.note)}</p>` : ''}
      </div>
      ${budgetBlock(total, trip.budget, trip.persons)}
    </section>
    <div class="detail-grid" style="margin-top:24px"><div><div class="card map-card trip-map"><div class="map" id="trip-map"></div></div>${timeline(items, false)}</div><aside class="side">${costBreakdown(items, total)}</aside></div>`;
  drawMap(document.getElementById('trip-map'), tripMapData(items));
}

function celebrate() {
  const box = document.createElement('div');
  box.className = 'confetti';
  box.innerHTML = Array.from({ length: 40 }, (_, i) => `<i style="--x:${(i * 37) % 100}vw;--d:${(i % 7) * 0.12}s;--c:${['#ff5a5f', '#007aff', '#ff9f0a', '#34c759', '#af52de'][i % 5]}"></i>`).join('');
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
    $app.innerHTML = emptyState('📡', 'Nepodařilo se spojit se serverem. Jsi online?', '<button class="btn" onclick="location.reload()">Zkusit znovu</button>');
    return;
  }
  renderAccount();
  refreshBadge();
  window.addEventListener('hashchange', route);
  route();
}
setupSocial({ api, esc, toast, state, $app, initials, requireLogin, emptyState, route, modal, renderAccount, shareLink });
init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
