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
  await registerDomainRoutes(app);

  return app;
}
