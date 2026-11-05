// Profil cestovatele (úvodní dotazník + úpravy), přátelé, pozvánky a chat.
import { autocomplete, ms } from './widgets.js';

let ctx; // { api, esc, toast, state, $app, initials, requireLogin, emptyState, route }
export function setupSocial(c) { ctx = c; }

const flag = (cc) => (cc ? String(cc).toUpperCase() : '');
const langName = (() => { const dn = new Intl.DisplayNames(['cs'], { type: 'language' }); return (c) => { try { return dn.of(c); } catch { return c; } }; })();
const LANGS = ['cs', 'sk', 'en', 'de', 'fr', 'es', 'it', 'pt', 'pl', 'hu', 'ru', 'uk', 'nl', 'sv', 'no', 'da', 'fi', 'el', 'tr', 'hr', 'sl', 'sr', 'ro', 'bg', 'ar', 'he', 'zh', 'ja', 'ko', 'th', 'vi', 'id', 'hi'];
const EU = new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH'.split(' '));

let countriesCache;
async function countries() {
  countriesCache ||= ctx.api('/countries').then((r) => r.countries);
  return countriesCache;
}
export async function loadProfile() {
  if (!ctx.state.user) { ctx.state.profile = null; return null; }
  if (!ctx.state.profile) ctx.state.profile = (await ctx.api('/me/profile')).profile;
  return ctx.state.profile;
}

// ---------- Výhody z profilu: slevy podle věku, pas a jazyky ----------
export function ageDiscount(profile = ctx.state.profile) {
  const age = profile?.age;
  if (age == null) return null;
  if (age < 6) return { pct: 100, label: 'Dítě do 6 let jezdí vlakem i autobusem většinou zdarma' };
  if (age < 18) return { pct: 25, label: 'Jízdné pro děti a mládež: sleva cca 25 % (ČD, RegioJet, ÖBB…)' };
  if (age < 26) return { pct: 25, label: 'Do 26 let: jízdné pro mladé ~25 %, se ISIC i slevy na vstupné a Interrail Youth' };
  if (age >= 65) return { pct: 25, label: 'Od 65 let: seniorská sleva cca 25 % na vlaky a autobusy' };
  if (age >= 60) return { pct: 10, label: 'Od 60 let: senior tarify u některých dopravců (např. ÖBB, DB BahnCard Senior)' };
  return null;
}
export function profileHints(dest, langCodes = []) {
  const p = ctx.state.profile;
  if (!p?.onboarded) return '';
  const out = [];
  const cc = (dest.cc || '').toUpperCase();
  if (cc && p.passports.length) {
    const inEU = p.passports.some((x) => EU.has(x));
    if (p.passports.includes(cc)) out.push(`${ms('badge')} Cestuješ do své země (${flag(cc)}), stačí doklad.`);
    else if (inEU && EU.has(cc)) out.push(ms('badge') + 'Schengen / EU: bez víza, stačí občanský průkaz.');
    else out.push(`${ms('badge')} Pas ${p.passports.map(flag).join(' ')}: ověř si vízum na <a href="https://www.mzv.gov.cz/jnp/cz/cestujeme/" target="_blank" rel="noopener">mzv.gov.cz – Cestujeme</a>.`);
  }
  if (langCodes.length && p.languages.length) {
    const common = langCodes.filter((l) => p.languages.includes(l));
    if (common.length) out.push(`${ms('translate')} Domluvíš se místním jazykem: ${common.map(langName).join(', ')}.`);
    else if (p.languages.includes('en')) out.push(`${ms('translate')} Místně se mluví ${langCodes.slice(0, 2).map(langName).join(', ')} – v turistických místech s angličtinou nebude problém.`);
    else out.push(`${ms('translate')} Místní jazyk: ${langCodes.slice(0, 2).map(langName).join(', ')}. Hodí se offline překladač.`);
  }
  const d = ageDiscount(p);
  if (d) out.push(`${ms('confirmation_number')} ${d.label}.`);
  return out.length ? `<div class="profile-hints">${out.map((h) => `<div>${h}</div>`).join('')}</div>` : '';
}

