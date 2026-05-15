import type { FastifyInstance } from "fastify";
import { z } from "zod";

export const BlueprintSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  projectId: z.string().uuid(),
  content: z.string(),
  format: z.enum(["json", "yaml", "markdown"]).default("markdown"),
  version: z.number().int().positive().default(1),
  status: z.enum(["generating", "complete", "failed"]).default("generating"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Blueprint = z.infer<typeof BlueprintSchema>;

export async function registerBlueprintRoutes(app: FastifyInstance) {
  app.get("/api/v1/plans/:planId/blueprints", async (_request, reply) => {
    reply.status(501).send({ error: { code: "NOT_IMPLEMENTED", message: "Blueprints not yet implemented" } });
  });
}
