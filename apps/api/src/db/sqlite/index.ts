import { drizzle } from "drizzle-orm/sql-js";
import { sql } from "drizzle-orm";
import initSqlJs, { type Database } from "sql.js";
import {
  readFileSync, writeFileSync, existsSync, mkdirSync,
  openSync, writeSync, closeSync, fsyncSync, renameSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { loadConfig } from "../../lib/config.js";
import { createModuleLogger } from "../../lib/logging/logger.js";

const log = createModuleLogger("db");
import * as schema from "./schema/index.js";

let _db: ReturnType<typeof drizzle> | null = null;
let _sqliteDb: Database | null = null;
let _initialized = false;

// ── Durable snapshot persistence ───────────────────────────────────
// Persistence model:
// - sql.js is the authoritative in-memory database.
// - Durable storage is a snapshot written via _sqliteDb.export().
// - Mutating use-cases must call await queueSyncDb() before reporting success.
// - Repository methods do not perform persistence.
// - The shutdown handler is a safety net, not the primary sync mechanism.
//
// The save queue serializes concurrent sync requests and survives a
// failed export so that subsequent writes are not silently dropped.
// Atomic file replacement (temp file + fsync + rename) prevents
// corruption if the process crashes mid-write.
// ────────────────────────────────────────────────────────────────────

let _saveQueue = Promise.resolve();

export function queueSyncDb(): Promise<void> {
  _saveQueue = _saveQueue
    .catch(() => {})
    .then(() => atomicExport())
    .catch((err) => {
      log.warn({ err: err instanceof Error ? err.message : err }, "queue_sync_db_failed");
    });
  return _saveQueue;
}

function atomicExport(): void {
  if (!_sqliteDb) return;
  const dbPath = getDbPath();
  const tmpPath = dbPath + ".tmp";
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const buffer = Buffer.from(_sqliteDb.export());

  // Write to temp file with full fsync chain
  const fd = openSync(tmpPath, "w");
  writeSync(fd, buffer);
  fsyncSync(fd);
  closeSync(fd);

  // Atomic replacement — fall back to direct write if rename fails (Windows lock)
  try {
    renameSync(tmpPath, dbPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EPERM" || code === "EBUSY") {
      writeFileSync(dbPath, buffer);
    } else {
      throw err;
    }
  }
}

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
        log.warn({ integrityResult }, "integrity_check_warning");
      }
    } catch {
      log.warn({}, "integrity_check_failed");
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

  // Auto-create tables if they don't exist
  const { createTables } = await import("./bootstrap.js");
  createTables();

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

export function getSqliteDb(): Database {
  if (!_sqliteDb) throw new Error("SQLite not initialized");
  return _sqliteDb;
}

export function rawRun(sql: string, ...params: unknown[]): void {
  getSqliteDb().run(sql, params as any);
}

export function rawGet<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
  const stmt = getSqliteDb().prepare(sql);
  if (params.length > 0) stmt.bind(params as any);
  if (stmt.step()) {
    const obj = stmt.getAsObject();
    stmt.free();
    return obj as T;
  }
  stmt.free();
  return undefined;
}

export function rawAll<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
  const stmt = getSqliteDb().prepare(sql);
  stmt.bind(params as any);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export function exportDb(): void {
  atomicExport();
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
