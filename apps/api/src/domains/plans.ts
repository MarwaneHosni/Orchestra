import type { FastifyInstance } from "fastify";
import { z } from "zod";

export const PlanSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  version: z.number().int().positive().default(1),
  status: z.enum(["generating", "complete", "failed"]).default("generating"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Plan = z.infer<typeof PlanSchema>;

export async function registerPlanRoutes(app: FastifyInstance) {
  app.get("/api/v1/projects/:projectId/plans", async (_request, reply) => {
    reply.status(501).send({ error: { code: "NOT_IMPLEMENTED", message: "Plans not yet implemented" } });
  });
}
