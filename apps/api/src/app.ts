import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadConfig } from "./lib/config.js";
import { errorHandler } from "./lib/errors.js";
import { initDb } from "./db/sqlite/index.js";
import { createSqliteSessionStore } from "./lib/repositories/session-repository.js";
import { createSqliteCredentialStore } from "./lib/repositories/credential-repository.js";
import { replaceStore } from "./lib/orchestration/store.js";
import { _replaceCredentialStore } from "./lib/credentials/store.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerVersionRoutes } from "./routes/version.js";
import { registerObservabilityRoutes } from "./routes/observability.js";
import { registerDomainRoutes } from "./domains/index.js";

export async function buildApp() {
  const config = loadConfig();

  // Initialize SQLite and wire persistent stores
  await initDb();
  replaceStore(createSqliteSessionStore());
  _replaceCredentialStore(createSqliteCredentialStore());

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === "development" && {
        transport: { target: "pino-pretty", options: { colorize: true } },
      }),
    },
  });

  app.setErrorHandler(errorHandler);

  await app.register(cors, { origin: true });

  await registerHealthRoutes(app);
  await registerVersionRoutes(app);
  await registerObservabilityRoutes(app);
  await registerDomainRoutes(app);

  return app;
}
