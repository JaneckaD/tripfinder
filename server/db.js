// Databáze: vestavěné SQLite v Node.js (node:sqlite), žádná externí služba není potřeba.
// Soubor databáze se nastavuje proměnnou DB_PATH (výchozí ./data/tripfinder.db, ":memory:" pro testy).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDb(path = process.env.DB_PATH || './data/tripfinder.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

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

    -- Položky výletu: destinace, doprava, ubytování (data nabídky uložená jako JSON snapshot).
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
  `);
  return db;
}
