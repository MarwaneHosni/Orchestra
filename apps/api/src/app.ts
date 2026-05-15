import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadConfig } from "./lib/config.js";
import { errorHandler } from "./lib/errors.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerVersionRoutes } from "./routes/version.js";
import { registerDomainRoutes } from "./domains/index.js";

export async function buildApp() {
  const config = loadConfig();

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
  await registerDomainRoutes(app);

  return app;
}
