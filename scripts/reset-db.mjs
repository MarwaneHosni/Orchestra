#!/usr/bin/env node

import { execSync } from "child_process";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");

function run(description, command) {
  console.log(`\n▶ ${description}`);
  execSync(command, { cwd: ROOT, stdio: "inherit", shell: true });
}

// ---------------------------------------------------------------------------
// 1. Drop and recreate the database
// ---------------------------------------------------------------------------
console.log("\n⚠  This will DROP the local orchestra database and recreate it.\n");

const DB_NAME = process.env.POSTGRES_DB || "orchestra";
const DB_USER = process.env.POSTGRES_USER || "orchestra";

// Connect to the maintenance "postgres" database so we can safely drop the
// target database (you cannot drop the database you are currently connected to).
run(
  "Drop existing database",
  `docker compose exec -T postgres psql -U ${DB_USER} -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME}"`
);

run(
  "Create fresh database",
  `docker compose exec -T postgres psql -U ${DB_USER} -d postgres -c "CREATE DATABASE ${DB_NAME}"`
);

console.log(`\n✓ Database "${DB_NAME}" has been reset.`);
