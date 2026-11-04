// TripFinder – frontend (vanilla JS, bez build kroku). Jednoduchý hash router.
const $app = document.getElementById('app');
const state = {
  user: undefined,
  meta: null,
  search: loadSearch(),
};

// ---------- Utility ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const czk = (n) => `${Math.round(n).toLocaleString('cs-CZ')} Kč`;
const MONTHS = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
const MONTHS_FULL = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
const COVERS = {
  europe: ['#3a7bd5', '#00d2ff'], asia: ['#f7971e', '#ffd200'], africa: ['#e65c00', '#f9d423'],
  north_america: ['#614385', '#516395'], south_america: ['#11998e', '#38ef7d'], oceania: ['#00b4db', '#0083b0'],
};
const cover = (c) => `--c1:${COVERS[c]?.[0] || '#999'};--c2:${COVERS[c]?.[1] || '#ccc'}`;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '');
const KIND_ICON = { destination: '📍', transport: '✈️', lodging: '🏨', note: '📝' };
const MODE_ICON = { flight: '✈️', bus: '🚌', train: '🚆' };

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
    const saved = JSON.parse(localStorage.getItem('tf_search') || '{}');
    const s = { ...base, ...saved };
    if (!s.from || new Date(s.from) < new Date(new Date().toDateString())) Object.assign(s, defaultDates());
    return s;
  } catch { return base; }
}
function saveSearch() {
  try { localStorage.setItem('tf_search', JSON.stringify(state.search)); } catch { /* ignore */ }
}
const nights = () => Math.max(1, Math.round((new Date(state.search.to) - new Date(state.search.from)) / 86400000) || 7);

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
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

