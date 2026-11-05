// Profil cestovatele (úvodní dotazník + úpravy), přátelé, pozvánky a chat.
import { autocomplete, ms, popover, closePopover } from './widgets.js';

let ctx; // { api, esc, toast, state, $app, initials, requireLogin, emptyState, route }
export function setupSocial(c) { ctx = c; }

// Vlajky jako SVG obrázky (fungují všude, i ve Windows, kde emoji vlajky chybí)
export const flag = (cc) => (/^[a-z]{2}$/i.test(cc || '') ? `<img class="flag" src="/vendor/flags/${cc.toLowerCase()}.svg" alt="" width="20" height="15" loading="lazy" onerror="this.style.visibility='hidden'">` : '');
const LANG_CC = { cs: 'cz', sk: 'sk', en: 'gb', de: 'de', fr: 'fr', es: 'es', it: 'it', pt: 'pt', pl: 'pl', hu: 'hu', ru: 'ru', uk: 'ua', nl: 'nl', sv: 'se', no: 'no', da: 'dk', fi: 'fi', el: 'gr', tr: 'tr', hr: 'hr', sl: 'si', sr: 'rs', ro: 'ro', bg: 'bg', ar: 'sa', he: 'il', zh: 'cn', ja: 'jp', ko: 'kr', th: 'th', vi: 'vn', id: 'id', hi: 'in' };
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
const normTxt = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
// Výběr státu s vlajkami a hledáním (systémový <select> neumí obrázky)
function openCountryList(anchor, list, onPick, exclude = []) {
  const el = popover(anchor, `<input class="cp-q" placeholder="Hledat stát…" aria-label="Hledat stát" autocomplete="off"><div class="cp-list" role="listbox"></div>`, { className: 'cp-pop' });
  const box = el.querySelector('.cp-list'); const q = el.querySelector('.cp-q');
  const draw = () => {
    const nq = normTxt(q.value.trim());
    const rows = list.filter((c) => !exclude.includes(c.cc) && (!nq || normTxt(c.name).includes(nq) || c.cc.toLowerCase() === nq));
    box.innerHTML = rows.slice(0, 250).map((c) => `<button type="button" class="cp-row" data-cc="${c.cc}" role="option">${flag(c.cc)}<span>${ctx.esc(c.name)}</span></button>`).join('') || '<p class="small muted" style="padding:8px">Nic jsme nenašli.</p>';
  };
  q.addEventListener('input', draw);
  box.addEventListener('click', (e) => { const b = e.target.closest('[data-cc]'); if (b) { closePopover(); onPick(b.dataset.cc); } });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); box.querySelector('[data-cc]')?.click(); } });
  draw();
  if (window.innerWidth >= 640) q.focus();
}
function countryButton(id, value, list, placeholder = 'Vyber zemi') {
  const c = list.find((x) => x.cc === value);
  return `<button type="button" class="cpick${c ? '' : ' empty'}" id="${id}" data-value="${value || ''}">${c ? `${flag(c.cc)}<span>${ctx.esc(c.name)}</span>` : `${ms('public', 'sm')}<span>${placeholder}</span>`}${ms('expand_more', 'sm')}</button>`;
}
function bindCountryButton(btn, list) {
  btn.addEventListener('click', () => openCountryList(btn, list, (cc) => {
    btn.outerHTML = countryButton(btn.id, cc, list);
    bindCountryButton(document.getElementById(btn.id), list);
  }));
}
function chipPicker(el, { options, selected, label }) {
  const sel = new Set(selected);
  const draw = () => {
    el.innerHTML = options.map(([v, l, pre = '']) => `<button type="button" class="chip" data-v="${v}" aria-pressed="${sel.has(v)}">${pre}${l}</button>`).join('');
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
      ${sel.length < 4 ? `<button type="button" class="chip add-chip" id="pp-add">${ms('add', 'sm')} ${sel.length ? 'Další pas' : 'Vyber stát pasu'}</button>` : ''}`;
    el.querySelector('#pp-add')?.addEventListener('click', (e) => openCountryList(e.currentTarget, list, (cc) => { if (!sel.includes(cc)) sel.push(cc); draw(); }, sel));
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
      <div><label for="pf-home-cc">Země, kde žiješ</label>${countryButton('pf-home-cc', p.homeCc, list)}</div>
      <div class="ac-wrap"><label for="pf-home">Domovské město (odtud budeme hledat spoje)</label><input id="pf-home" placeholder="např. Brno" autocomplete="off"></div>
    </div>
    <div><label>Národnost – jaký máš pas</label><div class="chips wrap" id="pf-pass"></div></div>
    <div class="two">
      <div><label for="pf-birth">Datum narození <span class="muted small">(kvůli slevám pro mladé a seniory)</span></label><input id="pf-birth" type="date" data-past max="${new Date().toISOString().slice(0, 10)}" value="${e(p.birthDate)}"></div>
      <div class="age-out" id="pf-age"></div>
    </div>
    <div><label>Jakými jazyky mluvíš</label><div class="chips wrap" id="pf-langs"></div></div>`;
}
function mountProfileFields(root, p, list) {
  const getPass = passportPicker(root.querySelector('#pf-pass'), list, p.passports.length ? p.passports : (p.homeCc ? [p.homeCc] : []));
  bindCountryButton(root.querySelector('#pf-home-cc'), list);
  const getLangs = chipPicker(root.querySelector('#pf-langs'), { options: LANGS.map((l) => [l, langName(l), `${flag(LANG_CC[l])} `]), selected: p.languages.length ? p.languages : ['cs'], label: 'Jazyky' });
  const getHome = homePicker(root.querySelector('#pf-home'), p);
  const birth = root.querySelector('#pf-birth'); const ageOut = root.querySelector('#pf-age');
  const showAge = () => {
    const d = birth.value ? ageDiscount({ age: Math.floor((Date.now() - new Date(birth.value)) / 31557600000) }) : null;
    ageOut.innerHTML = d ? `<span class="pill mint">${ms('confirmation_number')} ${ctx.esc(d.label)}</span>` : '';
  };
  birth.addEventListener('change', showAge); showAge();
  return () => {
    const home = getHome();
    return { homeCc: root.querySelector('#pf-home-cc').dataset.value, homePlace: home.id, homePlaceName: home.name, passports: getPass(), birthDate: birth.value, languages: getLangs() };
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
// Živé změny ze serveru (SSE): otevřená konverzace se načte hned, polling je jen záloha.
let liveHandler = null;
window.addEventListener('tf:live', (ev) => liveHandler?.(ev.detail));
const pollDelay = () => (document.hidden ? 30000 : ctx.state.live ? 20000 : 4000);

export async function viewChat(friendId, tripId) {
  clearTimeout(chatTimer); liveHandler = null;
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
      ${ctx.avatarHtml(f)}
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
            <div class="conv req">${ctx.avatarHtml(r)}<span class="grow"><b class="ellipsis">${e(r.name)}</b><small class="ellipsis">chce být tvůj přítel</small></span>
              <button class="btn sm" data-accept="${r.id}">Přijmout</button><button class="icon-btn" data-decline="${r.id}" aria-label="Odmítnout">${ms('close', 'sm')}</button></div>`).join('')}</div>` : ''}
          <div class="conv-list">${data.friends.map(friendRow).join('') || '<p class="small muted empty-line">Zatím tu nikoho nemáš. Přidej kamaráda podle e-mailu nebo mu pošli pozvánku.</p>'}</div>
          ${data.outgoing.length ? `<div class="small muted label-sm">Čeká na přijetí</div>${data.outgoing.map((o) => `<div class="conv req muted">${ctx.avatarHtml(o)}<span class="grow ellipsis">${e(o.name)}</span><button class="btn ghost sm" data-decline="${o.id}">Zrušit</button></div>`).join('')}` : ''}
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
    const card = m.data ? chatCard(m) : '';
    return `${out}<div class="msg${m.mine ? ' mine' : ''}${head ? ' head' : ''}" data-id="${m.id}">
      ${group && !m.mine ? `${head ? ctx.avatarHtml(m.sender, 'sm') : '<span class="avatar sm blank"></span>'}` : ''}
      <div class="msg-col">${head ? `<span class="msg-meta"><b>${e(m.sender.name.split(' ')[0])}</b> ${clock(m.at)}</span>` : ''}
        ${m.body ? `<span class="bubble">${linkify(e(m.body))}</span>` : ''}${card}
        ${m.mine || !group ? `<time>${clock(m.at)}</time>` : ''}</div></div>`;
  }).join('');
}

