import type { FastifyInstance } from "fastify";
import { z } from "zod";

// Full schema including encrypted fields — for internal/database use only
export const FullProviderCredentialSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  projectId: z.string().uuid().optional().nullable(),
  provider: z.enum(["openai", "anthropic", "google", "aws_bedrock", "azure_openai", "custom"]),
  displayName: z.string().min(1).max(100),
  status: z.enum(["unverified", "valid", "invalid", "expired"]),
  encryptedApiKey: z.string().optional().nullable(),
  keyReference: z.string().optional().nullable(),
  defaultModel: z.string().optional().nullable(),
  modelsAvailable: z.string().optional().nullable(),
  lastVerifiedAt: z.string().datetime().optional().nullable(),
  errorMessage: z.string().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type FullProviderCredential = z.infer<typeof FullProviderCredentialSchema>;

// Public schema — encrypted fields explicitly excluded from API responses
export const ProviderCredentialSchema = FullProviderCredentialSchema.omit({
  encryptedApiKey: true,
  keyReference: true,
});

export type ProviderCredential = z.infer<typeof ProviderCredentialSchema>;

export async function registerProviderCredentialRoutes(app: FastifyInstance) {
  app.get("/api/v1/provider-credentials", async (_request, reply) => {
    reply
      .status(501)
      .send({ error: { code: "NOT_IMPLEMENTED", message: "Provider credentials not yet implemented" } });
  });

  app.get("/api/v1/provider-credentials/:id", async (_request, reply) => {
    reply
      .status(501)
      .send({ error: { code: "NOT_IMPLEMENTED", message: "Provider credentials not yet implemented" } });
  });
}
