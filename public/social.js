// Profil cestovatele (úvodní dotazník + úpravy), přátelé, pozvánky a chat.
import { autocomplete } from './widgets.js';

let ctx; // { api, esc, toast, state, $app, initials, requireLogin, emptyState, route }
export function setupSocial(c) { ctx = c; }

const flag = (cc) => (cc && cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map((ch) => 0x1f1a5 + ch.charCodeAt(0))) : '🏳️');
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
    if (p.passports.includes(cc)) out.push(`🛂 Cestuješ do své země (${flag(cc)}), stačí doklad.`);
    else if (inEU && EU.has(cc)) out.push('🛂 Schengen / EU: bez víza, stačí občanský průkaz.');
    else out.push(`🛂 Pas ${p.passports.map(flag).join(' ')}: ověř si vízum na <a href="https://www.mzv.gov.cz/jnp/cz/cestujeme/" target="_blank" rel="noopener">mzv.gov.cz – Cestujeme</a>.`);
  }
  if (langCodes.length && p.languages.length) {
    const common = langCodes.filter((l) => p.languages.includes(l));
    if (common.length) out.push(`🗣️ Domluvíš se místním jazykem: ${common.map(langName).join(', ')}.`);
    else if (p.languages.includes('en')) out.push(`🗣️ Místně se mluví ${langCodes.slice(0, 2).map(langName).join(', ')} – v turistických místech s angličtinou nebude problém.`);
    else out.push(`🗣️ Místní jazyk: ${langCodes.slice(0, 2).map(langName).join(', ')}. Hodí se offline překladač.`);
  }
  const d = ageDiscount(p);
  if (d) out.push(`🎟️ ${d.label}.`);
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
    ageOut.innerHTML = d ? `<span class="pill mint">🎟️ ${ctx.esc(d.label)}</span>` : '';
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
      <h1 style="margin-top:12px">Ahoj ${ctx.esc(ctx.state.user.name)} 👋</h1>
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
    try { await saveProfile({ ...read(), onboarded: true }); ctx.toast('Profil uložen ✓'); done(); } catch (err) { document.getElementById('err').textContent = err.message; }
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
      ctx.renderAccount(); ctx.toast('Profil uložen ✓');
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
    if (total > (refreshBadge.last ?? total) && !location.hash.startsWith('#/chat')) ctx.toast(n.requests > (refreshBadge.req ?? 0) ? '👋 Nová žádost o přátelství' : '💬 Nová zpráva');
    refreshBadge.last = total; refreshBadge.req = n.requests;
  } catch { /* offline */ }
  pollTimer = setTimeout(refreshBadge, document.hidden ? 120000 : 25000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx?.state.user) refreshBadge(); });

// ---------- Přátelé a chat ----------
const timeLabel = (iso) => {
  if (!iso) return '';
  const d = new Date(iso); const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
};
let chatTimer;

export async function viewChat(friendId) {
  clearTimeout(chatTimer);
  if (!ctx.requireLogin()) return;
  const e = ctx.esc;
  const data = await ctx.api('/friends');
  const active = friendId ? Number(friendId) : null;
  const friendRow = (f) => `<a class="friend-row${f.id === active ? ' active' : ''}" href="#/chat/${f.id}">
      <span class="avatar ${['', 'sky', 'gold', 'lav'][f.id % 4]}">${e(ctx.initials(f.name))}</span>
      <span class="grow"><b>${e(f.name)}</b><span class="small muted ellipsis">${f.lastMessage ? e(f.lastMessage.body) : 'Napiš první zprávu 👋'}</span></span>
      <span class="meta">${f.lastMessage ? `<span class="small muted">${timeLabel(f.lastMessage.at)}</span>` : ''}${f.unread ? `<span class="count">${f.unread}</span>` : ''}</span></a>`;
  ctx.$app.innerHTML = `
    <div class="chat-page${active ? ' has-active' : ''}">
      <aside class="glass-card chat-side">
        <div class="section-head"><h2>Přátelé</h2><button class="btn sm" id="add-friend">+ Přidat</button></div>
        ${data.incoming.length ? `<div class="requests"><div class="small muted label">Žádosti o přátelství</div>${data.incoming.map((r) => `
          <div class="req-row"><span class="avatar gold">${e(ctx.initials(r.name))}</span><span class="grow"><b>${e(r.name)}</b><span class="small muted">${e(r.email)}</span></span>
            <button class="btn sm" data-accept="${r.id}">Přijmout</button><button class="btn ghost sm" data-decline="${r.id}" aria-label="Odmítnout">✕</button></div>`).join('')}</div>` : ''}
        <div class="friend-list">${data.friends.map(friendRow).join('') || '<p class="muted small" style="padding:12px 4px">Zatím tu nikoho nemáš. Přidej kamaráda podle e-mailu nebo mu pošli pozvánku.</p>'}</div>
        ${data.outgoing.length ? `<div class="small muted label" style="margin-top:12px">Čeká na přijetí</div>${data.outgoing.map((o) => `<div class="req-row muted"><span class="avatar">${e(ctx.initials(o.name))}</span><span class="grow">${e(o.name)}</span><button class="btn ghost sm" data-decline="${o.id}">Zrušit</button></div>`).join('')}` : ''}
      </aside>
      <section class="glass-card chat-main" id="chat-main">${active ? '' : `<div class="empty"><div class="big">💬</div><p>Vyber kamaráda a napiš mu, kam pojedete.</p></div>`}</section>
    </div>`;
  ctx.$app.querySelector('#add-friend').onclick = addFriendModal;
  ctx.$app.querySelectorAll('[data-accept]').forEach((b) => { b.onclick = async () => { await ctx.api(`/friends/${b.dataset.accept}/accept`, { method: 'POST' }); ctx.toast('Teď jste přátelé 🎉'); location.hash = `#/chat/${b.dataset.accept}`; refreshBadge(); }; });
  ctx.$app.querySelectorAll('[data-decline]').forEach((b) => { b.onclick = async () => { await ctx.api(`/friends/${b.dataset.decline}`, { method: 'DELETE' }); refreshBadge(); viewChat(friendId); }; });
  if (active) await mountConversation(document.getElementById('chat-main'), active, data.friends.find((f) => f.id === active));
}