// Zpráva se ukáže hned po odeslání (šedě), než ji potvrdí server.
function pendingBubble(list, body) {
  list.insertAdjacentHTML('beforeend', `<div class="msg mine pending"><div class="msg-col"><span class="bubble">${ctx.esc(body)}</span></div></div>`);
  list.scrollTop = list.scrollHeight;
  return list.lastElementChild;
}
let tripCache = null;
let chatAnswers = {};
const me = () => ctx.state.user?.id;
const firstName = (n = '') => n.split(' ')[0];
const avatarsRow = (list) => (list.length ? `<span class="mini-stack">${list.slice(0, 5).map((u) => ctx.avatarHtml({ id: u.userId ?? u.id, name: u.name, avatar_v: u.avatar_v }, 'xs')).join('')}${list.length > 5 ? `<span class="avatar xs">+${list.length - 5}</span>` : ''}</span>` : '');
const people = () => (tripCache ? [{ id: tripCache.owner.id, name: tripCache.owner.name, avatar_v: tripCache.owner.avatar_v }, ...tripCache.members.filter((m) => m.user_id).map((m) => ({ id: m.user_id, name: m.name || m.email, avatar_v: m.avatar_v }))] : []);
const shortDate = (iso) => { const d = new Date(`${iso}T12:00:00`); return `${['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'][d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}.`; };

