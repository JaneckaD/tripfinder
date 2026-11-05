import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { createApp } from '../server/app.js';

let server; let base;
before(async () => {
  server = createApp(await openDb({ path: ':memory:', url: '' })).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());
function client() {
  let cookie = '';
  return async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json() };
  };
}
const register = async (c, name) => (await c('/auth/register', { method: 'POST', body: { name, email: `${name}@p.cz`, password: 'heslo12345' } })).body.user;
// 1×1 px PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('návrhy: každý jeden hlas pro, nebo proti', async () => {
  const a = client(); const b = client();
  await register(a, 'eva'); await register(b, 'petr');
  const { trip } = (await a('/trips', { method: 'POST', body: { title: 'Řím' } })).body;
  await a(`/trips/${trip.id}/members`, { method: 'POST', body: { email: 'petr@p.cz' } });
  let d = (await a(`/trips/${trip.id}/items`, { method: 'POST', body: { kind: 'note', data: { title: 'Koloseum' } } })).body;
  const id = d.items[0].id;
  d = (await a(`/trips/${trip.id}/items/${id}/vote`, { method: 'POST', body: { value: 1 } })).body;
  d = (await b(`/trips/${trip.id}/items/${id}/vote`, { method: 'POST', body: { value: -1 } })).body;
  assert.deepEqual([d.items[0].up, d.items[0].down, d.items[0].myVote], [1, 1, -1]);
  // změna hlasu: pořád jen jeden hlas
  d = (await b(`/trips/${trip.id}/items/${id}/vote`, { method: 'POST', body: { value: 1 } })).body;
  assert.deepEqual([d.items[0].up, d.items[0].down], [2, 0]);
  d = (await b(`/trips/${trip.id}/items/${id}/vote`, { method: 'POST', body: { value: 0 } })).body;
  assert.deepEqual([d.items[0].up, d.items[0].down, d.items[0].myVote], [1, 0, 0]);
});

test('doprava, platby se splatností a nahrané obrázky', async () => {
  const a = client(); const b = client(); const x = client();
  const ua = await register(a, 'jana'); const ub = await register(b, 'ondra'); await register(x, 'nikdo');
  const { trip } = (await a('/trips', { method: 'POST', body: { title: 'Vídeň' } })).body;
  await a(`/trips/${trip.id}/members`, { method: 'POST', body: { email: 'ondra@p.cz' } });
  // nahrání QR kódu
  const up = await a(`/trips/${trip.id}/files`, { method: 'POST', body: { image: PNG } });
  assert.equal(up.status, 201);
  assert.match(up.body.url, /^\/api\/trips\/\d+\/files\/\d+$/);
  assert.equal((await a(`/trips/${trip.id}/files`, { method: 'POST', body: { image: 'data:text/html;base64,PGI+' } })).status, 400);
  const file = await fetch(base + up.body.url.replace('/api', ''));
  assert.equal(file.status, 401);
  // vlastní spoj
  let d = (await a(`/trips/${trip.id}/items`, { method: 'POST', body: { kind: 'transport', data: { mode: 'train', title: 'RJ', price: 1200 } } })).body;
  const id = d.items[0].id;
  d = (await a(`/trips/${trip.id}/items/${id}`, { method: 'PATCH', body: { seats: 'vůz 5, 21–22', booking: 'ABC123', qr: up.body.url, depart: '2027-03-01T07:15', due: '2027-02-01', split: [ua.id, ub.id], qr2: 'x', url: 'javascript:alert(1)' } })).body;
  const it = d.items[0];
  assert.equal(it.data.qr, up.body.url);
  assert.equal(it.data.booking, 'ABC123');
  assert.equal(it.data.due, '2027-02-01');
  assert.deepEqual(it.data.split, [ua.id, ub.id]);
  assert.equal(it.data.url, null);
  assert.equal(it.data.qr2, undefined);
  // platby: každý odškrtne svůj podíl, za ostatní jen organizátor
  d = (await b(`/trips/${trip.id}/items/${id}/paid`, { method: 'POST', body: { paid: true } })).body;
  assert.ok(d.items[0].data.paid[ub.id]);
  assert.equal((await b(`/trips/${trip.id}/items/${id}/paid`, { method: 'POST', body: { userId: ua.id, paid: true } })).status, 403);
  d = (await a(`/trips/${trip.id}/items/${id}/paid`, { method: 'POST', body: { userId: ub.id, paid: false } })).body;
  assert.equal(d.items[0].data.paid[ub.id], undefined);
  // náhledový obrázek výletu
  await a(`/trips/${trip.id}`, { method: 'PATCH', body: { cover: up.body.url } });
  const list = (await a('/trips')).body.trips;
  assert.equal(list.find((t) => t.id === trip.id).cover_image, up.body.url);
  assert.equal((await x(`/trips/${trip.id}/files`, { method: 'POST', body: { image: PNG } })).status, 404);
});

