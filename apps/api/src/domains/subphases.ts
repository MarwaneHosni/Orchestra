import type { FastifyInstance } from "fastify";
import { z } from "zod";

export const SubPhaseSchema = z.object({
  id: z.string().uuid(),
  phaseId: z.string().uuid(),
  order: z.number().int().positive(),
  title: z.string(),
  status: z.enum(["pending", "in_progress", "complete"]).default("pending"),
  dependencies: z.array(z.string().uuid()).default([]),
});

export type SubPhase = z.infer<typeof SubPhaseSchema>;

export async function registerSubPhaseRoutes(app: FastifyInstance) {
  app.get("/api/v1/phases/:phaseId/subphases", async (_request, reply) => {
    reply.status(501).send({ error: { code: "NOT_IMPLEMENTED", message: "Subphases not yet implemented" } });
  });
}
