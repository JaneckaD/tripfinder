// Seznam obrysových ikon (Material Symbols), které frontend používá.
// Google Fonts pak pošle jen tyto glyfy (pár kB místo celého fontu).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PATTERNS = [
  /\b(?:ms|icon)\(\s*'([a-z0-9_]+)'/g, // ms('flight'), icon('add', 'sm')
  /class="ms[^"]*">([a-z0-9_]+)</g, // <span class="ms">home</span> v index.html
  /\bic:\s*'([a-z0-9_]+)'/g, // datové mapy: { ic: 'hotel' }
];

export function iconNames(publicDir) {
  const names = new Set();
  for (const f of readdirSync(publicDir)) {
    if (!/\.(js|html)$/.test(f) || f === 'sw.js') continue;
    const src = readFileSync(join(publicDir, f), 'utf8');
    for (const re of PATTERNS) for (const m of src.matchAll(re)) names.add(m[1]);
  }
  return [...names].sort();
}

// index.html s doplněným seznamem ikon
export function indexHtml(publicDir) {
  return readFileSync(join(publicDir, 'index.html'), 'utf8').replace('__ICONS__', iconNames(publicDir).join(','));
}
