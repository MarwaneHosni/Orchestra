import { drizzle } from "drizzle-orm/sql-js";
import { sql } from "drizzle-orm";
import initSqlJs, { type Database } from "sql.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadConfig } from "../../lib/config.js";
import * as schema from "./schema/index.js";

let _db: ReturnType<typeof drizzle> | null = null;
let _sqliteDb: Database | null = null;
let _initialized = false;

export function getDbPath(): string {
  const config = loadConfig();
  return resolve(config.SQLITE_DB_PATH);
}

export function isInitialized(): boolean {
  return _initialized;
}

export async function initDb(): Promise<ReturnType<typeof drizzle>> {
  if (_db) return _db;

  const dbPath = getDbPath();
  const dbDir = dirname(dbPath);

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  const SQL = await initSqlJs();
  let database: Database;

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    database = new SQL.Database(buffer);
    // Quick integrity check on existing database
    try {
      const result = database.exec("PRAGMA integrity_check");
      const integrityResult = result[0]?.values?.[0]?.[0];
      if (integrityResult !== "ok") {
        console.warn(`[DB] Integrity check warning: ${integrityResult}`);
      }
    } catch {
      console.warn("[DB] Could not run integrity check");
    }
  } else {
    database = new SQL.Database();
  }

  _sqliteDb = database;
  _db = drizzle(database, { schema });

  // Enable WAL mode for better concurrent read performance
  database.run("PRAGMA journal_mode=WAL");
  // Enable foreign keys enforcement
  database.run("PRAGMA foreign_keys=ON");
  // Set busy timeout to avoid SQLITE_BUSY errors
  database.run("PRAGMA busy_timeout=5000");

  _initialized = true;
  return _db;
}

export function getDb(): ReturnType<typeof drizzle> {
  if (!_db) throw new Error("SQLite not initialized. Call initDb() first.");
  return _db;
}

export function runTransaction<T>(fn: () => T): T {
  const db = getDb();
  db.run(sql`BEGIN IMMEDIATE`);
  try {
    const result = fn();
    db.run(sql`COMMIT`);
    return result;
  } catch (err) {
    db.run(sql`ROLLBACK`);
    throw err;
  }
}

export function exportDb(): void {
  if (!_sqliteDb) return;
  const dbPath = getDbPath();
  const data = _sqliteDb.export();
  const buffer = Buffer.from(data);
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }
  writeFileSync(dbPath, buffer);
}

export function closeDb(): void {
  if (_sqliteDb) {
    exportDb();
    _sqliteDb.close();
    _sqliteDb = null;
    _db = null;
    _initialized = false;
  }
}
