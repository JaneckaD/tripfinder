// Databáze přes libSQL (SQLite):
//   - lokálně soubor ./data/tripfinder.db (nebo DB_PATH, ":memory:" pro testy),
//   - na hostingu cloudová databáze Turso, když jsou nastavené TURSO_DATABASE_URL a TURSO_AUTH_TOKEN.
// Všechny dotazy jsou asynchronní: db.get / db.all / db.run / db.batch.
import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PROFILE_MIGRATIONS, SOCIAL_SCHEMA } from './social.js';
import { PLANNER_MIGRATIONS, PLANNER_SCHEMA } from './planner.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS trips (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    note        TEXT NOT NULL DEFAULT '',
    start_date  TEXT,
    end_date    TEXT,
    persons     INTEGER NOT NULL DEFAULT 2,
    share_token TEXT UNIQUE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Položky výletu: destinace, doprava, ubytování, poznámka (data nabídky jako JSON snapshot).
  CREATE TABLE IF NOT EXISTS trip_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL CHECK (kind IN ('destination','transport','lodging','note')),
    data       TEXT NOT NULL,
    price      REAL,
    currency   TEXT,
    added_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Spolucestující. user_id je NULL, dokud se pozvaný e-mail nezaregistruje.
  CREATE TABLE IF NOT EXISTS trip_members (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id  INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email    TEXT NOT NULL COLLATE NOCASE,
    role     TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('editor','viewer')),
    UNIQUE (trip_id, email)
  );
  -- Mezipaměť odpovědí externích API (šetří limity bezplatných tarifů).
  CREATE TABLE IF NOT EXISTS api_cache (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  -- Počet volání externích API za měsíc (hlídání limitu, např. SerpApi 250/měsíc).
  CREATE TABLE IF NOT EXISTS api_usage (
    provider TEXT NOT NULL,
    month    TEXT NOT NULL,
    count    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (provider, month)
  );
`;

const toObjects = (rs) => rs.rows.map((row) => Object.fromEntries(rs.columns.map((c, i) => [c, row[i]])));

export async function openDb({
  path = process.env.DB_PATH || './data/tripfinder.db',
  url = process.env.TURSO_DATABASE_URL,
  authToken = process.env.TURSO_AUTH_TOKEN,
} = {}) {
  let client;
  if (url) {
    client = createClient({ url, authToken });
  } else if (path === ':memory:') {
    client = createClient({ url: ':memory:' });
  } else {
    mkdirSync(dirname(path), { recursive: true });
    client = createClient({ url: `file:${path}` });
  }
  await client.executeMultiple(SCHEMA);
  await client.executeMultiple(SOCIAL_SCHEMA);
  await client.executeMultiple(PLANNER_SCHEMA);
  // Migrace: sloupce přidané později (ALTER selže, když už existují – to je v pořádku).
  for (const sql of ['ALTER TABLE trips ADD COLUMN budget REAL', "ALTER TABLE trips ADD COLUMN status TEXT NOT NULL DEFAULT 'planned'", 'ALTER TABLE trips ADD COLUMN completed_at TEXT', ...PROFILE_MIGRATIONS, ...PLANNER_MIGRATIONS]) {
    try { await client.execute(sql); } catch { /* sloupec už existuje */ }
  }

  const exec = (sql, args) => client.execute({ sql, args });
  return {
    remote: Boolean(url),
    async get(sql, ...args) { return toObjects(await exec(sql, args))[0] || null; },
    async all(sql, ...args) { return toObjects(await exec(sql, args)); },
    async run(sql, ...args) {
      const rs = await exec(sql, args);
      return { changes: rs.rowsAffected, lastInsertRowid: rs.lastInsertRowid == null ? null : Number(rs.lastInsertRowid) };
    },
    // Více zápisů najednou v jedné transakci: [[sql, ...args], ...]
    async batch(statements) {
      await client.batch(statements.map(([sql, ...args]) => ({ sql, args })), 'write');
    },
    close: () => client.close(),
  };
}
