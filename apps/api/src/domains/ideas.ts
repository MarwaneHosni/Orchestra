import type { FastifyInstance } from "fastify";
import { z } from "zod";

export const IdeaSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  rawDescription: z.string().min(1),
  refinedDescription: z.string().optional(),
  status: z.enum(["raw", "refining", "refined"]).default("raw"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Idea = z.infer<typeof IdeaSchema>;

export async function registerIdeaRoutes(app: FastifyInstance) {
  app.get("/api/v1/projects/:projectId/ideas", async (_request, reply) => {
    reply.status(501).send({ error: { code: "NOT_IMPLEMENTED", message: "Ideas not yet implemented" } });
  });
}