// ---------- Formulářové prvky ----------
function countrySelect(id, value, list, placeholder = 'Vyber zemi') {
  return `<select id="${id}"><option value="">${placeholder}</option>${list.map((c) => `<option value="${c.cc}"${c.cc === value ? ' selected' : ''}>${flag(c.cc)} ${ctx.esc(c.name)}</option>`).join('')}</select>`;
}
function chipPicker(el, { options, selected, label }) {
  const sel = new Set(selected);
  const draw = () => {
    el.innerHTML = options.map(([v, l]) => `<button type="button" class="chip" data-v="${v}" aria-pressed="${sel.has(v)}">${l}</button>`).join('');
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    sel.has(b.dataset.v) ? sel.delete(b.dataset.v) : sel.add(b.dataset.v);
    b.setAttribute('aria-pressed', sel.has(b.dataset.v));
  });
  draw();
  el.setAttribute('aria-label', label);
  return () => [...sel];
}
function passportPicker(el, list, selected) {
  const sel = [...selected];
  const draw = () => {
    el.innerHTML = `${sel.map((cc) => `<span class="chip" aria-pressed="true">${flag(cc)} ${ctx.esc(list.find((c) => c.cc === cc)?.name || cc)} <button type="button" class="x" data-rm="${cc}" aria-label="Odebrat">×</button></span>`).join('')}
      ${sel.length < 4 ? countrySelect('pp-add', '', list, sel.length ? '+ Další pas' : 'Vyber stát pasu') : ''}`;
    el.querySelector('#pp-add')?.addEventListener('change', (e) => { if (e.target.value && !sel.includes(e.target.value)) sel.push(e.target.value); draw(); });
  };
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { sel.splice(sel.indexOf(b.dataset.rm), 1); draw(); } });
  draw();
  return () => sel;
}
function homePicker(input, p) {
  let home = { id: p.homePlace, name: p.homePlaceName };
  input.value = p.homePlaceName || '';
  autocomplete(input, { onSelect: (item) => { home = { id: item.id, name: item.name }; input.value = item.name; } });
  return () => (input.value.trim() ? home : { id: '', name: '' });
}

function profileFields(p, list) {
  const e = ctx.esc;
  return `
    <div class="two">
      <div><label for="pf-home-cc">Země, kde žiješ</label>${countrySelect('pf-home-cc', p.homeCc, list)}</div>
      <div class="ac-wrap"><label for="pf-home">Domovské město (odtud budeme hledat spoje)</label><input id="pf-home" placeholder="např. Brno" autocomplete="off"></div>
    </div>
    <div><label>Národnost – jaký máš pas</label><div class="chips wrap" id="pf-pass"></div></div>
    <div class="two">
      <div><label for="pf-birth">Datum narození <span class="muted small">(kvůli slevám pro mladé a seniory)</span></label><input id="pf-birth" type="date" max="${new Date().toISOString().slice(0, 10)}" value="${e(p.birthDate)}"></div>
      <div class="age-out" id="pf-age"></div>
    </div>
    <div><label>Jakými jazyky mluvíš</label><div class="chips wrap" id="pf-langs"></div></div>`;
}
function mountProfileFields(root, p, list) {
  const getPass = passportPicker(root.querySelector('#pf-pass'), list, p.passports.length ? p.passports : (p.homeCc ? [p.homeCc] : []));
  const getLangs = chipPicker(root.querySelector('#pf-langs'), { options: LANGS.map((l) => [l, langName(l)]), selected: p.languages.length ? p.languages : ['cs'], label: 'Jazyky' });
  const getHome = homePicker(root.querySelector('#pf-home'), p);
  const birth = root.querySelector('#pf-birth'); const ageOut = root.querySelector('#pf-age');
  const showAge = () => {
    const d = birth.value ? ageDiscount({ age: Math.floor((Date.now() - new Date(birth.value)) / 31557600000) }) : null;
    ageOut.innerHTML = d ? `<span class="pill mint">${ms('confirmation_number')} ${ctx.esc(d.label)}</span>` : '';
  };
  birth.addEventListener('change', showAge); showAge();
  return () => {
    const home = getHome();
    return { homeCc: root.querySelector('#pf-home-cc').value, homePlace: home.id, homePlaceName: home.name, passports: getPass(), birthDate: birth.value, languages: getLangs() };
  };
}
async function saveProfile(body) {
  const r = await ctx.api('/me/profile', { method: 'PUT', body });
  ctx.state.profile = r.profile; ctx.state.user = { ...ctx.state.user, ...r.user };
  applyHomeOrigin();
  return r;
}
// Domovské město jako výchozí místo odletu (jen když si ho uživatel v hledání sám nezměnil).
export function applyHomeOrigin() {
  const p = ctx.state.profile; const s = ctx.state.search;
  if (!p?.homePlace || s.originTouched) return;
  s.origin = p.homePlace; s.originLabel = p.homePlaceName || s.originLabel;
}

