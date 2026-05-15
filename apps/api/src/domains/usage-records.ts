import type { FastifyInstance } from "fastify";
import { z } from "zod";

export const UsageRecordSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  sessionId: z.string().uuid().optional().nullable(),
  taskType: z.string(),
  provider: z.string(),
  model: z.string(),
  estimatedPromptTokens: z.number().int().nonnegative(),
  estimatedCompletionTokens: z.number().int().nonnegative(),
  estimatedCost: z.number().nonnegative(),
  actualPromptTokens: z.number().int().nonnegative().optional().nullable(),
  actualCompletionTokens: z.number().int().nonnegative().optional().nullable(),
  actualTotalTokens: z.number().int().nonnegative().optional().nullable(),
  actualCost: z.number().nonnegative().optional().nullable(),
  status: z.enum(["estimated", "completed", "failed"]),
  createdAt: z.string().datetime(),
});

export type UsageRecord = z.infer<typeof UsageRecordSchema>;

export async function registerUsageRecordRoutes(app: FastifyInstance) {
  app.get("/api/v1/projects/:projectId/usage", async (_request, reply) => {
    reply
      .status(501)
      .send({ error: { code: "NOT_IMPLEMENTED", message: "Usage records not yet implemented" } });
  });

  app.get("/api/v1/users/:userId/usage", async (_request, reply) => {
    reply
      .status(501)
      .send({ error: { code: "NOT_IMPLEMENTED", message: "Usage records not yet implemented" } });
  });
}
