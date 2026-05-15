import type { FastifyInstance } from "fastify";
import { z } from "zod";

export const PhaseType = [
  "ideation",
  "requirements",
  "architecture",
  "security",
  "database",
  "backend",
  "frontend",
  "core-features",
  "ai-systems",
  "testing",
  "deployment",
  "monitoring",
] as const;

export const PhaseSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  type: z.enum(PhaseType),
  order: z.number().int().positive(),
  title: z.string(),
  status: z.enum(["pending", "in_progress", "complete"]).default("pending"),
});

export type Phase = z.infer<typeof PhaseSchema>;

export async function registerPhaseRoutes(app: FastifyInstance) {
  app.get("/api/v1/plans/:planId/phases", async (_request, reply) => {
    reply.status(501).send({ error: { code: "NOT_IMPLEMENTED", message: "Phases not yet implemented" } });
  });
}
