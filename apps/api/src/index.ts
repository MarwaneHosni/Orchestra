import { buildApp } from "./app.js";
import { loadConfig } from "./lib/config.js";

async function main() {
  const config = loadConfig();
  const app = await buildApp();

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`API server listening on http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    app.log.error(err, "Failed to start server");
    process.exit(1);
  }
}

main();