// ---------- Úvodní dotazník po registraci ----------
export async function viewWelcome() {
  if (!ctx.requireLogin()) return;
  const [p, list] = await Promise.all([loadProfile(), countries()]);
  ctx.$app.innerHTML = `
    <div class="glass-card auth welcome">
      <span class="pill coral">PÁR OTÁZEK NA ZAČÁTEK</span>
      <h1 style="margin-top:12px">Ahoj ${ctx.esc(ctx.state.user.name)}</h1>
      <p class="muted" style="margin-top:6px">Podle toho ti ukážeme spoje z tvého města, slevy podle věku, jestli potřebuješ vízum a kde se domluvíš. Všechno jde kdykoli změnit v profilu.</p>
      <form id="wf">${profileFields(p, list)}
        <div class="error" id="err"></div>
        <div class="row-actions"><button class="btn">Uložit a začít</button><button type="button" class="btn ghost" id="skip">Teď ne</button></div>
      </form>
    </div>`;
  const read = mountProfileFields(ctx.$app, p, list);
  const done = () => { const next = sessionStorage.getItem('tf_after_login'); sessionStorage.removeItem('tf_after_login'); location.hash = next || '#/'; };
  document.getElementById('skip').onclick = async () => { await saveProfile({ onboarded: true }).catch(() => {}); done(); };
  document.getElementById('wf').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await saveProfile({ ...read(), onboarded: true }); ctx.toast('Profil uložen'); done(); } catch (err) { document.getElementById('err').textContent = err.message; }
  });
}

// ---------- Profil v účtu ----------
export async function profileBlock(root) {
  const [p, list] = await Promise.all([loadProfile(), countries()]);
  root.innerHTML = `<div class="glass-card profile-edit">
      <div class="section-head"><h2>Můj profil cestovatele</h2>${p.age != null ? `<span class="pill sky">${p.age} let</span>` : ''}</div>
      <form id="pf">
        <div><label for="pf-name">Jméno</label><input id="pf-name" value="${ctx.esc(ctx.state.user.name)}" maxlength="80" required></div>
        ${profileFields(p, list)}
        <div class="error" id="perr"></div>
        <button class="btn">Uložit profil</button>
      </form></div>`;
  const read = mountProfileFields(root, p, list);
  root.querySelector('#pf').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await saveProfile({ ...read(), name: root.querySelector('#pf-name').value, onboarded: true });
      ctx.renderAccount(); ctx.toast('Profil uložen');
    } catch (err) { root.querySelector('#perr').textContent = err.message; }
  });
}

// ---------- Odznak v hlavičce ----------
let pollTimer;
export async function refreshBadge() {
  clearTimeout(pollTimer);
  if (!ctx.state.user) return;
  try {
    const n = await ctx.api('/notifications');
    const total = n.unread + n.requests;
    document.querySelectorAll('[data-chat-badge]').forEach((b) => { b.textContent = total > 9 ? '9+' : total || ''; b.hidden = !total; });
    if (total !== (refreshBadge.last ?? total) && location.hash === '#/chat' && !document.querySelector('.modal')) viewChat();
    if (total > (refreshBadge.last ?? total) && !location.hash.startsWith('#/chat')) ctx.toast(n.requests > (refreshBadge.req ?? 0) ? 'Nová žádost o přátelství' : 'Nová zpráva');
    refreshBadge.last = total; refreshBadge.req = n.requests;
  } catch { /* offline */ }
  pollTimer = setTimeout(refreshBadge, document.hidden ? 120000 : 25000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx?.state.user) refreshBadge(); });

