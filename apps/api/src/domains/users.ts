import type { FastifyInstance } from "fastify";
import { z } from "zod";

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
});

export type User = z.infer<typeof UserSchema>;

export async function registerUserRoutes(app: FastifyInstance) {
  app.get("/api/v1/users/:id", {
    schema: { response: { 501: { type: "object", properties: { error: { type: "object" } } } } },
  }, async () => {
    return { error: { code: "NOT_IMPLEMENTED", message: "Users not yet implemented" } };
  });
}
