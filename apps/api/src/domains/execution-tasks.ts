import type { FastifyInstance } from "fastify";
import { z } from "zod";

export const ExecutionTaskSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  phaseId: z.string().uuid().optional().nullable(),
  subphaseId: z.string().uuid().optional().nullable(),
  parentTaskId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  type: z.enum(["code", "config", "test", "docs", "review", "deploy", "other"]).default("other"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(["pending", "blocked", "ready", "in_progress", "complete"]).default("pending"),
  order: z.number().int().default(0),
  version: z.number().int().positive().default(1),
  supersededByTaskId: z.string().uuid().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ExecutionTask = z.infer<typeof ExecutionTaskSchema>;

export async function registerExecutionTaskRoutes(app: FastifyInstance) {
  app.get("/api/v1/plans/:planId/tasks", async (_request, reply) => {
    reply
      .status(501)
      .send({ error: { code: "NOT_IMPLEMENTED", message: "Execution tasks not yet implemented" } });
  });
}