// ---------- Chat: skupinové chaty výletů + zprávy s přáteli ----------
const timeLabel = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`); const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
};
const clock = (iso) => new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
const dayStamp = (iso) => {
  const d = new Date(iso); const t = new Date();
  const label = d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' });
  if (d.toDateString() === t.toDateString()) return `Dnes • ${label}`;
  if (d.toDateString() === new Date(t.getTime() - 86400000).toDateString()) return `Včera • ${label}`;
  return label;
};
const daysTo = (start) => (start ? Math.ceil((new Date(start) - new Date(new Date().toDateString())) / 86400000) : null);
const linkify = (html) => html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
let chatTimer;

export async function viewChat(friendId, tripId) {
  clearTimeout(chatTimer);
  if (!ctx.requireLogin()) return;
  const e = ctx.esc;
  const [data, conv] = await Promise.all([ctx.api('/friends'), ctx.api('/conversations')]);
  const activeFriend = friendId ? Number(friendId) : null;
  const activeTrip = tripId ? Number(tripId) : null;
  const tripRow = (t) => `<a class="conv${t.id === activeTrip ? ' active' : ''}${t.status === 'done' ? ' done' : ''}" href="#/chat/t/${t.id}" data-name="${e(t.title.toLowerCase())}">
      <span class="grow"><b class="ellipsis">${e(t.title)}${t.status === 'done' ? ' <span class="tag">Archiv</span>' : ''}</b>
        <small class="ellipsis">${t.lastMessage ? `${e(t.lastMessage.name.split(' ')[0])}: ${e(t.lastMessage.body)}` : `${t.people} ${t.people === 1 ? 'účastník' : t.people < 5 ? 'účastníci' : 'účastníků'} • zatím bez zpráv`}</small></span>
      <span class="meta">${t.unread ? `<span class="count">${t.unread}</span>` : ''}<small>${t.lastMessage ? timeLabel(t.lastMessage.at) : ''}</small></span></a>`;
  const friendRow = (f) => `<a class="conv${f.id === activeFriend ? ' active' : ''}" href="#/chat/${f.id}" data-name="${e(f.name.toLowerCase())}">
      <span class="avatar">${e(ctx.initials(f.name))}</span>
      <span class="grow"><b class="ellipsis">${e(f.name)}</b><small class="ellipsis">${f.lastMessage ? e(f.lastMessage.body) : 'Napiš první zprávu'}</small></span>
      <span class="meta">${f.unread ? `<span class="count">${f.unread}</span>` : ''}<small>${f.lastMessage ? timeLabel(f.lastMessage.at) : ''}</small></span></a>`;
  const activeCount = conv.trips.filter((t) => t.status !== 'done').length;
  const has = activeFriend || activeTrip;
  ctx.$app.innerHTML = `
    <div class="page-head chat-hero"><div><span class="eyebrow"><i class="live-dot"></i> Společné plánování v reálném čase</span><h1 class="h-lg">Skupinový chat & kurace</h1></div></div>
    <div class="chat-page${has ? ' has-active' : ''}">
      <aside class="chat-side">
        <div class="search-pill">${ms('search')}<input id="chat-q" placeholder="Hledat konverzaci…" aria-label="Hledat konverzaci"></div>
        <section class="card bento">
          <div class="card-head"><span class="eyebrow">Aktivní plány</span><span class="tag">${activeCount} ${activeCount === 1 ? 'cesta' : activeCount > 1 && activeCount < 5 ? 'cesty' : 'cest'}</span></div>
          <div class="conv-list">${conv.trips.map(tripRow).join('') || `<p class="small muted empty-line">Každý výlet má vlastní skupinový chat. <a href="#/trips">Založ první výlet</a>.</p>`}</div>
        </section>
        <section class="card bento">
          <div class="card-head"><span class="eyebrow">Přátelé</span><button class="btn soft sm" id="add-friend">${ms('person_add', 'sm')} Přidat</button></div>
          ${data.incoming.length ? `<div class="requests">${data.incoming.map((r) => `
            <div class="conv req"><span class="avatar">${e(ctx.initials(r.name))}</span><span class="grow"><b class="ellipsis">${e(r.name)}</b><small class="ellipsis">chce být tvůj přítel</small></span>
              <button class="btn sm" data-accept="${r.id}">Přijmout</button><button class="icon-btn" data-decline="${r.id}" aria-label="Odmítnout">${ms('close', 'sm')}</button></div>`).join('')}</div>` : ''}
          <div class="conv-list">${data.friends.map(friendRow).join('') || '<p class="small muted empty-line">Zatím tu nikoho nemáš. Přidej kamaráda podle e-mailu nebo mu pošli pozvánku.</p>'}</div>
          ${data.outgoing.length ? `<div class="small muted label-sm">Čeká na přijetí</div>${data.outgoing.map((o) => `<div class="conv req muted"><span class="avatar">${e(ctx.initials(o.name))}</span><span class="grow ellipsis">${e(o.name)}</span><button class="btn ghost sm" data-decline="${o.id}">Zrušit</button></div>`).join('')}` : ''}
        </section>
        <section class="card bento" id="trip-summary" hidden></section>
      </aside>
      <section class="card chat-main" id="chat-main">${has ? '<div class="skeleton" style="height:100%;min-height:300px"></div>' : `<div class="empty"><div class="big">${ms('forum')}</div><p>Vyber výlet nebo kamaráda a domluvte se, kam pojedete.</p></div>`}</section>
    </div>`;
  ctx.$app.querySelector('#add-friend').onclick = addFriendModal;
  ctx.$app.querySelector('#chat-q').addEventListener('input', (ev) => {
    const q = ev.target.value.trim().toLowerCase();
    ctx.$app.querySelectorAll('.conv[data-name]').forEach((a) => { a.hidden = q && !a.dataset.name.includes(q); });
  });
  ctx.$app.querySelectorAll('[data-accept]').forEach((b) => { b.onclick = async () => { await ctx.api(`/friends/${b.dataset.accept}/accept`, { method: 'POST' }); ctx.toast('Teď jste přátelé'); location.hash = `#/chat/${b.dataset.accept}`; refreshBadge(); }; });
  ctx.$app.querySelectorAll('[data-decline]').forEach((b) => { b.onclick = async () => { await ctx.api(`/friends/${b.dataset.decline}`, { method: 'DELETE' }); refreshBadge(); viewChat(friendId, tripId); }; });
  const box = document.getElementById('chat-main');
  if (activeTrip) await mountTripChat(box, activeTrip, conv.trips.find((t) => t.id === activeTrip));
  else if (activeFriend) await mountConversation(box, activeFriend, data.friends.find((f) => f.id === activeFriend));
}

