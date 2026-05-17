import { buildApp } from "./app.js";
import { loadConfig } from "./lib/config.js";
import { closeDb } from "./db/sqlite/index.js";

async function main() {
  const config = loadConfig();
  const app = await buildApp();

  const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT", "SIGBREAK"];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down...`);
      await app.close();
      closeDb();
      process.exit(0);
    });
  }

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`API server listening on http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    app.log.error(err, "Failed to start server");
    process.exit(1);
  }
}

main();
