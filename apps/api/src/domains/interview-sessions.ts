import type { FastifyInstance } from "fastify";
import { z } from "zod";

export const InterviewSessionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  status: z.enum(["draft", "in_progress", "complete"]).default("draft"),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type InterviewSession = z.infer<typeof InterviewSessionSchema>;

export async function registerInterviewSessionRoutes(app: FastifyInstance) {
  app.get("/api/v1/projects/:projectId/interviews", async (_request, reply) => {
    reply
      .status(501)
      .send({ error: { code: "NOT_IMPLEMENTED", message: "Interview sessions not yet implemented" } });
  });
}
