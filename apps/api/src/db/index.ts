import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";
import { loadConfig } from "../lib/config.js";

let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

export function getPool() {
  if (_pool) return _pool;
  const config = loadConfig();
  if (!config.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  _pool = new Pool({ connectionString: config.DATABASE_URL, max: 10 });
  return _pool;
}

export function getDb() {
  if (_db) return _db;
  const pool = getPool();
  _db = drizzle(pool, { schema });
  return _db;
}

export async function closeDb() {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}
