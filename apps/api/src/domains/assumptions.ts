import type { FastifyInstance } from "fastify";
import { z } from "zod";

export const AssumptionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  phaseType: z.string(),
  description: z.string(),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  status: z.enum(["active", "validated", "invalidated"]).default("active"),
  provenance: z.string().default("user"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Assumption = z.infer<typeof AssumptionSchema>;

export async function registerAssumptionRoutes(app: FastifyInstance) {
  app.get("/api/v1/projects/:projectId/assumptions", async (_request, reply) => {
    reply
      .status(501)
      .send({ error: { code: "NOT_IMPLEMENTED", message: "Assumptions not yet implemented" } });
  });
}
