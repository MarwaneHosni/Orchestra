import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb, closeDb } from "./index.js";
import { loadConfig } from "../lib/config.js";

async function main() {
  const config = loadConfig();

  if (!config.DATABASE_URL) {
    console.error("DATABASE_URL is required to run migrations");
    process.exit(1);
  }

  console.log("Running migrations...");
  const db = getDb();
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete");
  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
