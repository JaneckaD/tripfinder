// TripFinder – frontend (vanilla JS, bez build kroku). Jednoduchý hash router.
const $app = document.getElementById('app');
const state = { user: undefined, meta: null, all: [], search: loadSearch() };

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
const photo = (destId, emoji = '🌍', alt = '') => `<img src="/api/destinations/${esc(destId)}/photo" alt="${esc(alt)}" loading="lazy" onload="this.classList.add('loaded')" onerror="this.remove()"><div class="fallback">${emoji}</div>`;

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
const MODE_ICON = { flight: '✈️', bus: '🚌', train: '🚆' };
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
  const base = { continent: 'world', q: '', tags: [], maxBudget: '', month: '', sort: 'recommended', persons: 2, origin: 'PRG', ...defaultDates() };
  try {
    const s = { ...base, ...JSON.parse(localStorage.getItem('tf_search') || '{}') };
    if (!s.from || new Date(s.from) < new Date(new Date().toDateString())) Object.assign(s, defaultDates());
    return s;
  } catch { return base; }
}
function saveSearch() { try { localStorage.setItem('tf_search', JSON.stringify(state.search)); } catch { /* ignore */ } }
const nights = () => Math.max(1, Math.round((new Date(state.search.to) - new Date(state.search.from)) / 86400000) || 7);
const ORIGINS = [['PRG', 'Praha'], ['BRQ', 'Brno'], ['OSR', 'Ostrava'], ['PED', 'Pardubice'], ['VIE', 'Vídeň'], ['BTS', 'Bratislava'], ['KTW', 'Katovice'], ['MUC', 'Mnichov'], ['BER', 'Berlín']];
const originName = (code) => ORIGINS.find(([c]) => c === code)?.[1] || code;

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

