import type { FastifyInstance } from "fastify";
import { getPool } from "../db/index.js";
import { loadConfig } from "../lib/config.js";

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
    const cfg = loadConfig();
    if (!cfg.DATABASE_URL) {
      return { status: "ok", database: "not_configured" };
    }
    try {
      const pool = getPool();
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      return { status: "ok", database: "connected" };
    } catch {
      return { status: "ok", database: "disconnected" };
    }
  });
}