// ---------- Header ----------
function renderAccount() {
  const el = document.getElementById('account');
  const bottom = document.getElementById('bottom-account');
  if (state.user) {
    const initials = state.user.name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
    el.innerHTML = `<span class="small muted" style="display:none" id="uname">${esc(state.user.name)}</span>
      <span class="avatar" title="${esc(state.user.email)}">${esc(initials)}</span>
      <button class="btn ghost small" id="logout">Odhlásit</button>`;
    el.querySelector('#logout').onclick = logout;
    bottom.href = '#/account';
  } else {
    el.innerHTML = `<a class="btn small secondary" href="#/login">Přihlásit</a><a class="btn small" href="#/register">Registrace</a>`;
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
  [/^#\/login$/, (m) => viewAuth('login'), 'account'],
  [/^#\/register$/, (m) => viewAuth('register'), 'account'],
  [/^#\/account$/, viewAccount, 'account'],
  [/^#\/shared\/([\w-]+)$/, viewShared, 'trips'],
];
async function route() {
  const hash = location.hash || '#/';
  for (const [re, view, nav] of routes) {
    const m = hash.match(re);
    if (m) {
      setActiveNav(nav);
      document.getElementById('modal-root').innerHTML = '';
      try { await view(...m.slice(1)); } catch (e) { $app.innerHTML = `<div class="empty"><div class="big">😕</div><p>${esc(e.message)}</p><a class="btn" href="#/">Zpět na hledání</a></div>`; }
      window.scrollTo(0, 0);
      return;
    }
  }
  $app.innerHTML = `<div class="empty"><div class="big">🧭</div><p>Tahle stránka neexistuje.</p><a class="btn" href="#/">Zpět na hledání</a></div>`;
}

// ---------- Hledání ----------
async function viewSearch() {
  const s = state.search;
  const { continents, tags } = state.meta;
  $app.innerHTML = `
    <section class="hero">
      <h1>Kam vyrazíš příště?</h1>
      <p>Hledej po celém světě nebo podle kontinentu. Ke každé destinaci ukážeme dopravu, ubytování a ceny od různých poskytovatelů.</p>
      <form class="searchbar" id="searchform">
        <div><label for="q">Destinace, země nebo nápad</label><input id="q" name="q" placeholder="např. Itálie, pláž, safari…" value="${esc(s.q)}"></div>
        <div><label for="from">Odjezd</label><input id="from" name="from" type="date" value="${esc(s.from)}"></div>
        <div><label for="to">Návrat</label><input id="to" name="to" type="date" value="${esc(s.to)}"></div>
        <div><label for="persons">Osob</label><input id="persons" name="persons" type="number" min="1" max="20" value="${esc(s.persons)}"></div>
        <button class="btn accent" type="submit">Hledat</button>
      </form>
    </section>

    <div class="chips" role="group" aria-label="Kontinent">
      <button class="chip" data-continent="world" aria-pressed="${s.continent === 'world'}">🌍 Celý svět</button>
      ${Object.entries(continents).map(([id, name]) => `<button class="chip" data-continent="${id}" aria-pressed="${s.continent === id}">${esc(name)}</button>`).join('')}
    </div>
    <div class="chips" role="group" aria-label="Typ výletu">
      ${Object.entries(tags).map(([id, name]) => `<button class="chip" data-tag="${id}" aria-pressed="${s.tags.includes(id)}">${esc(name)}</button>`).join('')}
    </div>

    <div class="filters">
      <div><label for="maxBudget">Max. rozpočet na osobu</label>
        <select id="maxBudget">${[['', 'Bez limitu'], [15000, 'do 15 000 Kč'], [25000, 'do 25 000 Kč'], [40000, 'do 40 000 Kč'], [60000, 'do 60 000 Kč'], [90000, 'do 90 000 Kč']]
          .map(([v, l]) => `<option value="${v}" ${String(s.maxBudget) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><label for="month">Nejlepší sezóna</label>
        <select id="month"><option value="">Kdykoli</option>${MONTHS_FULL.map((m, i) => `<option value="${i + 1}" ${String(s.month) === String(i + 1) ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div><label for="origin">Odlet z</label>
        <select id="origin">${[['PRG', 'Praha'], ['BRQ', 'Brno'], ['OSR', 'Ostrava'], ['VIE', 'Vídeň'], ['BTS', 'Bratislava'], ['KTW', 'Katovice']]
          .map(([v, l]) => `<option value="${v}" ${s.origin === v ? 'selected' : ''}>${l} (${v})</option>`).join('')}</select></div>
      <div><label for="sort">Řadit podle</label>
        <select id="sort">${[['recommended', 'Doporučené'], ['price', 'Ceny'], ['distance', 'Vzdálenosti'], ['name', 'Názvu']]
          .map(([v, l]) => `<option value="${v}" ${s.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>

    <div class="results-head"><h2 id="count">Výsledky</h2><span class="small muted">Odhad za ${s.persons} os. · ${nights()} nocí</span></div>
    <div class="grid" id="results">${'<div class="skeleton" style="height:260px"></div>'.repeat(6)}</div>`;

  const form = document.getElementById('searchform');
  const update = (patch) => { Object.assign(state.search, patch); saveSearch(); viewSearchResults(); };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const from = fd.get('from'); const to = fd.get('to');
    if (from && to && to <= from) return toast('Návrat musí být po odjezdu.');
    update({ q: fd.get('q'), from, to, persons: Math.max(1, Number(fd.get('persons')) || 1) });
    document.querySelector('.results-head .small').textContent = `Odhad za ${state.search.persons} os. · ${nights()} nocí`;
  });
  $app.querySelectorAll('[data-continent]').forEach((b) => b.addEventListener('click', () => {
    $app.querySelectorAll('[data-continent]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    update({ continent: b.dataset.continent });
  }));
  $app.querySelectorAll('[data-tag]').forEach((b) => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', on);
    const t = new Set(state.search.tags); on ? t.add(b.dataset.tag) : t.delete(b.dataset.tag);
    update({ tags: [...t] });
  }));
  ['maxBudget', 'month', 'origin', 'sort'].forEach((id) => document.getElementById(id).addEventListener('change', (e) => update({ [id]: e.target.value })));
  viewSearchResults();
}

async function viewSearchResults() {
  const s = state.search;
  const params = new URLSearchParams({ continent: s.continent, q: s.q, tags: s.tags.join(','), maxBudget: s.maxBudget, month: s.month, sort: s.sort, persons: s.persons, nights: nights() });
  const { results } = await api(`/destinations?${params}`);
  const el = document.getElementById('results');
  if (!el) return;
  document.getElementById('count').textContent = `${results.length} ${results.length === 1 ? 'destinace' : results.length < 5 && results.length ? 'destinace' : 'destinací'}`;
  if (!results.length) {
    el.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">🏝️</div><p>Těmto filtrům nic neodpovídá. Zkus uvolnit rozpočet nebo typ výletu.</p></div>`;
    return;
  }
  el.innerHTML = results.map((d) => `
    <a class="card dest-card" href="#/d/${d.id}">
      <div class="dest-cover" style="${cover(d.continent)}">${d.emoji}</div>
      <div class="dest-body">
        <h3>${esc(d.name)}</h3>
        <div class="small muted">${esc(d.country)} · ${esc(state.meta.continents[d.continent])}</div>
        <p>${esc(d.description)}</p>
        <div class="tags">${d.tags.map((t) => `<span class="tag">${esc(state.meta.tags[t])}</span>`).join('')}</div>
        <div class="dest-foot">
          <div class="price">od ${czk(d.estimate.perPerson)} <small>/ os.</small></div>
          <span class="small muted">${d.distanceKm.toLocaleString('cs-CZ')} km</span>
        </div>
      </div>
    </a>`).join('');
}

// ---------- Detail destinace ----------
async function viewDestination(id) {
  const { destination: d, continentName, tagNames } = await api(`/destinations/${id}`);
  const s = state.search;
  $app.innerHTML = `
    <a href="#/" class="btn ghost small">← Zpět na výsledky</a>
    <section class="detail-hero" style="margin-top:.75rem">
      <div class="detail-cover" style="${cover(d.continent)}">${d.emoji}</div>
      <div>
        <div class="small muted">${esc(d.country)} · ${esc(continentName)}</div>
        <h1>${esc(d.name)}</h1>
        <p>${esc(d.description)}</p>
        <div class="tags">${tagNames.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        <div class="facts">
          <div class="fact"><b>Měna</b>${esc(d.currency)}</div>
          <div class="fact"><b>Jazyk</b>${esc(d.language)}</div>
          <div class="fact"><b>Letiště</b>${esc(d.airport)}</div>
          <div class="fact"><b>Vzdálenost z Prahy</b>${d.distanceKm.toLocaleString('cs-CZ')} km</div>
          <div class="fact"><b>Denní útrata</b>~${czk(d.dailyCost)} / os.</div>
          <div class="fact"><b>Nejlepší sezóna</b><div class="months">${MONTHS.map((m, i) => `<span class="${d.bestMonths.includes(i + 1) ? 'on' : ''}" title="${MONTHS_FULL[i]}">${m[0]}</span>`).join('')}</div></div>
        </div>
        <button class="btn" id="save-dest">＋ Uložit destinaci do výletu</button>
      </div>
    </section>

    <form class="card offer-params" id="offerform">
      <div><label for="o-from">Odjezd</label><input id="o-from" name="from" type="date" value="${esc(s.from)}"></div>
      <div><label for="o-to">Návrat</label><input id="o-to" name="to" type="date" value="${esc(s.to)}"></div>
      <div><label for="o-persons">Osob</label><input id="o-persons" name="persons" type="number" min="1" max="20" value="${esc(s.persons)}"></div>
      <div><label for="o-origin">Odkud</label><input id="o-origin" name="origin" maxlength="3" value="${esc(s.origin)}"></div>
      <button class="btn" type="submit">Aktualizovat ceny</button>
    </form>
    <div id="offers"><div class="offers">${'<div class="skeleton"></div>'.repeat(4)}</div></div>`;

  document.getElementById('save-dest').onclick = () => saveToTrip('destination', {
    destinationId: d.id, title: d.name, subtitle: `${d.country} · ${continentName}`, emoji: d.emoji,
  });
  document.getElementById('offerform').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (fd.get('to') <= fd.get('from')) return toast('Návrat musí být po odjezdu.');
    Object.assign(state.search, { from: fd.get('from'), to: fd.get('to'), persons: Math.max(1, Number(fd.get('persons')) || 1), origin: String(fd.get('origin') || 'PRG').toUpperCase() });
    saveSearch();
    loadOffers(d);
  });
  loadOffers(d);
}

async function loadOffers(d) {
  const s = state.search;
  const el = document.getElementById('offers');
  el.innerHTML = `<div class="offers">${'<div class="skeleton"></div>'.repeat(4)}</div>`;
  const data = await api(`/destinations/${d.id}/offers?${new URLSearchParams({ from: s.from, to: s.to, persons: s.persons, origin: s.origin })}`);
  const { transport, lodging } = data.offers;
  const cheapestT = transport[0]?.price || 0;
  const cheapestL = lodging[0]?.price || 0;
  const anyMock = [...transport, ...lodging].some((o) => o.mock);
  el.innerHTML = `
    ${anyMock ? `<div class="notice">ℹ️ Ceny jsou zatím <b>ukázkové</b> – skutečné vyhledávače připojíme, až je schválíš. Odkazy „Otevřít“ už vedou na opravdové hledání u poskytovatele.</div>` : ''}
    <div class="card panel">
      <div class="small muted">Nejlevnější kombinace pro ${data.context.persons} os. · ${data.context.nights} nocí · ${fmtDate(data.context.from)} – ${fmtDate(data.context.to)}</div>
      <div class="price" style="font-size:1.5rem">${czk(cheapestT + cheapestL + d.dailyCost * data.context.persons * data.context.nights)}</div>
      <div class="small muted">doprava ${czk(cheapestT)} + ubytování ${czk(cheapestL)} + útrata na místě ~${czk(d.dailyCost * data.context.persons * data.context.nights)}</div>
    </div>
    ${offerSection('Doprava', '✈️', transport, 'transport')}
    ${offerSection('Ubytování', '🏨', lodging, 'lodging')}`;

  el.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    const sec = b.closest('section');
    sec.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    sec.querySelectorAll('.offer').forEach((o) => { o.hidden = b.dataset.filter !== 'all' && o.dataset.provider !== b.dataset.filter; });
  }));
  const all = [...transport, ...lodging];
  el.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', () => {
    const o = all.find((x) => x.id === b.dataset.save);
    saveToTrip(o.kind, { ...o, destinationId: d.id, destinationName: d.name, from: data.context.from, to: data.context.to, persons: data.context.persons });
  }));
}