function modal(html, onMount) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  root.querySelector('.modal-backdrop').addEventListener('click', (e) => e.target === e.currentTarget && close());
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  onMount?.(root.querySelector('.modal'), close);
  root.querySelector('input, button')?.focus();
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
    el.innerHTML = `<span class="user-name">${esc(state.user.name)}</span>
      <a class="avatar" href="#/account" title="${esc(state.user.email)}">${esc(initials(state.user.name))}</a>`;
    bottom.href = '#/account';
  } else {
    el.innerHTML = `<a class="btn glass sm" href="#/login">Přihlásit</a><a class="btn sm" href="#/register">Registrace</a>`;
    bottom.href = '#/login';
  }
}
async function logout() {
  await api('/auth/logout', { method: 'POST' }).catch(() => {});
  state.user = null;
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
  [/^#\/d\/([\w-]+)$/, viewDestination, 'search'],
  [/^#\/trips$/, viewTrips, 'trips'],
  [/^#\/trips\/(\d+)$/, viewTrip, 'trips'],
  [/^#\/login$/, () => viewAuth('login'), 'account'],
  [/^#\/register$/, () => viewAuth('register'), 'account'],
  [/^#\/account$/, viewAccount, 'account'],
  [/^#\/shared\/([\w-]+)$/, viewShared, 'trips'],
];
async function route() {
  const hash = location.hash || '#/';
  for (const [re, view, nav] of routes) {
    const m = hash.match(re);
    if (!m) continue;
    setActiveNav(nav);
    document.getElementById('modal-root').innerHTML = '';
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
      ${state.user ? `<span class="pill sky hello">AHOJ ${esc(state.user.name.split(' ')[0].toUpperCase())}, VÍTEJ ZPĚT</span>` : `<span class="pill coral hello">✨ ${state.all.length} DESTINACÍ PO CELÉM SVĚTĚ</span>`}
      <h1>Kam tě srdce táhne <span class="accent">tentokrát?</span></h1>
      <p class="lead">Objev pláže, hory i města po celém světě. Ke každému místu ti ukážeme letenky, ubytování a ceny na jednom místě.</p>
      <form class="dock" id="searchform">
        <div class="dock-fields">
          <div class="dock-field wide"><label for="q">Kam</label><input id="q" name="q" placeholder="Itálie, pláž, safari…" value="${esc(s.q)}"></div>
          <div class="dock-field"><label for="origin">Odkud</label><select id="origin" name="origin">${ORIGINS.map(([v, l]) => `<option value="${v}" ${s.origin === v ? 'selected' : ''}>${l} (${v})</option>`).join('')}</select></div>
          <div class="dock-field"><label for="from">Odjezd</label><input id="from" name="from" type="date" value="${esc(s.from)}"></div>
          <div class="dock-field"><label for="to">Návrat</label><input id="to" name="to" type="date" value="${esc(s.to)}"></div>
          <div class="dock-field"><label for="persons">Hosté</label><input id="persons" name="persons" type="number" min="1" max="20" value="${esc(s.persons)}"></div>
          <button class="btn" type="submit">${icon('search')} Vyhledat</button>
        </div>
      </form>
      <div class="quick"><span class="eyebrow">Rychlá volba:</span>${QUICK.map((q, i) => `<button class="chip" data-quick="${i}">${q.label}</button>`).join('')}</div>
    </section>

    <div class="section-head"><div><span class="eyebrow">Kategorie</span><h2>Prozkoumej podle stylu cesty</h2></div></div>
    <div class="cats">${Object.entries(tags).map(([id, name]) => `
      <button class="cat" data-tag="${id}" aria-pressed="${s.tags.includes(id)}">
        <span class="ico" style="background:${CATS[id]?.[1]}">${CATS[id]?.[0] || '✨'}</span>
        <b>${esc(name)}</b><span class="small">${plural(count(id), 'destinace', 'destinace', 'destinací')}</span>
      </button>`).join('')}</div>

    <div class="section-head">
      <div><span class="eyebrow coral">Výběr pro tebe</span><h2 id="count">Destinace</h2></div>
      <span class="small muted" id="estimate-note">Odhad za ${plural(Number(s.persons), 'osobu', 'osoby', 'osob')} · ${plural(nights(), 'noc', 'noci', 'nocí')} z ${esc(originName(s.origin))}</span>
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

  const form = document.getElementById('searchform');
  const update = (patch, rerender = false) => {
    Object.assign(state.search, patch);
    saveSearch();
    if (rerender) viewSearch(); else { syncFilters(); viewSearchResults(); }
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    if (fd.get('from') && fd.get('to') && fd.get('to') <= fd.get('from')) return toast('Návrat musí být po odjezdu.');
    update({ q: fd.get('q'), origin: fd.get('origin'), from: fd.get('from'), to: fd.get('to'), persons: Math.max(1, Number(fd.get('persons')) || 1) });
    document.getElementById('count').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
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
  viewSearchResults();
}

function syncFilters() {
  const s = state.search;
  $app.querySelectorAll('[data-continent]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.continent === s.continent));
  $app.querySelectorAll('[data-tag]').forEach((x) => x.setAttribute('aria-pressed', s.tags.includes(x.dataset.tag)));
  const note = document.getElementById('estimate-note');
  if (note) note.textContent = `Odhad za ${plural(Number(s.persons), 'osobu', 'osoby', 'osob')} · ${plural(nights(), 'noc', 'noci', 'nocí')} z ${originName(s.origin)}`;
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
    <a class="card dest-card" href="#/d/${d.id}">
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
const destItem = (d) => ({ destinationId: d.id, title: d.name, subtitle: `${d.country} · ${state.meta.continents[d.continent]}`, emoji: d.emoji });

// ---------- Detail destinace ----------
async function viewDestination(id) {
  const { destination: d, continentName, tagNames } = await api(`/destinations/${id}`);
  const s = state.search;
  $app.innerHTML = `
    <a href="#/" class="back">${icon('back', 'sm')} Zpět na objevování</a>
    <section class="photo-hero">
      <div class="media" style="${cover(d.continent)}">${photo(d.id, d.emoji, d.name)}</div>
      <span class="credit">Foto: Wikimedia Commons</span>
      <div class="content">
        <div class="tags"><span class="pill glass">${icon('pin', 'sm')} ${esc(d.country.toUpperCase())} · ${esc(continentName.toUpperCase())}</span>${tagNames.slice(0, 2).map((t) => `<span class="pill glass">${esc(t)}</span>`).join('')}</div>
        <h1 style="margin-top:12px">${esc(d.name)}</h1>
        <p>${esc(d.description)}</p>
        <div class="actions">
          <button class="btn glass" id="save-dest">${icon('heart')} Uložit destinaci</button>
          <button class="btn glass" id="share-dest">${icon('share')} Sdílet</button>
          <button class="btn" id="go-offers">${icon('search')} Najít letenky a ubytování</button>
        </div>
      </div>
    </section>
    <div class="glass-card facts">
      <div class="fact"><span class="ico" style="background:var(--gold-soft)">☀️</span><div><span class="label">Počasí</span><b id="f-weather">…</b></div></div>
      <div class="fact"><span class="ico" style="background:var(--sky-soft)">✈️</span><div><span class="label">Doba letu</span><b>~${flightHours(d.distanceKm)} z Prahy</b></div></div>
      <div class="fact"><span class="ico" style="background:var(--mint-soft)">💶</span><div><span class="label">Měna</span><b>${esc(d.currency)}</b></div></div>
      <div class="fact"><span class="ico" style="background:var(--lavender-soft)">🕒</span><div><span class="label">Časový posun</span><b id="f-tz">…</b></div></div>
      <div class="fact"><span class="ico" style="background:var(--coral-soft)">🍽️</span><div><span class="label">Denní útrata</span><b>~${czk(d.dailyCost)} / os.</b></div></div>
    </div>

    <div class="glass-card route-bar" id="route-bar"></div>
    <form class="card param-form" id="offerform" hidden>
      <div><label for="o-origin">Odkud</label><select id="o-origin" name="origin">${ORIGINS.map(([v, l]) => `<option value="${v}" ${s.origin === v ? 'selected' : ''}>${l} (${v})</option>`).join('')}</select></div>
      <div><label for="o-from">Odjezd</label><input id="o-from" name="from" type="date" value="${esc(s.from)}"></div>
      <div><label for="o-to">Návrat</label><input id="o-to" name="to" type="date" value="${esc(s.to)}"></div>
      <div><label for="o-persons">Osob</label><input id="o-persons" name="persons" type="number" min="1" max="20" value="${esc(s.persons)}"></div>
      <button class="btn sky" type="submit">Aktualizovat ceny</button>
    </form>

    <div class="detail-grid">
      <div id="offers"><div class="offers">${'<div class="skeleton"></div>'.repeat(4)}</div></div>
      <aside class="side sticky">
        <div class="card summary" id="summary"><div class="skeleton" style="height:140px"></div></div>
        <div class="card pad" id="weather-card"><h3>☀️ Předpověď počasí</h3><div class="weather">${'<div class="skeleton" style="height:96px;border-radius:14px"></div>'.repeat(5)}</div></div>
        <div class="card pad"><h3>🗓️ Nejlepší sezóna</h3><div class="months">${MONTHS.map((m, i) => `<span class="${d.bestMonths.includes(i + 1) ? 'on' : ''}" title="${MONTHS_FULL[i]}">${m}</span>`).join('')}</div>
          <p class="small muted" style="margin-top:10px">Ideálně: ${d.bestMonths.map((m) => MONTHS_FULL[m - 1]).join(', ')}.</p></div>
      </aside>
    </div>`;

  const renderRoute = () => {
    document.getElementById('route-bar').innerHTML = `
      <span class="route">${icon('plane')} ${esc(originName(s.origin))} (${esc(s.origin)}) → ${esc(d.name)} (${esc(d.airport)})</span>
      <span class="meta">${fmtRange(s.from, s.to)} · ${plural(Number(s.persons), 'osoba', 'osoby', 'osob')}</span>
      <button class="btn glass sm" id="edit-params">${icon('edit', 'sm')} Upravit</button>`;
    document.getElementById('edit-params').onclick = () => { const f = document.getElementById('offerform'); f.hidden = !f.hidden; };
  };
  renderRoute();
  document.getElementById('save-dest').onclick = () => saveToTrip('destination', { ...destItem(d), subtitle: `${d.country} · ${continentName}` });
  document.getElementById('share-dest').onclick = () => shareLink(d.name, location.href);
  document.getElementById('go-offers').onclick = () => document.getElementById('route-bar').scrollIntoView({ behavior: 'smooth' });
  document.getElementById('offerform').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (fd.get('to') <= fd.get('from')) return toast('Návrat musí být po odjezdu.');
    Object.assign(state.search, { from: fd.get('from'), to: fd.get('to'), persons: Math.max(1, Number(fd.get('persons')) || 1), origin: fd.get('origin') });
    saveSearch();
    e.target.hidden = true;
    renderRoute();
    loadOffers(d);
  });
  loadWeather(d);
  loadOffers(d);
}

async function loadWeather(d) {
  const card = document.getElementById('weather-card');
  try {
    const w = await api(`/destinations/${d.id}/weather`);
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
  const data = await api(`/destinations/${d.id}/offers?${new URLSearchParams({ from: s.from, to: s.to, persons: s.persons, origin: s.origin })}`);
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
      <div class="section-title"><span class="ico" style="background:var(--sky-soft);color:var(--sky)">${icon('plane', 'sm')}</span><h2 style="font-size:20px">Doporučená doprava</h2><span class="count">${plural(transport.length, 'nabídka', 'nabídky', 'nabídek')}</span></div>
      <div class="offers">${transport.map((o, i) => transportCard(o, i, ctx, d)).join('') || '<p class="muted">Pro tuto destinaci tu zatím nic nemáme.</p>'}</div>
      ${compareLinks(links.transport)}
    </section>
    <section data-kind="lodging">
      <div class="section-title"><span class="ico" style="background:var(--coral-soft);color:var(--coral)">${icon('bed', 'sm')}</span><h2 style="font-size:20px">Ubytování v destinaci ${esc(d.name)}</h2><span class="count">${plural(lodging.length, 'nabídka', 'nabídky', 'nabídek')}</span></div>
      <div class="offers">${lodging.map((o, i) => lodgingCard(o, i, d)).join('') || '<p class="muted">Pro tuto destinaci tu zatím nic nemáme.</p>'}</div>
      ${compareLinks(links.lodging)}
    </section>`;

  el.querySelectorAll('[data-show]').forEach((b) => b.addEventListener('click', () => {
    el.querySelectorAll('[data-show]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    el.querySelectorAll('section[data-kind]').forEach((sec) => { sec.hidden = b.dataset.show !== 'all' && sec.dataset.kind !== b.dataset.show; });
  }));
  const all = [...transport, ...lodging];
  el.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', () => {
    const o = all.find((x) => x.id === b.dataset.save);
    saveToTrip(o.kind, { ...o, destinationId: d.id, destinationName: d.name, from: ctx.from, to: ctx.to, persons: ctx.persons });
  }));
}

const compareLinks = (links) => (links.length
  ? `<div class="compare-links"><span class="small muted">Porovnat i na:</span>${links.map((l) => `<a class="chip" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)} ${icon('ext')}</a>`).join('')}</div>` : '');

function transportCard(o, i, ctx, d) {
  const per = o.price / ctx.persons;
  const direct = /přímý/i.test(o.subtitle);
  const duration = o.details.find((x) => /h|min/.test(x) && x.startsWith('~')) || '';
  const extra = o.details.filter((x) => x !== duration && !x.includes('→'));
  return `<article class="card offer">
    <div class="offer-head">
      ${logo(o.providerName)}
      <div class="grow">
        <h3>${esc(o.title.replace(/^Let \S+ → \S+ · /, '') || o.providerName)}</h3>
        <div class="tagline"><span class="small muted">${esc(o.providerName)}</span>${i === 0 ? '<span class="pill coral">NEJLEVNĚJŠÍ</span>' : ''}${direct ? '<span class="pill mint">PŘÍMÝ</span>' : ''}${o.mock ? '<span class="pill">UKÁZKA</span>' : ''}</div>
      </div>
      <div class="amount"><div class="price">${czk(per)}</div><div class="small">za osobu · celkem ${czk(o.price)}</div></div>
    </div>
    <div class="flightline">
      <div class="code">${esc(ctx.origin)}<small>${fmtDate(ctx.from, { day: 'numeric', month: 'numeric' })}</small></div>
      <div class="mid"><span>${MODE_ICON[o.mode] || '✈️'} ${esc(duration.replace('~', ''))}</span><div class="line"></div><span class="${direct ? 'direct' : ''}">${esc(o.subtitle)}</span></div>
      <div class="code" style="text-align:right">${esc(o.mode === 'flight' ? d.airport : d.name.slice(0, 3).toUpperCase())}<small>zpět ${fmtDate(ctx.to, { day: 'numeric', month: 'numeric' })}</small></div>
    </div>
    <div class="offer-foot">
      <div class="meta">${extra.map((x) => `<span>${esc(x)}</span>`).join('')}</div>
      <div class="actions">
        <button class="btn glass sm" data-save="${esc(o.id)}">${icon('plus', 'sm')} Do výletu</button>
        <a class="btn sky sm" href="${esc(o.deepLink)}" target="_blank" rel="noopener">Vybrat ${icon('ext', 'sm')}</a>
      </div>
    </div>
  </article>`;
}

function lodgingCard(o, i, d) {
  return `<article class="card offer stay">
    <div class="thumb" style="background:linear-gradient(135deg, ${COVERS[d.continent]?.[0] || '#eee'}, ${COVERS[d.continent]?.[1] || '#f6f6f6'})">${/hostel/i.test(o.title) ? '🛏️' : /vila|dům/i.test(o.title) ? '🏡' : /byt|apart|loft/i.test(o.title) ? '🏠' : '🏨'}</div>
    <div style="display:grid;gap:8px;min-width:0">
      <div class="tagline"><span class="small muted">${icon('pin', 'sm')} ${esc(o.subtitle)}</span>${o.rating ? `<span class="rating"><span class="star">★</span>${o.rating}</span>` : ''}</div>
      <h3>${esc(o.title)}</h3>
      <div class="tags"><span class="pill sky">${esc(o.providerName)}</span>${i === 0 ? '<span class="pill coral">NEJLEVNĚJŠÍ</span>' : ''}${o.mock ? '<span class="pill">UKÁZKA</span>' : ''}${o.details.slice(0, 3).map((x) => `<span class="pill">${esc(x)}</span>`).join('')}</div>
      <div class="offer-foot">
        <div><div class="price">${czk(o.price)}</div><div class="small faint">${esc(o.priceNote)}</div></div>
        <div class="actions">
          <button class="btn glass sm" data-save="${esc(o.id)}">${icon('plus', 'sm')} Do výletu</button>
          <a class="btn sm" href="${esc(o.deepLink)}" target="_blank" rel="noopener">Rezervovat ${icon('ext', 'sm')}</a>
        </div>
      </div>
    </div>
  </article>`;
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
    ${trips.length ? `<div class="grid">${trips.map((t) => `
      <a class="card trip-card" href="#/trips/${t.id}">
        <div class="media" style="${cover('europe')}">${t.cover ? photo(t.cover, '🧳') : '<div class="fallback">🧳</div>'}
          <div class="badges"><span class="pill glass">${{ owner: 'Můj výlet', editor: 'Spolucestující', viewer: 'Jen čtení' }[t.role]}</span>${countdown(t.start_date)}</div></div>
        <div class="body">
          <h3>${esc(t.title)}</h3>
          <div class="small muted">${icon('calendar', 'sm')} ${fmtRange(t.start_date, t.end_date)} · ${plural(t.persons, 'osoba', 'osoby', 'osob')}</div>
          <div class="row"><span class="small faint">${plural(t.item_count, 'položka', 'položky', 'položek')} · 👥 ${t.member_count + 1}</span><span class="price" style="font-size:18px">${czk(t.total)}</span></div>
        </div>
      </a>`).join('')}</div>`
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
    const title = it.kind === 'destination' && d.destinationId ? `<a href="#/d/${esc(d.destinationId)}">${esc(d.title)}</a>` : esc(d.title || d.text);
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
  $app.innerHTML = `
    <a href="#/trips" class="back">${icon('back', 'sm')} Moje výlety</a>
    <section class="glass-card trip-head">
      <div>
        <div class="badges">${countdown(trip.start_date)}<span class="pill">${icon('calendar', 'sm')} ${fmtRange(trip.start_date, trip.end_date)}</span><span class="pill sky">${icon('users', 'sm')} ${plural(trip.persons, 'osoba', 'osoby', 'osob')}</span></div>
        <h1>${esc(trip.title)}</h1>
        <div class="who"><span class="stack">${people.slice(0, 5).map((p, i) => `<span class="avatar ${AVATAR_TONES[i % 4]}">${esc(initials(p.name))}</span>`).join('')}</span>
          ${plural(people.length, 'cestovatel', 'cestovatelé', 'cestovatelů')}: <b>${people.slice(0, 3).map((p) => esc(p.name.split(/[ @]/)[0])).join(', ')}</b>${people.length > 3 ? ' a další' : ''}</div>
        ${trip.note ? `<p class="muted" style="margin-top:10px">${esc(trip.note)}</p>` : ''}
        <div class="actions">
          ${canEdit ? `<a class="btn" href="#/">${icon('plus')} Přidat do plánu</a>` : ''}
          ${isOwner ? `<button class="btn glass" id="invite-btn">${icon('users')} Pozvat přátele</button>` : ''}
          ${canEdit ? `<button class="btn glass" id="edit">${icon('edit')} Upravit</button>` : ''}
          ${isOwner ? `<button class="btn glass" id="share-btn">${icon('link')} Sdílet</button>` : ''}
        </div>
      </div>
      ${budgetBlock(total, trip.budget, trip.persons)}
    </section>

    <div class="detail-grid" style="margin-top:24px">
      <div>
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
    <div class="detail-grid" style="margin-top:24px"><div>${timeline(items, false)}</div><aside class="side">${costBreakdown(items, total)}</aside></div>`;
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
      state.user = user;
      renderAccount();
      toast(`Ahoj, ${user.name}!`);
      const next = sessionStorage.getItem('tf_after_login');
      sessionStorage.removeItem('tf_after_login');
      if (next && next !== location.hash) location.hash = next; else route();
    } catch (err) { document.getElementById('err').textContent = err.message; }
  });
}

function viewAccount() {
  if (!requireLogin()) return;
  $app.innerHTML = `<div class="glass-card auth" style="text-align:center">
    <span class="avatar" style="width:72px;height:72px;font-size:24px;margin:0 auto">${esc(initials(state.user.name))}</span>
    <h1 style="margin-top:14px">${esc(state.user.name)}</h1><p class="muted">${esc(state.user.email)}</p>
    <div style="display:grid;gap:10px;margin-top:20px"><a class="btn sky" href="#/trips">Moje výlety</a><button class="btn danger" id="lo">Odhlásit se</button></div>
  </div>`;
  document.getElementById('lo').onclick = logout;
}

// ---------- Start ----------
async function init() {
  $app.innerHTML = `<div class="grid">${'<div class="skeleton" style="height:340px"></div>'.repeat(3)}</div>`;
  try {
    const [meta, me, all] = await Promise.all([api('/meta'), api('/auth/me'), api('/destinations')]);
    state.meta = meta;
    state.user = me.user;
    state.all = all.results;
  } catch {
    $app.innerHTML = emptyState('📡', 'Nepodařilo se spojit se serverem. Jsi online?', '<button class="btn" onclick="location.reload()">Zkusit znovu</button>');
    return;
  }
  renderAccount();
  window.addEventListener('hashchange', route);
  route();
}
init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
