import type { FastifyInstance } from "fastify";
import { z } from "zod";

export const RiskSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  phaseType: z.string(),
  description: z.string(),
  likelihood: z.enum(["low", "medium", "high"]).default("medium"),
  impact: z.enum(["low", "medium", "high"]).default("medium"),
  mitigation: z.string().optional(),
  status: z.enum(["identified", "mitigated", "accepted", "realized"]).default("identified"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Risk = z.infer<typeof RiskSchema>;

export async function registerRiskRoutes(app: FastifyInstance) {
  app.get("/api/v1/projects/:projectId/risks", async (_request, reply) => {
    reply.status(501).send({ error: { code: "NOT_IMPLEMENTED", message: "Risks not yet implemented" } });
  });
}