// Karty zpráv v chatu výletu podle typu
function chatCard(m) {
  const t = m.data.type;
  const inner = { place: placeCard, poll: pollCard, datepoll: datePollCard, survey: surveyCard, item: itemCard, day: dayCard, payments: paymentsCard }[t];
  return inner ? `<div class="chat-card ${t}-card" data-msg="${m.id}">${inner(m)}</div>` : '';
}
const closedTag = (m) => (m.data.closed ? '<span class="tag">Uzavřeno</span>' : '');
const ownerTools = (m) => (m.mine || tripCache?.role === 'owner' ? `<button class="link-btn" data-close-poll="${m.id}" data-on="${m.data.closed ? 0 : 1}">${m.data.closed ? 'Znovu otevřít' : 'Uzavřít hlasování'}</button>` : '');

function placeCard(m) {
  const e = ctx.esc; const d = m.data;
  const item = tripCache?.items.find((i) => i.id === d.itemId);
  return `<div class="pc-img">${d.image ? `<img src="${e(d.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${ms('location_on')}
      <span class="pc-txt"><b>${e(d.title)}</b>${d.subtitle ? `<small>${e(d.subtitle)}</small>` : ''}</span></div>
    <div class="pc-actions">
      ${item ? `<button class="btn soft sm${item.myVote === 1 ? ' on' : ''}" data-vote="${item.id}">${ms('thumb_up', 'sm')} Souhlasím (${item.up ?? item.votes})</button>` : '<span></span>'}
      ${item ? `<a class="btn sm" href="#/trips/${tripCache.trip.id}">${ms('event_note', 'sm')} V itineráři</a>` : `<button class="btn sm" data-add-place="${m.id}">${ms('add', 'sm')} Přidat do itineráře</button>`}
    </div>`;
}

function pollCard(m) {
  const e = ctx.esc; const d = m.data; const ans = chatAnswers[m.id] || [];
  const mine = ans.find((a) => a.userId === me())?.value || [];
  const counts = d.options.map((_, i) => ans.filter((a) => a.value.includes(i)));
  const max = Math.max(1, ...counts.map((c) => c.length));
  return `<div class="cc-head"><span class="cc-ic">${ms('ballot')}</span><span class="grow"><small>Anketa${d.multi ? ' · více odpovědí' : ''}</small><b>${e(d.title)}</b></span>${closedTag(m)}</div>
    <div class="poll-opts">${d.options.map((o, i) => `<button class="poll-opt${mine.includes(i) ? ' on' : ''}" data-poll="${m.id}" data-i="${i}" ${d.closed ? 'disabled' : ''}>
      <i style="width:${Math.round((counts[i].length / max) * 100)}%"></i>
      <span class="po-check">${mine.includes(i) ? ms('check_circle', 'sm') : ms('radio_button_unchecked', 'sm')}</span><span class="grow">${e(o)}</span>${avatarsRow(counts[i])}<b>${counts[i].length}</b></button>`).join('')}</div>
    <div class="cc-foot"><span class="small muted">${ans.length} z ${people().length || '?'} hlasovalo</span>${ownerTools(m)}</div>`;
}

function datePollCard(m) {
  const e = ctx.esc; const d = m.data; const ans = chatAnswers[m.id] || [];
  const mine = ans.find((a) => a.userId === me())?.value || [];
  const counts = d.dates.map((_, i) => ans.filter((a) => a.value.includes(i)));
  const best = Math.max(0, ...counts.map((c) => c.length));
  const bestDays = best ? d.dates.filter((_, i) => counts[i].length === best) : [];
  return `<div class="cc-head"><span class="cc-ic">${ms('event_available')}</span><span class="grow"><small>Kdy máte volno · klikni na dny, kdy můžeš</small><b>${e(d.title)}</b></span>${closedTag(m)}</div>
    <div class="date-grid">${d.dates.map((x, i) => `<button class="date-cell${mine.includes(i) ? ' on' : ''}${best && counts[i].length === best ? ' best' : ''}" data-dpoll="${m.id}" data-i="${i}" ${d.closed ? 'disabled' : ''} title="${e(counts[i].map((a) => a.name).join(', ') || 'Zatím nikdo')}">
      <small>${shortDate(x).split(' ')[0]}</small><b>${shortDate(x).split(' ').slice(1).join(' ')}</b><span class="dc-n">${ms('group', 'sm')} ${counts[i].length}</span></button>`).join('')}</div>
    <div class="cc-foot"><span class="small muted">${bestDays.length ? `Nejvíc lidí (${best}) může: <b>${bestDays.slice(0, 4).map(shortDate).join(', ')}${bestDays.length > 4 ? '…' : ''}</b>` : 'Zatím nikdo nehlasoval'}</span>${ownerTools(m)}</div>
    ${ans.length ? `<div class="cc-who">${ans.map((a) => `<span>${ctx.avatarHtml({ id: a.userId, name: a.name, avatar_v: a.avatar_v }, 'xs')} ${e(firstName(a.name))} · ${a.value.length} ${a.value.length === 1 ? 'den' : a.value.length < 5 ? 'dny' : 'dní'}</span>`).join('')}</div>` : ''}`;
}

function surveyCard(m) {
  const e = ctx.esc; const d = m.data; const ans = chatAnswers[m.id] || [];
  const mine = ans.find((a) => a.userId === me());
  return `<div class="cc-head"><span class="cc-ic">${ms('checklist')}</span><span class="grow"><small>Dotazník · ${d.questions.length} ${d.questions.length === 1 ? 'otázka' : d.questions.length < 5 ? 'otázky' : 'otázek'}</small><b>${e(d.title)}</b></span>${closedTag(m)}</div>
    <ol class="survey-q">${d.questions.map((q) => `<li>${e(q)}</li>`).join('')}</ol>
    <div class="cc-foot"><span class="small muted">${avatarsRow(ans)} ${ans.length} ${ans.length === 1 ? 'odpověď' : ans.length > 1 && ans.length < 5 ? 'odpovědi' : 'odpovědí'}</span>
      <span class="row-actions">${ans.length ? `<button class="btn ghost sm" data-survey-show="${m.id}">Odpovědi</button>` : ''}${d.closed ? '' : `<button class="btn sm" data-survey="${m.id}">${mine ? 'Upravit odpověď' : 'Vyplnit'}</button>`}</span></div>
    <div class="cc-foot right">${ownerTools(m)}</div>`;
}

// Položka z itineráře: vždy aktuální podle plánu
function itemCard(m) {
  const e = ctx.esc; const it = tripCache?.items.find((i) => i.id === m.data.itemId);
  if (!it) return `<div class="cc-head"><span class="cc-ic">${ms('event_note')}</span><span class="grow"><small>Z itineráře</small><b>${e(m.data.title)}</b></span><span class="tag">Smazáno z plánu</span></div>`;
  const c = ctx.itemCat(it); const cat = ctx.ACT_CATS[c]; const w = ctx.itemWhen(it); const d = it.data; const img = ctx.itemImage(it);
  return `<a class="item-share" href="#/trips/${tripCache.trip.id}">
      <span class="is-media" style="--c:${ctx.CAT_COLOR[c]}">${img ? `<img src="${e(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${ms(cat.ic)}</span>
      <span class="grow"><small>${e(cat.label)} · ${w.day ? `${shortDate(w.day)}${w.time ? ` ${w.time}` : ''}` : 'nápad bez dne'}</small><b>${e(ctx.itemTitle(it))}</b>
        <small class="muted">${[d.place || d.address || (d.fromPlace && `${d.fromPlace} → ${d.toPlace}`), it.price != null && ctx.czk(it.price), d.booking && `rezervace ${d.booking}`].filter(Boolean).map(e).join(' · ')}</small></span></a>
    ${!w.day && it.kind === 'note' ? `<div class="pc-actions"><button class="btn soft sm${it.myVote === 1 ? ' on' : ''}" data-ivote="${it.id}" data-v="${it.myVote === 1 ? 0 : 1}">${ms('thumb_up', 'sm')} ${it.up}</button><button class="btn soft sm${it.myVote === -1 ? ' on' : ''}" data-ivote="${it.id}" data-v="${it.myVote === -1 ? 0 : -1}">${ms('thumb_down', 'sm')} ${it.down}</button></div>` : ''}`;
}

function dayCard(m) {
  const e = ctx.esc; const day = m.data.day;
  const list = (tripCache?.items || []).filter((i) => i.kind !== 'destination' && ctx.itemWhen(i).day === day).sort((x, y) => (ctx.itemWhen(x).time || '99').localeCompare(ctx.itemWhen(y).time || '99'));
  return `<div class="cc-head"><span class="cc-ic">${ms('calendar_today')}</span><span class="grow"><small>Program dne</small><b>${e(shortDate(day))}</b></span></div>
    <ul class="day-share">${list.map((i) => `<li><span class="mono">${e(ctx.itemWhen(i).time || '—')}</span><i style="background:${ctx.CAT_COLOR[ctx.itemCat(i)]}"></i><span class="ellipsis">${e(ctx.itemTitle(i))}</span></li>`).join('') || '<li class="muted">Na tento den zatím nic není.</li>'}</ul>
    <div class="cc-foot"><a class="btn soft sm" href="#/trips/${tripCache?.trip.id}">${ms('event_note', 'sm')} Otevřít itinerář</a></div>`;
}

// Stav plateb: kdo kolik ještě doplácí (vždy aktuální)
function paymentsCard() {
  const e = ctx.esc;
  if (!tripCache) return '';
  const ps = people();
  const money = ctx.tripMoney(tripCache.items, ps);
  const rows = ps.map((p) => ({ p, x: money.person(p.id) }));
  const left = rows.reduce((s, r) => s + Math.max(0, r.x.left), 0);
  const my = rows.find((r) => r.p.id === me())?.x;
  const next = my?.open[0];
  return `<div class="cc-head"><span class="cc-ic">${ms('payments')}</span><span class="grow"><small>Stav plateb · aktuálně</small><b>Zbývá doplatit ${ctx.czk(left)}</b></span></div>
    <ul class="pay-share">${rows.map(({ p, x }) => `<li>${ctx.avatarHtml(p, 'xs')}<span class="grow ellipsis">${e(firstName(p.name))}</span><span class="pbar"><i style="width:${x.owe ? Math.round((x.paid / x.owe) * 100) : 100}%"></i></span><b class="num">${x.left > 0.5 ? ctx.czk(x.left) : ms('check_circle', 'sm')}</b></li>`).join('')}</ul>
    ${next ? `<p class="small muted" style="margin-top:8px">Tvoje nejbližší platba: <b>${e(ctx.itemTitle(next.it))}</b> ${ctx.czk(next.share)}${next.due ? ` do ${shortDate(next.due)}` : ''}</p>` : ''}
    <div class="cc-foot"><a class="btn soft sm" href="#/trips/${tripCache.trip.id}">${ms('payments', 'sm')} Platby a náklady</a></div>`;
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
        <button type="button" class="icon-btn attach-btn" id="attach" title="Anketa, kalendář, místo, platby…" aria-label="Přidat anketu, místo nebo položku z plánu">${ms('add_circle')}</button>
        <input id="msg" placeholder="Napiš zprávu partě…" autocomplete="off" maxlength="2000">
        <button class="btn sm">Odeslat ${ms('arrow_upward', 'sm')}</button>
      </form>
      <p class="small muted composer-tip">Tip: přes + založíš anketu, zjistíš, kdy má kdo volno, nebo nasdílíš něco z plánu a stav plateb.</p>
    </div>`;
  renderTripSummary(id);
  const list = box.querySelector('#msgs');
  const render = messageList(list, { group: true });
  let lastId = 0; let first = true;
  const all = [];
  const answer = async (mid, value) => {
    try { ({ answers: chatAnswers } = await ctx.api(`/trips/${id}/chat/${mid}/answer`, { method: 'POST', body: { value } })); rerenderCards(); } catch (err) { ctx.toast(err.message); }
  };
  const myAnswer = (mid) => chatAnswers[mid]?.find((x) => x.userId === me())?.value || [];
  const bind = () => {
    list.querySelectorAll('[data-vote]').forEach((b) => { b.onclick = async () => { tripCache = await ctx.api(`/trips/${id}/items/${b.dataset.vote}/vote`, { method: 'POST' }); rerenderCards(); }; });
    list.querySelectorAll('[data-ivote]').forEach((b) => { b.onclick = async () => { tripCache = await ctx.api(`/trips/${id}/items/${b.dataset.ivote}/vote`, { method: 'POST', body: { value: Number(b.dataset.v) } }); rerenderCards(); }; });
    list.querySelectorAll('[data-poll]').forEach((b) => {
      b.onclick = () => {
        const msg = all.find((x) => String(x.id) === b.dataset.poll); const i = Number(b.dataset.i);
        const cur = myAnswer(msg.id);
        const next = cur.includes(i) ? cur.filter((x) => x !== i) : msg.data.multi ? [...cur, i] : [i];
        answer(msg.id, next);
      };
    });
    list.querySelectorAll('[data-dpoll]').forEach((b) => {
      b.onclick = () => { const mid = Number(b.dataset.dpoll); const i = Number(b.dataset.i); const cur = myAnswer(mid); answer(mid, cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]); };
    });
    list.querySelectorAll('[data-close-poll]').forEach((b) => {
      b.onclick = async () => {
        try {
          const { message } = await ctx.api(`/trips/${id}/chat/${b.dataset.closePoll}/close`, { method: 'POST', body: { closed: b.dataset.on === '1' } });
          const i = all.findIndex((x) => x.id === message.id); if (i >= 0) all[i] = message;
          rerenderCards();
        } catch (err) { ctx.toast(err.message); }
      };
    });
    list.querySelectorAll('[data-survey]').forEach((b) => {
      b.onclick = () => {
        const msg = all.find((x) => String(x.id) === b.dataset.survey); const cur = myAnswer(msg.id);
        ctx.modal(`<h2>${e(msg.data.title)}</h2><form id="sv" class="stack-form">${msg.data.questions.map((q, i) => `<div><label for="sv${i}">${e(q)}</label><textarea id="sv${i}" maxlength="600" rows="2">${e(cur[i] || '')}</textarea></div>`).join('')}
          <div class="modal-actions"><button type="button" class="btn ghost" data-close>Zrušit</button><button class="btn">Odeslat odpověď</button></div></form>`, (m, close) => {
          m.querySelector('#sv').onsubmit = (ev) => { ev.preventDefault(); const v = msg.data.questions.map((_, i) => m.querySelector(`#sv${i}`).value); close(); answer(msg.id, v); };
        });
      };
    });
    list.querySelectorAll('[data-survey-show]').forEach((b) => {
      b.onclick = () => {
        const msg = all.find((x) => String(x.id) === b.dataset.surveyShow); const ans = chatAnswers[msg.id] || [];
        ctx.modal(`<h2>${e(msg.data.title)}</h2><div class="survey-answers">${msg.data.questions.map((q, i) => `<section><h3>${e(q)}</h3>${ans.filter((x) => x.value[i]).map((x) => `<div class="sa">${ctx.avatarHtml({ id: x.userId, name: x.name, avatar_v: x.avatar_v }, 'xs')}<span><b>${e(firstName(x.name))}</b> ${e(x.value[i])}</span></div>`).join('') || '<p class="small muted">Zatím bez odpovědi.</p>'}</section>`).join('')}</div>
          <div class="modal-actions"><button class="btn" data-close>Zavřít</button></div>`);
      };
    });
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
  const rerenderCards = () => {
    list.querySelectorAll('.chat-card').forEach((el) => {
      const m = all.find((x) => String(x.id) === el.dataset.msg);
      if (m) el.outerHTML = chatCard(m);
    });
    bind();
  };
  let ticks = 0;
  const load = async () => {
    if (!document.body.contains(list)) return;
    try {
      const r = await ctx.api(`/trips/${id}/chat?after=${lastId}`);
      // Odpovědi na ankety a plán se mění i u starších zpráv: překreslit karty, když se něco změnilo
      let changed = JSON.stringify(r.answers || {}) !== JSON.stringify(chatAnswers);
      chatAnswers = r.answers || {};
      if (++ticks % 4 === 0 && list.querySelector('.item-card, .day-card, .payments-card, .place-card')) { const t = await ctx.api(`/trips/${id}`).catch(() => null); if (t && JSON.stringify(t.items) !== JSON.stringify(tripCache?.items)) { tripCache = t; changed = true; } }
      if (changed && !first) rerenderCards();
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
    chatTimer = setTimeout(load, pollDelay());
  };
  await load();
  liveHandler = async (d) => {
    if (!document.body.contains(list) || d.tripId !== id) return;
    if (d.type === 'chat') { clearTimeout(chatTimer); load(); return; }
    if (d.type === 'trip') { const t = await ctx.api(`/trips/${id}`).catch(() => null); if (t) { tripCache = t; rerenderCards(); renderTripSummary(id); } }
  };
  const send = async (body) => {
    const { message } = await ctx.api(`/trips/${id}/chat`, { method: 'POST', body });
    list.querySelector('p.center')?.remove();
    if (all.some((x) => x.id === message.id)) return;
    all.push(message);
    list.insertAdjacentHTML('beforeend', render([message])); lastId = Math.max(lastId, message.id);
    list.scrollTop = list.scrollHeight; bind();
  };
  const input = box.querySelector('#msg');
  box.querySelector('#composer').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = input.value.trim(); if (!body) return;
    input.value = '';
    const temp = pendingBubble(list, body);
    try { await send({ body }); temp.remove(); } catch (err) { temp.remove(); ctx.toast(err.message); input.value = body; }
  });
  const sharePlace = () => {
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
  const fail = (err) => ctx.toast(err.message);
  // Anketa
  const pollModal = () => ctx.modal(`<h2>Anketa</h2><form id="pf" class="stack-form">
      <div><label for="pq">Otázka</label><input id="pq" required maxlength="200" placeholder="např. Kam půjdeme v sobotu večer?"></div>
      <div><span class="label">Možnosti</span><div class="opt-list" id="opts">${[1, 2, 3].map((i) => `<input maxlength="120" placeholder="Možnost ${i}">`).join('')}</div>
        <button type="button" class="btn ghost sm" id="opt-add" style="margin-top:8px">${ms('add', 'sm')} Přidat možnost</button></div>
      <label class="check-row"><input type="checkbox" id="pmulti"> Povolit víc odpovědí</label>
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Zrušit</button><button class="btn">Poslat anketu</button></div></form>`, (m, close) => {
    m.querySelector('#opt-add').onclick = () => { const box2 = m.querySelector('#opts'); if (box2.children.length >= 10) return; box2.insertAdjacentHTML('beforeend', `<input maxlength="120" placeholder="Možnost ${box2.children.length + 1}">`); box2.lastElementChild.focus(); };
    m.querySelector('#pf').onsubmit = (ev) => {
      ev.preventDefault();
      const options = [...m.querySelectorAll('#opts input')].map((x) => x.value.trim()).filter(Boolean);
      if (options.length < 2) { ctx.toast('Zadej aspoň dvě možnosti.'); return; }
      close(); send({ data: { type: 'poll', title: m.querySelector('#pq').value, options, multi: m.querySelector('#pmulti').checked } }).catch(fail);
    };
  });
  // Kalendářní anketa: kdo má kdy volno
  const datePollModal = () => {
    const picked = new Set(tripCache?.trip.start_date ? ctx.tripDays(tripCache.trip) : []);
    let month = new Date(`${[...picked][0] || new Date().toISOString().slice(0, 10)}T12:00:00`); month.setDate(1);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    ctx.modal(`<h2>Kdy máte volno?</h2><p class="muted" style="margin-top:6px">Označ dny, o kterých se rozhoduje. Každý pak v chatu klikne na dny, kdy může, a hned uvidíte, kdy může nejvíc lidí.</p>
      <form id="df" class="stack-form"><div><label for="dq">Otázka</label><input id="dq" maxlength="200" value="Kdy máte volno na výlet?"></div>
        <div class="mini-cal" id="mcal"></div><p class="small muted" id="dcount"></p>
        <div class="modal-actions"><button type="button" class="btn ghost" data-close>Zrušit</button><button class="btn">Poslat kalendář</button></div></form>`, (m, close) => {
      const cal = m.querySelector('#mcal');
      const draw = () => {
        const first = new Date(month); const start = (first.getDay() + 6) % 7;
        const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
        const today = iso(new Date());
        cal.innerHTML = `<div class="mc-head"><button type="button" class="icon-btn" data-mv="-1" aria-label="Předchozí měsíc">${ms('chevron_left')}</button><b>${first.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}</b><button type="button" class="icon-btn" data-mv="1" aria-label="Další měsíc">${ms('chevron_right')}</button></div>
          <div class="mc-grid">${['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'].map((x) => `<span class="mc-dow">${x}</span>`).join('')}${'<span></span>'.repeat(start)}${Array.from({ length: days }, (_, i) => { const d = iso(new Date(first.getFullYear(), first.getMonth(), i + 1)); return `<button type="button" class="mc-day${picked.has(d) ? ' on' : ''}" data-d="${d}" ${d < today ? 'disabled' : ''}>${i + 1}</button>`; }).join('')}</div>`;
        cal.querySelectorAll('[data-mv]').forEach((b) => { b.onclick = () => { month.setMonth(month.getMonth() + Number(b.dataset.mv)); draw(); }; });
        cal.querySelectorAll('[data-d]').forEach((b) => { b.onclick = () => { if (picked.has(b.dataset.d)) picked.delete(b.dataset.d); else picked.add(b.dataset.d); draw(); }; });
        m.querySelector('#dcount').textContent = picked.size ? `Vybráno ${picked.size} ${picked.size === 1 ? 'den' : picked.size < 5 ? 'dny' : 'dní'}` : 'Vyber aspoň jeden den';
      };
      draw();
      m.querySelector('#df').onsubmit = (ev) => {
        ev.preventDefault();
        if (!picked.size) { ctx.toast('Vyber aspoň jeden den.'); return; }
        close(); send({ data: { type: 'datepoll', title: m.querySelector('#dq').value, dates: [...picked] } }).catch(fail);
      };
    });
  };
  // Dotazník
  const surveyModal = () => ctx.modal(`<h2>Dotazník</h2><p class="muted" style="margin-top:6px">Zeptej se partě na víc věcí najednou, třeba na jídlo, rozpočet nebo co kdo chce vidět.</p>
    <form id="sf" class="stack-form"><div><label for="st">Název</label><input id="st" maxlength="200" value="Než vyrazíme" required></div>
      <div><span class="label">Otázky</span><div class="opt-list" id="qs">${['Kolik chceš max. utratit za ubytování na noc?', 'Máš nějaké omezení v jídle?', 'Co bys chtěl/a určitě vidět nebo zažít?'].map((q) => `<input maxlength="200" value="${q}">`).join('')}</div>
        <button type="button" class="btn ghost sm" id="q-add" style="margin-top:8px">${ms('add', 'sm')} Přidat otázku</button></div>
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Zrušit</button><button class="btn">Poslat dotazník</button></div></form>`, (m, close) => {
    m.querySelector('#q-add').onclick = () => { const qs = m.querySelector('#qs'); if (qs.children.length >= 10) return; qs.insertAdjacentHTML('beforeend', '<input maxlength="200" placeholder="Další otázka">'); qs.lastElementChild.focus(); };
    m.querySelector('#sf').onsubmit = (ev) => {
      ev.preventDefault();
      const questions = [...m.querySelectorAll('#qs input')].map((x) => x.value.trim()).filter(Boolean);
      if (!questions.length) { ctx.toast('Přidej aspoň jednu otázku.'); return; }
      close(); send({ data: { type: 'survey', title: m.querySelector('#st').value, questions } }).catch(fail);
    };
  });
  // Z itineráře: položka nebo celý den
  const itineraryModal = () => {
    const items = (tripCache?.items || []).filter((i) => i.kind !== 'destination');
    const days = tripCache ? ctx.tripDays(tripCache.trip) : [];
    ctx.modal(`<h2>Sdílet z itineráře</h2>
      ${days.length ? `<span class="label" style="margin-top:16px">Program dne</span><div class="chips day-chips">${days.map((d) => `<button class="chip" data-share-day="${d}">${shortDate(d)}</button>`).join('')}</div>` : ''}
      <span class="label" style="margin-top:16px">Položka</span>
      ${items.length ? `<div class="pick-list">${items.map((i) => { const c = ctx.itemCat(i); const w = ctx.itemWhen(i); return `<button class="pick" data-share-item="${i.id}"><span class="cc-ic sm" style="--c:${ctx.CAT_COLOR[c]}">${ms(ctx.ACT_CATS[c].ic, 'sm')}</span><span class="grow"><b class="ellipsis">${e(ctx.itemTitle(i))}</b><small>${w.day ? shortDate(w.day) : 'nápad'}${i.price != null ? ` · ${ctx.czk(i.price)}` : ''}</small></span>${ms('send', 'sm')}</button>`; }).join('')}</div>` : '<p class="small muted">V plánu zatím nic není.</p>'}`, (m, close) => {
      m.querySelectorAll('[data-share-item]').forEach((b) => { b.onclick = () => { const it = items.find((x) => String(x.id) === b.dataset.shareItem); close(); send({ data: { type: 'item', itemId: it.id, title: ctx.itemTitle(it) } }).catch(fail); }; });
      m.querySelectorAll('[data-share-day]').forEach((b) => { b.onclick = () => { close(); send({ data: { type: 'day', day: b.dataset.shareDay, title: shortDate(b.dataset.shareDay) } }).catch(fail); }; });
    });
  };
  box.querySelector('#attach').onclick = () => ctx.modal(`<h2>Přidat do chatu</h2>
    <div class="attach-grid">${[
    ['poll', 'ballot', 'Anketa', 'Hlasování o čemkoliv'],
    ['datepoll', 'event_available', 'Kdy máte volno', 'Kalendářní anketa'],
    ['survey', 'checklist', 'Dotazník', 'Víc otázek najednou'],
    ['place', 'location_on', 'Místo', 'Z plánu nebo z mapy'],
    ['itinerary', 'event_note', 'Z itineráře', 'Položka nebo celý den'],
    ['payments', 'payments', 'Stav plateb', 'Kolik kdo doplácí'],
  ].map(([k, ic, l, s]) => `<button class="attach-tile" data-attach="${k}"><span class="cc-ic">${ms(ic)}</span><b>${l}</b><small>${s}</small></button>`).join('')}</div>`, (m, close) => {
    m.querySelectorAll('[data-attach]').forEach((b) => {
      b.onclick = () => {
        close();
        ({ poll: pollModal, datepoll: datePollModal, survey: surveyModal, place: sharePlace, itinerary: itineraryModal, payments: () => send({ data: { type: 'payments' } }).catch(fail) })[b.dataset.attach]();
      };
    });
  });
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
    <header class="chat-head"><a class="icon-btn back" href="#/chat" aria-label="Zpět">${ms('arrow_back')}</a>${ctx.avatarHtml(friend)}
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
    chatTimer = setTimeout(load, pollDelay());
  };
  await load();
  liveHandler = (d) => { if (d.type === 'dm' && (d.from === id || d.to === id) && document.body.contains(list)) { clearTimeout(chatTimer); load(); } };
  const input = box.querySelector('#msg');
  box.querySelector('#composer').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = input.value.trim(); if (!body) return;
    input.value = '';
    const temp = pendingBubble(list, body);
    try {
      const { message } = await ctx.api(`/chat/${id}`, { method: 'POST', body: { body } });
      temp.remove(); list.querySelector('p.center')?.remove();
      if (!list.querySelector(`[data-id="${message.id}"]`)) list.insertAdjacentHTML('beforeend', render([message]));
      lastId = Math.max(lastId, message.id);
      list.scrollTop = list.scrollHeight;
    } catch (err) { temp.remove(); ctx.toast(err.message); input.value = body; }
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
