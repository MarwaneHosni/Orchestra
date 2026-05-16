import type { FastifyInstance } from "fastify";
import { getMetrics } from "../lib/metrics/index.js";

export async function registerObservabilityRoutes(app: FastifyInstance) {
  app.get("/api/v1/metrics", async (_request, reply) => {
    const metrics = getMetrics();
    reply.header("Content-Type", "text/plain; charset=utf-8");
    return metrics.renderPrometheus();
  });
}