// Společné prvky obou typů konverzace
function messageList(list, { group }) {
  const e = ctx.esc;
  let lastDay = list.dataset.lastDay || ''; let lastSender = list.dataset.lastSender || '';
  return (messages) => messages.map((m) => {
    const day = new Date(m.at).toDateString();
    let out = '';
    if (day !== lastDay) { out += `<div class="day-sep"><span>${dayStamp(m.at)}</span></div>`; lastDay = day; lastSender = ''; }
    const head = group && !m.mine && lastSender !== String(m.sender?.id);
    lastSender = String(m.mine ? 'me' : m.sender?.id);
    list.dataset.lastDay = lastDay; list.dataset.lastSender = lastSender;
    const card = m.data?.type === 'place' ? placeCard(m) : '';
    return `${out}<div class="msg${m.mine ? ' mine' : ''}${head ? ' head' : ''}" data-id="${m.id}">
      ${group && !m.mine ? `<span class="avatar sm">${head ? e(ctx.initials(m.sender.name)) : ''}</span>` : ''}
      <div class="msg-col">${head ? `<span class="msg-meta"><b>${e(m.sender.name.split(' ')[0])}</b> ${clock(m.at)}</span>` : ''}
        ${m.body ? `<span class="bubble">${linkify(e(m.body))}</span>` : ''}${card}
        ${m.mine || !group ? `<time>${clock(m.at)}</time>` : ''}</div></div>`;
  }).join('');
}