test('profilová fotka', async () => {
  const a = client();
  const u = await register(a, 'lucie');
  assert.equal((await a('/me/avatar', { method: 'PUT', body: { image: 'nic' } })).status, 400);
  const { avatar_v } = (await a('/me/avatar', { method: 'PUT', body: { image: PNG } })).body;
  assert.equal(avatar_v, 1);
  assert.equal((await a('/auth/me')).body.user.avatar_v, 1);
  await a('/me/avatar', { method: 'DELETE' });
  assert.equal((await a('/auth/me')).body.user.avatar_v, 0);
  assert.ok(u.id);
});

test('chat výletu: anketa, kalendářní anketa, dotazník a sdílení z plánu', async () => {
  const a = client(); const b = client(); const x = client();
  await register(a, 'mira'); await register(b, 'zuzka'); await register(x, 'mimo');
  const { trip } = (await a('/trips', { method: 'POST', body: { title: 'Krkonoše' } })).body;
  await a(`/trips/${trip.id}/members`, { method: 'POST', body: { email: 'zuzka@p.cz' } });
  const post = (c, data) => c(`/trips/${trip.id}/chat`, { method: 'POST', body: { data } });
  assert.equal((await post(a, { type: 'poll', title: 'Kam?', options: ['Jen jedna'] })).status, 400);
  const poll = (await post(a, { type: 'poll', title: 'Kam na večeři?', options: ['Pizza', 'Burger', ''] })).body.message;
  assert.deepEqual(poll.data.options, ['Pizza', 'Burger']);
  let r = (await b(`/trips/${trip.id}/chat/${poll.id}/answer`, { method: 'POST', body: { value: [1, 0] } })).body;
  assert.deepEqual(r.answers[poll.id][0].value, [0]); // jedna odpověď, když není multi
  const dp = (await post(a, { type: 'datepoll', title: 'Kdy?', dates: ['2027-01-10', '2027-01-09', 'nesmysl'] })).body.message;
  assert.deepEqual(dp.data.dates, ['2027-01-09', '2027-01-10']);
  await a(`/trips/${trip.id}/chat/${dp.id}/answer`, { method: 'POST', body: { value: [0, 1, 7] } });
  const sv = (await post(b, { type: 'survey', title: 'Jídlo', questions: ['Alergie?', 'Rozpočet?'] })).body.message;
  await a(`/trips/${trip.id}/chat/${sv.id}/answer`, { method: 'POST', body: { value: ['ořechy', ''] } });
  const chat = (await b(`/trips/${trip.id}/chat`)).body;
  assert.deepEqual(chat.answers[dp.id][0].value, [0, 1]);
  assert.deepEqual(chat.answers[sv.id][0].value, ['ořechy', '']);
  // uzavřít může jen autor nebo organizátor
  assert.equal((await b(`/trips/${trip.id}/chat/${poll.id}/close`, { method: 'POST' })).status, 403);
  assert.equal((await a(`/trips/${trip.id}/chat/${poll.id}/close`, { method: 'POST' })).body.message.data.closed, true);
  assert.equal((await b(`/trips/${trip.id}/chat/${poll.id}/answer`, { method: 'POST', body: { value: [1] } })).status, 400);
  // sdílení položky z plánu a stavu plateb
  const d = (await a(`/trips/${trip.id}/items`, { method: 'POST', body: { kind: 'note', data: { title: 'Sněžka', category: 'nature' } } })).body;
  assert.equal((await post(a, { type: 'item', itemId: 99999 })).status, 400);
  assert.equal((await post(a, { type: 'item', itemId: d.items[0].id, title: 'Sněžka' })).status, 201);
  assert.equal((await post(a, { type: 'payments' })).status, 201);
  assert.match((await b('/conversations')).body.trips[0].lastMessage.body, /plateb/);
  assert.equal((await x(`/trips/${trip.id}/chat/${poll.id}/answer`, { method: 'POST', body: { value: [0] } })).status, 404);
  // cena za osobu
  const it = (await a(`/trips/${trip.id}/items/${d.items[0].id}`, { method: 'PATCH', body: { cost: 600, priceMode: 'person', unitCost: 300, category: 'nature' } })).body.items[0];
  assert.deepEqual([it.price, it.data.priceMode, it.data.unitCost, it.data.category], [600, 'person', 300, 'nature']);
});
