import type { FastifyInstance } from "fastify";
import { z } from "zod";

export const GenerationSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  type: z.enum(["blueprint", "roadmap", "task_graph", "prompt"]),
  provider: z.string(),
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  status: z.enum(["pending", "streaming", "complete", "failed"]),
  createdAt: z.string().datetime(),
});

export type Generation = z.infer<typeof GenerationSchema>;

export async function registerGenerationRoutes(app: FastifyInstance) {
  app.get("/api/v1/projects/:projectId/generations", async (_request, reply) => {
    reply
      .status(501)
      .send({ error: { code: "NOT_IMPLEMENTED", message: "Generations not yet implemented" } });
  });
}
