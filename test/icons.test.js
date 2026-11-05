import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { iconNames, indexHtml } from '../server/icons.js';

const PUBLIC = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'public');

test('seznam ikon je seřazený a obsahuje ikony z JS i z index.html', () => {
  const names = iconNames(PUBLIC);
  assert.deepEqual(names, [...names].sort());
  for (const n of ['home', 'add', 'thumb_up', 'chat_bubble', 'sunny']) assert.ok(names.includes(n), n);
  assert.ok(names.every((n) => /^[a-z0-9_]+$/.test(n)));
});

test('index.html dostane doplněný seznam ikon', () => {
  const html = indexHtml(PUBLIC);
  assert.ok(!html.includes('__ICONS__'));
  assert.match(html, /icon_names=[a-z0-9_,]+&/);
});
