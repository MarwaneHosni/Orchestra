import type { FastifyInstance } from "fastify";
import { loadConfig } from "../lib/config.js";

export async function registerVersionRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/status",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              service: { type: "string" },
              version: { type: "string" },
              environment: { type: "string" },
            },
          },
        },
      },
    },
    async () => {
      const config = loadConfig();
      return {
        service: "orchestra-api",
        version: "0.1.0",
        environment: config.NODE_ENV,
      };
    },
  );
}
