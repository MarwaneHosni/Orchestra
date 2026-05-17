import { migrate } from "drizzle-orm/sql-js/migrator";
import { initDb, closeDb } from "./sqlite/index.js";

async function main() {
  console.log("Running SQLite migrations...");
  const db = await initDb();
  migrate(db, { migrationsFolder: "./drizzle-sqlite" });
  console.log("Migrations complete.");
  await closeDb();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
