import { drizzle } from "drizzle-orm/sql-js";
import initSqlJs, { type Database } from "sql.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadConfig } from "../../lib/config.js";
import * as schema from "./schema/index.js";

let _db: ReturnType<typeof drizzle> | null = null;
let _sqliteDb: Database | null = null;

export function getDbPath(): string {
  const config = loadConfig();
  return resolve(config.SQLITE_DB_PATH);
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
  } else {
    database = new SQL.Database();
  }

  _sqliteDb = database;
  _db = drizzle(database, { schema });

  // Enable WAL mode for better concurrent read performance
  database.run("PRAGMA journal_mode=WAL");
  // Enable foreign keys enforcement
  database.run("PRAGMA foreign_keys=ON");

  return _db;
}

export function getDb(): ReturnType<typeof drizzle> {
  if (!_db) throw new Error("SQLite not initialized. Call initDb() first.");
  return _db;
}

export function closeDb(): void {
  if (_sqliteDb) {
    const dbPath = getDbPath();
    const data = _sqliteDb.export();
    const buffer = Buffer.from(data);
    const dbDir = dirname(dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    writeFileSync(dbPath, buffer);
    _sqliteDb.close();
    _sqliteDb = null;
    _db = null;
  }
}