function offerSection(title, icon, offers, kind) {
  const providers = [...new Map(offers.map((o) => [o.providerId, o.providerName])).entries()];
  return `<section>
    <h2 class="section-title">${icon} ${title} <span class="count">${offers.length} nabídek od ${providers.length} poskytovatelů</span></h2>
    ${offers.length ? `<div class="provider-tabs" role="group" aria-label="Poskytovatel">
      <button class="chip" data-filter="all" aria-pressed="true">Vše</button>
      ${providers.map(([id, name]) => `<button class="chip" data-filter="${esc(id)}" aria-pressed="false">${esc(name)}</button>`).join('')}
    </div>` : ''}
    <div class="offers">${offers.length ? offers.map((o, i) => `
      <article class="card offer" data-provider="${esc(o.providerId)}">
        <div>
          <div class="prov">${esc(o.providerName)} ${i === 0 ? '<span class="badge best">Nejlevnější</span>' : ''} ${o.mock ? '<span class="badge">ukázka</span>' : ''}</div>
          <h3>${kind === 'transport' ? MODE_ICON[o.mode] || '' : ''} ${esc(o.title)}</h3>
          <div class="meta"><span>${esc(o.subtitle)}</span>${o.details.map((x) => `<span>${esc(x)}</span>`).join('')}${o.rating ? `<span class="rating">${o.rating}</span>` : ''}</div>
        </div>
        <div class="right">
          <div><div class="price">${czk(o.price)}</div><div class="small muted">${esc(o.priceNote)}</div></div>
          <div class="actions">
            <button class="btn small secondary" data-save="${esc(o.id)}">＋ Do výletu</button>
            <a class="btn small" href="${esc(o.deepLink)}" target="_blank" rel="noopener">Otevřít ↗</a>
          </div>
        </div>
      </article>`).join('') : `<p class="muted">Pro tuto destinaci tu zatím nic nemáme.</p>`}
    </div></section>`;
}