async function mountConversation(box, id, friend) {
  const e = ctx.esc;
  if (!friend) { box.innerHTML = '<div class="empty"><div class="big">🔒</div><p>Psát si můžeš jen s přáteli.</p></div>'; return; }
  box.innerHTML = `
    <header class="chat-head"><a class="btn ghost sm back" href="#/chat" aria-label="Zpět">‹</a><span class="avatar ${['', 'sky', 'gold', 'lav'][id % 4]}">${e(ctx.initials(friend.name))}</span><b class="grow">${e(friend.name)}</b>
      <button class="btn ghost sm" id="unfriend" title="Odebrat z přátel">Odebrat</button></header>
    <div class="msgs" id="msgs"><div class="skeleton" style="height:60px"></div></div>
    <form class="composer" id="composer"><input id="msg" placeholder="Napiš zprávu…" autocomplete="off" maxlength="2000"><button class="btn" aria-label="Odeslat">➤</button></form>`;
  const list = box.querySelector('#msgs');
  let lastId = 0; let first = true;
  const bubble = (m) => `<div class="msg${m.mine ? ' mine' : ''}" data-id="${m.id}"><span>${e(m.body).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')}</span><time>${timeLabel(m.at)}</time></div>`;
  const load = async () => {
    if (!document.body.contains(list)) return;
    try {
      const r = await ctx.api(`/chat/${id}?after=${lastId}`);
      if (first) { list.innerHTML = r.messages.length ? '' : '<p class="muted small center">Zatím žádné zprávy. Pozdrav! 👋</p>'; first = false; }
      if (r.messages.length) {
        list.querySelector('p.center')?.remove();
        const stick = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
        list.insertAdjacentHTML('beforeend', r.messages.filter((m) => !list.querySelector(`[data-id="${m.id}"]`)).map(bubble).join(''));
        lastId = r.messages.at(-1).id;
        if (stick || lastId) list.scrollTop = list.scrollHeight;
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
      list.insertAdjacentHTML('beforeend', bubble(message)); lastId = Math.max(lastId, message.id);
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
    <button class="btn sky" id="af-link" style="margin-top:8px">🔗 Vytvořit pozvánku</button>
    <div id="af-out"></div>`, (m, close) => {
    m.querySelector('#af').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        const r = await ctx.api('/friends', { method: 'POST', body: { email: m.querySelector('#af-email').value } });
        ctx.toast(r.status === 'accepted' ? `Teď jste s ${r.user.name} přátelé 🎉` : `Žádost odeslána – čeká na ${r.user.name}`);
        close(); viewChat();
      } catch (err) { m.querySelector('#af-err').textContent = err.message; }
    });
    m.querySelector('#af-link').onclick = async () => {
      const { token } = await ctx.api('/friends/invite-link', { method: 'POST' });
      const url = `${location.origin}/#/invite/${token}`;
      m.querySelector('#af-out').innerHTML = `<div class="copy-row"><input readonly value="${ctx.esc(url)}"><button class="btn sm" id="af-copy">Sdílet</button></div>`;
      m.querySelector('#af-copy').onclick = () => ctx.shareLink('Pojď se mnou plánovat výlety v TripFinderu', url);
    };
  });
}

export async function viewInvite(token) {
  const e = ctx.esc;
  let inv;
  try { inv = await ctx.api(`/friends/invite/${token}`); } catch (err) { ctx.$app.innerHTML = ctx.emptyState('🔗', err.message, '<a class="btn" href="#/">Domů</a>'); return; }
  const name = inv.inviter.name;
  ctx.$app.innerHTML = `<div class="glass-card auth center">
      <div class="big-emoji">🤝</div>
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
    ctx.toast(`Teď jste s ${name} přátelé 🎉`);
    location.hash = `#/chat/${r.friendId}`;
  };
}
