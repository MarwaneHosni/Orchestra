import type { FastifyInstance } from "fastify";
import { z } from "zod";

export const QuestionSchema = z.object({
  id: z.string().uuid(),
  phaseType: z.string(),
  order: z.number().int().positive(),
  text: z.string(),
  type: z.enum(["text", "select", "multi_select", "boolean"]),
  options: z.array(z.string()).optional(),
});

export type Question = z.infer<typeof QuestionSchema>;

export async function registerQuestionRoutes(app: FastifyInstance) {
  app.get("/api/v1/questions", async (_request, reply) => {
    reply.status(501).send({ error: { code: "NOT_IMPLEMENTED", message: "Questions not yet implemented" } });
  });
}
