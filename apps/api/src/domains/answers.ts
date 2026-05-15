import type { FastifyInstance } from "fastify";
import { z } from "zod";

export const AnswerSchema = z.object({
  id: z.string().uuid(),
  questionId: z.string().uuid(),
  projectId: z.string().uuid(),
  value: z.string(),
  createdAt: z.string().datetime(),
});

export type Answer = z.infer<typeof AnswerSchema>;

export async function registerAnswerRoutes(app: FastifyInstance) {
  app.post("/api/v1/projects/:projectId/answers", async (_request, reply) => {
    reply.status(501).send({ error: { code: "NOT_IMPLEMENTED", message: "Answers not yet implemented" } });
  });
}
