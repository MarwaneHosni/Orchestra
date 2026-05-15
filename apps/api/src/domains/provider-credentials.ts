import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getCredentialStore, encryptKey } from "../lib/credentials/store.js";
import { ValidationError, NotFoundError } from "../lib/errors.js";

export const FullProviderCredentialSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  projectId: z.string().uuid().optional().nullable(),
  provider: z.enum(["openai", "anthropic", "google", "aws_bedrock", "azure_openai", "custom"]),
  displayName: z.string().min(1).max(100),
  status: z.enum(["unverified", "valid", "invalid", "expired", "rate_limited", "failed"]),
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

export const ProviderCredentialSchema = FullProviderCredentialSchema.omit({
  encryptedApiKey: true,
  keyReference: true,
});

export type ProviderCredential = z.infer<typeof ProviderCredentialSchema>;

export const CreateCredentialSchema = z.object({
  userId: z.string().uuid().default("00000000-0000-0000-0000-000000000001"),
  provider: z.enum(["openai", "anthropic", "google", "aws_bedrock", "azure_openai", "custom"]),
  displayName: z.string().min(1).max(100).optional(),
  apiKey: z.string().min(1, "API key is required"),
  defaultModel: z.string().optional(),
});

export const UpdateCredentialSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  apiKey: z.string().min(1).optional(),
  defaultModel: z.string().optional().nullable(),
});

export async function registerProviderCredentialRoutes(app: FastifyInstance) {
  app.get("/api/v1/provider-credentials", async () => {
    const store = getCredentialStore();
    return { data: store.list() };
  });

  app.get("/api/v1/provider-credentials/:id", async (request) => {
    const { id } = request.params as { id: string };
    const store = getCredentialStore();
    const cred = store.get(id);
    if (!cred) throw new NotFoundError("Provider credential", id);
    return cred;
  });

  app.post("/api/v1/provider-credentials", async (request, reply) => {
    const parsed = CreateCredentialSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError("Invalid credential data");

    const now = new Date().toISOString();
    const store = getCredentialStore();
    const encrypted = encryptKey(parsed.data.apiKey);

    const record: FullProviderCredential = {
      id: crypto.randomUUID(),
      userId: parsed.data.userId,
      projectId: null,
      provider: parsed.data.provider,
      displayName: parsed.data.displayName ?? parsed.data.provider,
      status: "unverified",
      encryptedApiKey: encrypted,
      keyReference: null,
      defaultModel: parsed.data.defaultModel ?? null,
      modelsAvailable: null,
      lastVerifiedAt: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };

    store.insert(record);
    reply.status(201);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { encryptedApiKey: _k, keyReference: _r, ...publicRecord } = record;
    return publicRecord;
  });

  app.put("/api/v1/provider-credentials/:id", async (request) => {
    const { id } = request.params as { id: string };
    const parsed = UpdateCredentialSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError("Invalid update data");

    const store = getCredentialStore();
    const existing = store.get(id);
    if (!existing) throw new NotFoundError("Provider credential", id);

    const updates: Record<string, unknown> = {};
    if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
    if (parsed.data.defaultModel !== undefined) updates.defaultModel = parsed.data.defaultModel;
    if (parsed.data.apiKey) updates.encryptedApiKey = encryptKey(parsed.data.apiKey);
    updates.updatedAt = new Date().toISOString();
    if (parsed.data.apiKey) updates.status = "unverified";

    store.update(id, updates as any);
    const updated = store.get(id)!;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { encryptedApiKey: _k3, keyReference: _r3, ...publicRecord } = updated;
    return publicRecord;
  });

  app.delete("/api/v1/provider-credentials/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const store = getCredentialStore();
    const cred = store.get(id);
    if (!cred) throw new NotFoundError("Provider credential", id);
    store.remove(id);
    reply.status(204);
    return;
  });

  app.post("/api/v1/provider-credentials/:id/validate", async (request) => {
    const { id } = request.params as { id: string };
    const store = getCredentialStore();
    const cred = store.get(id);
    if (!cred) throw new NotFoundError("Provider credential", id);

    // Mark as verifying — in production, this would call the provider adapter
    const now = new Date().toISOString();
    store.update(id, { status: "valid", lastVerifiedAt: now, errorMessage: null });

    const updated = store.get(id)!;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { encryptedApiKey: _k2, keyReference: _r2, ...publicRecord } = updated;
    return publicRecord;
  });
}