let tripCache = null;
function placeCard(m) {
  const e = ctx.esc; const d = m.data;
  const item = tripCache?.items.find((i) => i.id === d.itemId);
  return `<div class="place-card" data-msg="${m.id}">
    <div class="pc-img">${d.image ? `<img src="${e(d.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${ms('location_on')}
      <span class="pc-txt"><b>${e(d.title)}</b>${d.subtitle ? `<small>${e(d.subtitle)}</small>` : ''}</span></div>
    <div class="pc-actions">
      ${item ? `<button class="btn soft sm${item.voted ? ' on' : ''}" data-vote="${item.id}">${ms('thumb_up', 'sm')} Souhlasím (${item.votes})</button>` : '<span></span>'}
      ${item ? `<a class="btn sm" href="#/trips/${tripCache.trip.id}">${ms('event_note', 'sm')} V itineráři</a>` : `<button class="btn sm" data-add-place="${m.id}">${ms('add', 'sm')} Přidat do itineráře</button>`}
    </div></div>`;
}

async function mountTripChat(box, id, conv) {
  const e = ctx.esc;
  if (!conv) { box.innerHTML = `<div class="empty"><div class="big">${ms('lock')}</div><p>Tento výlet nenajdeme. Možná tě z něj organizátor odebral.</p></div>`; return; }
  tripCache = await ctx.api(`/trips/${id}`).catch(() => null);
  const t = tripCache?.trip || conv;
  const left = daysTo(t.start_date);
  const places = tripCache ? tripCache.items.filter((i) => i.kind !== 'destination').length : conv.places;
  box.innerHTML = `
    <header class="chat-head">
      <a class="icon-btn back" href="#/chat" aria-label="Zpět">${ms('arrow_back')}</a>
      <span class="conv-ic">${e(ctx.initials(t.title))}</span>
      <div class="grow"><div class="ch-title"><b class="ellipsis">${e(t.title)}</b>${left != null && left >= 0 && t.status !== 'done' ? `<span class="tag">${left === 0 ? 'Odjezd dnes' : `Zbývá ${left} ${left === 1 ? 'den' : left < 5 ? 'dny' : 'dní'} do odletu`}</span>` : ''}</div>
        <small class="muted ellipsis">${conv.people} ${conv.people === 1 ? 'účastník' : conv.people < 5 ? 'účastníci' : 'účastníků'}${t.start_date ? ` • ${ctx.fmtRange(t.start_date, t.end_date)}` : ''} • ${places} ${places === 1 ? 'uložené místo' : places > 1 && places < 5 ? 'uložená místa' : 'uložených míst'}</small></div>
      <a class="btn soft sm hide-sm" href="#/trips/${id}">${ms('map', 'sm')} Zobrazit itinerář</a>
    </header>
    <div class="msgs" id="msgs"><div class="skeleton" style="height:60px"></div></div>
    <div class="composer-wrap">
      <form class="composer" id="composer">
        <button type="button" class="icon-btn" id="share-place" title="Sdílet místo" aria-label="Sdílet místo">${ms('add_location_alt')}</button>
        <input id="msg" placeholder="Napiš zprávu partě…" autocomplete="off" maxlength="2000">
        <button class="btn sm">Odeslat ${ms('arrow_upward', 'sm')}</button>
      </form>
      <p class="small muted composer-tip">Tip: špendlíkem sdílíš místo z plánu nebo z mapy a parta o něm může hlasovat.</p>
    </div>`;
  renderTripSummary(id);
  const list = box.querySelector('#msgs');
  const render = messageList(list, { group: true });
  let lastId = 0; let first = true;
  const bind = () => {
    list.querySelectorAll('[data-vote]').forEach((b) => { b.onclick = async () => { tripCache = await ctx.api(`/trips/${id}/items/${b.dataset.vote}/vote`, { method: 'POST' }); rerenderCards(); }; });
    list.querySelectorAll('[data-add-place]').forEach((b) => {
      b.onclick = async () => {
        const msg = all.find((m) => String(m.id) === b.dataset.addPlace);
        const d = msg.data;
        try {
          tripCache = await ctx.api(`/trips/${id}/items`, { method: 'POST', body: { kind: 'note', data: { title: d.title, note: d.subtitle || '', category: 'sight', lat: d.lat, lng: d.lng, image: d.image } } });
          const added = tripCache.items.at(-1); d.itemId = added.id;
          ctx.toast('Přidáno do nápadů party'); rerenderCards();
        } catch (err) { ctx.toast(err.message); }
      };
    });
  };
  const all = [];
  const rerenderCards = () => {
    list.querySelectorAll('.place-card').forEach((el) => {
      const m = all.find((x) => String(x.id) === el.dataset.msg);
      if (m) el.outerHTML = placeCard(m);
    });
    bind();
  };
  const load = async () => {
    if (!document.body.contains(list)) return;
    try {
      const r = await ctx.api(`/trips/${id}/chat?after=${lastId}`);
      if (first) { list.innerHTML = r.messages.length ? '' : '<p class="muted small center empty-line">Zatím žádné zprávy. Napiš partě, co plánuješ.</p>'; first = false; }
      if (r.messages.length) {
        list.querySelector('p.center')?.remove();
        const fresh = r.messages.filter((m) => !all.some((x) => x.id === m.id));
        all.push(...fresh);
        const stick = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
        list.insertAdjacentHTML('beforeend', render(fresh));
        lastId = r.messages.at(-1).id;
        if (stick || fresh.length) list.scrollTop = list.scrollHeight;
        bind(); refreshBadge();
      }
    } catch { /* offline */ }
    chatTimer = setTimeout(load, document.hidden ? 30000 : 4000);
  };
  await load();
  const send = async (body) => {
    const { message } = await ctx.api(`/trips/${id}/chat`, { method: 'POST', body });
    list.querySelector('p.center')?.remove();
    all.push(message);
    list.insertAdjacentHTML('beforeend', render([message])); lastId = Math.max(lastId, message.id);
    list.scrollTop = list.scrollHeight; bind();
  };
  const input = box.querySelector('#msg');
  box.querySelector('#composer').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = input.value.trim(); if (!body) return;
    input.value = '';
    try { await send({ body }); } catch (err) { ctx.toast(err.message); input.value = body; }
  });
  box.querySelector('#share-place').onclick = () => {
    const items = (tripCache?.items || []).filter((i) => i.kind === 'note' || i.kind === 'lodging');
    ctx.modal(`<h2>Sdílet místo</h2><p class="muted" style="margin-top:6px">Vyber místo z plánu, nebo najdi nové. Parta o něm může hlasovat.</p>
      <div class="ac-wrap" style="margin-top:16px"><label for="sp-q">Najít místo</label><input id="sp-q" placeholder="Kavárna, vyhlídka, adresa…"></div>
      ${items.length ? `<div class="pick-list">${items.map((i) => `<button class="pick" data-item="${i.id}">${ms('location_on')}<span class="grow"><b>${e(i.data.title || '')}</b><small>${e(i.data.place || i.data.note || i.data.subtitle || '')}</small></span>${ms('send', 'sm')}</button>`).join('')}</div>` : ''}`, (m, close) => {
      m.querySelectorAll('[data-item]').forEach((b) => {
        b.onclick = () => {
          const it = items.find((x) => String(x.id) === b.dataset.item);
          close();
          send({ data: { type: 'place', title: it.data.title, subtitle: it.data.place || it.data.note || it.data.subtitle || '', image: it.data.image || null, lat: it.data.lat ?? it.data.location?.lat, lng: it.data.lng ?? it.data.location?.lng, itemId: it.id } }).catch((err) => ctx.toast(err.message));
        };
      });
      autocomplete(m.querySelector('#sp-q'), {
        onSelect: (r) => { close(); send({ data: { type: 'place', title: r.name, subtitle: r.detail || '', lat: r.lat, lng: r.lng } }).catch((err) => ctx.toast(err.message)); },
      });
    });
  };
  if (window.innerWidth >= 900) input.focus();
}

function renderTripSummary(id) {
  const box = document.getElementById('trip-summary');
  if (!box || !tripCache) return;
  const { trip, items, total } = tripCache;
  const persons = Number(trip.persons) || 1;
  const ideas = items.filter((i) => i.kind === 'note' && !i.data.day).length;
  const pct = trip.budget ? Math.min(100, Math.round((total / trip.budget) * 100)) : 0;
  box.hidden = false;
  box.innerHTML = `<div class="card-head"><h3>${ms('donut_small', 'sm')} Souhrn výletu</h3></div>
    <p class="small muted">${items.filter((i) => i.kind !== 'destination').length} položek v plánu • ${ideas} ${ideas === 1 ? 'nápad čeká' : 'nápadů čeká'} na hlasování.</p>
    <div class="soft-box"><div class="row-between"><span class="small muted">Rozpočet na osobu</span><b class="num">${ctx.czk(total / persons)}</b></div>
      ${trip.budget ? `<div class="progress"><i style="width:${pct}%"></i></div>` : ''}</div>
    <a class="btn soft wide" href="#/trips/${id}">${ms('calculate', 'sm')} Otevřít plán a rozpočet</a>`;
}

async function mountConversation(box, id, friend) {
  const e = ctx.esc;
  if (!friend) { box.innerHTML = `<div class="empty"><div class="big">${ms('lock')}</div><p>Psát si můžeš jen s přáteli.</p></div>`; return; }
  box.innerHTML = `
    <header class="chat-head"><a class="icon-btn back" href="#/chat" aria-label="Zpět">${ms('arrow_back')}</a><span class="conv-ic">${e(ctx.initials(friend.name))}</span>
      <div class="grow"><b class="ellipsis">${e(friend.name)}</b><small class="muted ellipsis">${e(friend.email || '')}</small></div>
      <button class="btn ghost sm" id="unfriend" title="Odebrat z přátel">Odebrat</button></header>
    <div class="msgs" id="msgs"><div class="skeleton" style="height:60px"></div></div>
    <div class="composer-wrap"><form class="composer" id="composer"><input id="msg" placeholder="Napiš zprávu…" autocomplete="off" maxlength="2000"><button class="btn sm">Odeslat ${ms('arrow_upward', 'sm')}</button></form></div>`;
  const list = box.querySelector('#msgs');
  const render = messageList(list, { group: false });
  let lastId = 0; let first = true;
  const load = async () => {
    if (!document.body.contains(list)) return;
    try {
      const r = await ctx.api(`/chat/${id}?after=${lastId}`);
      if (first) { list.innerHTML = r.messages.length ? '' : '<p class="muted small center empty-line">Zatím žádné zprávy. Pozdrav!</p>'; first = false; }
      if (r.messages.length) {
        list.querySelector('p.center')?.remove();
        const fresh = r.messages.filter((m) => !list.querySelector(`[data-id="${m.id}"]`));
        list.insertAdjacentHTML('beforeend', render(fresh));
        lastId = r.messages.at(-1).id;
        list.scrollTop = list.scrollHeight;
        refreshBadge();
      }
    } catch { /* offline */ }
    chatTimer = setTimeout(load, document.hidden ? 30000 : 4000);
  };
  await load();
  const input = box.querySelector('#msg');
  box.querySelector('#composer').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = input.value.trim(); if (!body) return;
    input.value = '';
    try {
      const { message } = await ctx.api(`/chat/${id}`, { method: 'POST', body: { body } });
      list.querySelector('p.center')?.remove();
      list.insertAdjacentHTML('beforeend', render([message])); lastId = Math.max(lastId, message.id);
      list.scrollTop = list.scrollHeight;
    } catch (err) { ctx.toast(err.message); input.value = body; }
  });
  box.querySelector('#unfriend').onclick = async () => {
    if (!confirm(`Odebrat ${friend.name} z přátel?`)) return;
    await ctx.api(`/friends/${id}`, { method: 'DELETE' }); location.hash = '#/chat';
  };
  if (window.innerWidth >= 900) input.focus();
}

function addFriendModal() {
  ctx.modal(`
    <h2>Přidat přítele</h2>
    <p class="muted small" style="margin:6px 0 14px">Kamarád dostane žádost a musí ji přijmout. Teprve pak si můžete psát.</p>
    <form id="af"><div><label for="af-email">E-mail kamaráda</label><input id="af-email" type="email" required placeholder="jana@example.cz"></div>
      <div class="error" id="af-err"></div><button class="btn">Poslat žádost</button></form>
    <div class="divider"><span>nebo</span></div>
    <p class="small muted">Nemá ještě účet? Pošli mu pozvánku. Po registraci ji jedním klikem přijme.</p>
    <button class="btn sky" id="af-link" style="margin-top:8px">${ms('link')} Vytvořit pozvánku</button>
    <div id="af-out"></div>`, (m, close) => {
    m.querySelector('#af').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        const r = await ctx.api('/friends', { method: 'POST', body: { email: m.querySelector('#af-email').value } });
        ctx.toast(r.status === 'accepted' ? `Teď jste s ${r.user.name} přátelé` : `Žádost odeslána – čeká na ${r.user.name}`);
        close(); viewChat();
      } catch (err) { m.querySelector('#af-err').textContent = err.message; }
    });
    m.querySelector('#af-link').onclick = async () => {
      const { token } = await ctx.api('/friends/invite-link', { method: 'POST' });
      const url = `${location.origin}/#/invite/${token}`;
      m.querySelector('#af-out').innerHTML = `<div class="copy-row"><input readonly value="${ctx.esc(url)}"><button class="btn sm" id="af-copy">Sdílet</button></div>`;
      m.querySelector('#af-copy').onclick = () => ctx.shareLink('Pojď se mnou plánovat výlety ve Wanderly', url);
    };
  });
}

