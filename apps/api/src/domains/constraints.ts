import type { FastifyInstance } from "fastify";
import { z } from "zod";

export const ConstraintSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  phaseType: z.string(),
  description: z.string(),
  type: z.enum(["technical", "business", "time", "resource", "legal"]).default("technical"),
  severity: z.enum(["critical", "major", "minor"]).default("major"),
  provenance: z.string().default("user"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Constraint = z.infer<typeof ConstraintSchema>;

export async function registerConstraintRoutes(app: FastifyInstance) {
  app.get("/api/v1/projects/:projectId/constraints", async (_request, reply) => {
    reply
      .status(501)
      .send({ error: { code: "NOT_IMPLEMENTED", message: "Constraints not yet implemented" } });
  });
}
