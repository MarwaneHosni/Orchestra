import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: { status: { type: "string" } },
        },
      },
    },
  }, async () => {
    return { status: "ok" };
  });

  app.get("/ready", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "string" },
            database: { type: "string" },
          },
        },
      },
    },
  }, async () => {
    return { status: "ok", database: "disconnected" };
  });
}