export async function viewInvite(token) {
  const e = ctx.esc;
  let inv;
  try { inv = await ctx.api(`/friends/invite/${token}`); } catch (err) { ctx.$app.innerHTML = ctx.emptyState('link', err.message, '<a class="btn" href="#/">Domů</a>'); return; }
  const name = inv.inviter.name;
  ctx.$app.innerHTML = `<div class="glass-card auth center">
      <div class="big-emoji">${ms('handshake')}</div>
      <h1>${e(name)} tě zve mezi přátele</h1>
      <p class="muted" style="margin:8px 0 18px">Jako přátelé si můžete psát a plánovat společné výlety.</p>
      ${inv.self ? '<p class="muted">Tohle je tvoje pozvánka – pošli ji kamarádovi.</p>'
        : inv.friends ? `<a class="btn" href="#/chat/${inv.inviter.id}">Už jste přátelé – napsat zprávu</a>`
        : ctx.state.user ? '<div class="row-actions center"><button class="btn" id="acc">Přijmout</button><a class="btn ghost" href="#/">Odmítnout</a></div>'
        : '<div class="row-actions center"><a class="btn" href="#/register" id="reg">Založit účet a přijmout</a><a class="btn ghost" href="#/login" id="log">Mám účet</a></div>'}
    </div>`;
  ctx.$app.querySelectorAll('#reg, #log').forEach((a) => a.addEventListener('click', () => sessionStorage.setItem('tf_after_login', location.hash)));
  const acc = document.getElementById('acc');
  if (acc) acc.onclick = async () => {
    const r = await ctx.api(`/friends/invite/${token}/accept`, { method: 'POST' });
    ctx.toast(`Teď jste s ${name} přátelé`);
    location.hash = `#/chat/${r.friendId}`;
  };
}