// Uložení položky do výletu (výběr existujícího nebo založení nového).
async function saveToTrip(kind, data) {
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
    <p class="small muted">${esc(data.title)}${data.price ? ` · ${czk(data.price)}` : ''}</p>
    ${editable.length ? `<div class="list">${editable.map((t) => `<button class="btn secondary" data-trip="${t.id}"><span>${esc(t.title)}</span><span class="small muted">${t.item_count} položek</span></button>`).join('')}</div>` : ''}
    <form id="newtrip">
      <label for="nt-title">Nebo založ nový výlet</label>
      <input id="nt-title" name="title" placeholder="např. Léto v Itálii" value="${editable.length ? '' : esc(data.destinationName || data.title)}" required>
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Zrušit</button><button class="btn">Vytvořit a uložit</button></div>
    </form>`, (m, close) => {
    const add = async (tripId) => {
      await api(`/trips/${tripId}/items`, { method: 'POST', body: { kind, data } });
      close();
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

async function viewTrips() {
  if (!requireLogin()) return;
  const { trips } = await api('/trips');
  $app.innerHTML = `
    <div class="results-head"><h1>Moje výlety</h1><button class="btn" id="new">＋ Nový výlet</button></div>
    ${trips.length ? `<div class="grid">${trips.map((t) => `
      <a class="card trip-card" href="#/trips/${t.id}">
        <div class="row"><h3>${esc(t.title)}</h3><span class="role">${{ owner: 'Můj', editor: 'Spolucestující', viewer: 'Jen čtení' }[t.role]}</span></div>
        <div class="small muted">${t.start_date ? `${fmtDate(t.start_date)} – ${fmtDate(t.end_date)}` : 'Bez data'} · ${t.persons} os.</div>
        <div class="row"><span class="small muted">${t.item_count} položek · 👥 ${t.member_count + 1}</span><span class="price">${czk(t.total)}</span></div>
      </a>`).join('')}</div>`
      : `<div class="empty"><div class="big">🧳</div><p>Zatím nemáš žádný výlet. Najdi destinaci a ulož si dopravu nebo ubytování.</p><a class="btn" href="#/">Začít hledat</a></div>`}`;
  document.getElementById('new').onclick = () => modal(`
    <h2>Nový výlet</h2>
    <form id="f">
      <div><label for="t">Název</label><input id="t" name="title" required placeholder="např. Thajsko 2027"></div>
      <div class="filters" style="grid-template-columns:1fr 1fr;margin:0">
        <div><label for="sd">Od</label><input id="sd" name="start_date" type="date" value="${esc(state.search.from)}"></div>
        <div><label for="ed">Do</label><input id="ed" name="end_date" type="date" value="${esc(state.search.to)}"></div>
      </div>
      <div><label for="p">Počet osob</label><input id="p" name="persons" type="number" min="1" max="20" value="${esc(state.search.persons)}"></div>
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Zrušit</button><button class="btn">Vytvořit</button></div>
    </form>`, (m, close) => {
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

function renderItems(items, canEdit) {
  if (!items.length) return `<p class="muted">Výlet je zatím prázdný. <a href="#/">Najdi destinaci</a> a přidej dopravu nebo ubytování.</p>`;
  return items.map((it) => {
    const d = it.data;
    const icon = it.kind === 'transport' ? MODE_ICON[d.mode] || '✈️' : d.emoji || KIND_ICON[it.kind];
    return `<div class="item">
      <div class="ico">${icon}</div>
      <div class="grow">
        <div class="small muted">${it.kind === 'destination' ? 'Destinace' : esc(d.providerName || 'Poznámka')}${d.destinationName ? ` · ${esc(d.destinationName)}` : ''}</div>
        <h4>${d.destinationId && it.kind === 'destination' ? `<a href="#/d/${esc(d.destinationId)}">${esc(d.title)}</a>` : esc(d.title || d.text)}</h4>
        <div class="small muted">${esc(d.subtitle || '')}${d.from ? ` · ${fmtDate(d.from)} – ${fmtDate(d.to)}` : ''}${d.persons ? ` · ${d.persons} os.` : ''}</div>
        ${d.deepLink ? `<a class="small" href="${esc(d.deepLink)}" target="_blank" rel="noopener">Otevřít u poskytovatele ↗</a>` : ''}
      </div>
      <div style="text-align:right">
        ${it.price != null ? `<div class="price">${czk(it.price)}</div>` : ''}
        ${canEdit ? `<button class="btn ghost small" data-del="${it.id}" aria-label="Odebrat">✕</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function viewTrip(id) {
  if (!requireLogin()) return;
  const detail = await api(`/trips/${id}`);
  renderTrip(detail);
}

function renderTrip({ trip, role, owner, items, members, total }) {
  const canEdit = role !== 'viewer';
  const isOwner = role === 'owner';
  const shareUrl = trip.share_token ? `${location.origin}/#/shared/${trip.share_token}` : '';
  $app.innerHTML = `
    <a href="#/trips" class="btn ghost small">← Moje výlety</a>
    <div class="results-head" style="margin-top:.5rem">
      <div><h1>${esc(trip.title)}</h1>
        <div class="muted small">${trip.start_date ? `${fmtDate(trip.start_date)} – ${fmtDate(trip.end_date)}` : 'Bez data'} · ${trip.persons} os. · založil(a) ${esc(owner.name)}</div></div>
      ${canEdit ? `<button class="btn secondary small" id="edit">Upravit</button>` : ''}
    </div>
    ${trip.note ? `<p>${esc(trip.note)}</p>` : ''}
    <div class="two-col">
      <div class="card panel">
        <h2>Plán a rozpočet</h2>
        ${renderItems(items, canEdit)}
        <div class="total"><span>Celkem</span><span>${czk(total)}</span></div>
        ${trip.persons > 1 && total ? `<div class="small muted" style="text-align:right">${czk(total / trip.persons)} na osobu</div>` : ''}
        ${canEdit ? `<form class="inline-form" id="note"><input name="text" placeholder="Přidat poznámku (např. vízum, pojištění…)"><input name="price" type="number" min="0" placeholder="Kč" style="max-width:90px"><button class="btn small">Přidat</button></form>` : ''}
      </div>
      <div>
        <div class="card panel">
          <h2>Spolucestující</h2>
          <div class="member"><span class="avatar">${esc(owner.name[0]?.toUpperCase())}</span><span class="grow">${esc(owner.name)}</span><span class="role">vlastník</span></div>
          ${members.map((m) => `<div class="member">
            <span class="avatar" style="background:var(--accent)">${esc((m.name || m.email)[0].toUpperCase())}</span>
            <span class="grow">${esc(m.name || m.email)}${m.user_id ? '' : '<br><span class="small muted">čeká na registraci</span>'}</span>
            <span class="role">${m.role === 'editor' ? 'může upravovat' : 'jen čte'}</span>
            ${isOwner || m.user_id === state.user.id ? `<button class="btn ghost small" data-rm="${m.id}" aria-label="Odebrat">✕</button>` : ''}
          </div>`).join('')}
          ${isOwner ? `<form class="inline-form" id="invite">
            <input name="email" type="email" placeholder="e-mail kamaráda" required>
            <select name="role"><option value="editor">upravuje</option><option value="viewer">jen čte</option></select>
            <button class="btn small">Přidat</button></form>
            <p class="small muted">Když ještě nemá účet, uvidí výlet hned po registraci s tímto e-mailem.</p>` : ''}
        </div>
        ${isOwner ? `<div class="card panel">
          <h2>Sdílení</h2>
          <p class="small muted">Kdokoli s odkazem uvidí výlet (bez možnosti úprav).</p>
          ${shareUrl ? `<div class="share-box"><input readonly value="${esc(shareUrl)}" id="shareurl"><button class="btn small" id="copy">Kopírovat</button></div>
            <button class="btn ghost small" id="unshare" style="margin-top:.5rem">Zrušit sdílení</button>`
            : `<button class="btn secondary" id="share">🔗 Vytvořit odkaz pro sdílení</button>`}
        </div>
        <div class="panel"><button class="btn danger small" id="delete">Smazat výlet</button></div>` : ''}
      </div>
    </div>`;

  const run = (p) => p.then(renderTrip).catch((e) => toast(e.message));
  $app.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => run(api(`/trips/${trip.id}/items/${b.dataset.del}`, { method: 'DELETE' })));
  $app.querySelectorAll('[data-rm]').forEach((b) => b.onclick = async () => {
    const res = await api(`/trips/${trip.id}/members/${b.dataset.rm}`, { method: 'DELETE' }).catch((e) => toast(e.message));
    if (res?.left) { toast('Opustil(a) jsi výlet.'); location.hash = '#/trips'; } else if (res) renderTrip(res);
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
  const share = (enabled) => api(`/trips/${trip.id}/share`, { method: 'POST', body: { enabled } }).then(() => api(`/trips/${trip.id}`)).then(renderTrip).catch((e) => toast(e.message));
  document.getElementById('share')?.addEventListener('click', () => share(true));
  document.getElementById('unshare')?.addEventListener('click', () => share(false));
  document.getElementById('copy')?.addEventListener('click', async () => {
    const url = document.getElementById('shareurl').value;
    if (navigator.share) { navigator.share({ title: trip.title, url }).catch(() => {}); return; }
    await navigator.clipboard?.writeText(url).catch(() => {});
    toast('Odkaz zkopírován ✓');
  });
  document.getElementById('delete')?.addEventListener('click', async () => {
    if (!confirm(`Opravdu smazat výlet „${trip.title}“?`)) return;
    await api(`/trips/${trip.id}`, { method: 'DELETE' });
    toast('Výlet smazán.');
    location.hash = '#/trips';
  });
  document.getElementById('edit')?.addEventListener('click', () => modal(`
    <h2>Upravit výlet</h2>
    <form id="f">
      <div><label for="t">Název</label><input id="t" name="title" required value="${esc(trip.title)}"></div>
      <div class="filters" style="grid-template-columns:1fr 1fr;margin:0">
        <div><label for="sd">Od</label><input id="sd" name="start_date" type="date" value="${esc(trip.start_date || '')}"></div>
        <div><label for="ed">Do</label><input id="ed" name="end_date" type="date" value="${esc(trip.end_date || '')}"></div>
      </div>
      <div><label for="p">Počet osob</label><input id="p" name="persons" type="number" min="1" max="20" value="${trip.persons}"></div>
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
    <div class="notice">👀 Díváš se na sdílený výlet od <b>${esc(owner.name)}</b>. ${state.user ? '' : '<a href="#/register">Založ si účet</a> a plánuj vlastní.'}</div>
    <h1>${esc(trip.title)}</h1>
    <div class="muted small">${trip.start_date ? `${fmtDate(trip.start_date)} – ${fmtDate(trip.end_date)}` : ''} · ${trip.persons} os. · 👥 ${members.length + 1}</div>
    ${trip.note ? `<p>${esc(trip.note)}</p>` : ''}
    <div class="card panel" style="margin-top:1rem">
      ${renderItems(items, false)}
      <div class="total"><span>Celkem</span><span>${czk(total)}</span></div>
    </div>`;
}

// ---------- Účet ----------
function viewAuth(mode, hint = '') {
  if (state.user) { location.hash = '#/trips'; return; }
  const reg = mode === 'register';
  $app.innerHTML = `
    <div class="card auth">
      <h1>${reg ? 'Vytvořit účet' : 'Přihlášení'}</h1>
      ${hint ? `<p class="muted">${esc(hint)}</p>` : ''}
      <form id="f">
        ${reg ? `<div><label for="name">Jméno</label><input id="name" name="name" autocomplete="name" required></div>` : ''}
        <div><label for="email">E-mail</label><input id="email" name="email" type="email" autocomplete="email" required></div>
        <div><label for="password">Heslo</label><input id="password" name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" minlength="${reg ? 8 : 1}" required></div>
        <div class="error" id="err"></div>
        <button class="btn">${reg ? 'Zaregistrovat se' : 'Přihlásit se'}</button>
      </form>
      <p class="small muted" style="margin-top:1rem">${reg ? 'Už máš účet? <a href="#/login">Přihlas se</a>' : 'Nemáš účet? <a href="#/register">Zaregistruj se</a>'}</p>
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
  $app.innerHTML = `<div class="card auth">
    <h1>${esc(state.user.name)}</h1><p class="muted">${esc(state.user.email)}</p>
    <div style="display:grid;gap:.5rem"><a class="btn secondary" href="#/trips">Moje výlety</a><button class="btn danger" id="lo">Odhlásit se</button></div>
  </div>`;
  document.getElementById('lo').onclick = logout;
}

// ---------- Start ----------
async function init() {
  $app.innerHTML = `<div class="grid">${'<div class="skeleton" style="height:260px"></div>'.repeat(3)}</div>`;
  try {
    const [meta, me] = await Promise.all([api('/meta'), api('/auth/me')]);
    state.meta = meta;
    state.user = me.user;
  } catch {
    $app.innerHTML = `<div class="empty"><div class="big">📡</div><p>Nepodařilo se spojit se serverem. Jsi online?</p><button class="btn" onclick="location.reload()">Zkusit znovu</button></div>`;
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
