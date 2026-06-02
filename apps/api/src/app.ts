import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadConfig } from "./lib/config.js";
import { errorHandler } from "./lib/errors.js";
import { initDb } from "./db/sqlite/index.js";
import { createSqliteSessionStore } from "./lib/repositories/session-repository.js";
import { createSqliteCredentialStore } from "./lib/repositories/credential-repository.js";
import { createSqlitePromptStore } from "./lib/repositories/prompt-repository.js";
import { replaceStore } from "./lib/orchestration/store.js";
import { _replaceCredentialStore } from "./lib/credentials/store.js";
import { replacePromptStore } from "./lib/shared-stores.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerVersionRoutes } from "./routes/version.js";
import { registerObservabilityRoutes } from "./routes/observability.js";
import { registerDiagnosticsRoutes } from "./routes/diagnostics.js";
import { registerUsageRoutes } from "./routes/usage.js";
import { registerCacheRoutes } from "./routes/cache.js";
import { registerProgressRoutes } from "./routes/progress.js";
import { registerDomainRoutes } from "./domains/index.js";

export async function buildApp() {
  const config = loadConfig();

  // Initialize SQLite and wire persistent stores
  await initDb();
  replaceStore(createSqliteSessionStore());
  _replaceCredentialStore(createSqliteCredentialStore());
  replacePromptStore(createSqlitePromptStore());

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === "development" && {
        transport: { target: "pino-pretty", options: { colorize: true } },
      }),
    },
  });

  app.setErrorHandler(errorHandler);

  await app.register(cors, { origin: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] });

  // Detect and repair any interrupted workflow runs from prior session
  try {
    const { detectInterruptedWorkflows, repairIncompleteStep } =
      await import("./lib/repositories/workflow-repository.js");
    const interrupted = detectInterruptedWorkflows();
    if (interrupted.length > 0) {
      app.log.warn(
        { count: interrupted.length },
        "Found interrupted workflow runs from prior session — marking as failed",
      );
      for (const run of interrupted) {
        const steps = ["synthesis", "analysis", "blueprint", "roadmap", "taskGraph", "promptGen"] as const;
        for (const step of steps) {
          repairIncompleteStep(run.id, step);
        }
      }
    }
  } catch (err) {
    app.log.warn({ err }, "Workflow recovery check skipped");
  }

  await registerHealthRoutes(app);
  await registerVersionRoutes(app);
  await registerObservabilityRoutes(app);
  await registerDiagnosticsRoutes(app);
  await registerUsageRoutes(app);
  await registerCacheRoutes(app);
  await registerProgressRoutes(app);
  await registerDomainRoutes(app);

  // Start periodic memory monitoring (every 60s, unref'd so it doesn't keep process alive)
  try {
    const { startMemoryWatch } = await import("./lib/metrics/memory-watch.js");
    const { getStoreSizes } = await import("./lib/shared-stores.js");
    startMemoryWatch(() => getStoreSizes());
  } catch (err) {
    app.log.warn({ err }, "Memory watch not started");
  }

  return app;
}
