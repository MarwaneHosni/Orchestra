import { eq } from "drizzle-orm";
import { getDb } from "../../db/sqlite/index.js";
import * as schema from "../../db/sqlite/schema/index.js";
import type { CredentialStore } from "../credentials/store.js";
import type { FullProviderCredential } from "../../domains/provider-credentials.js";

function stripSecrets(c: FullProviderCredential): FullProviderCredential {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { encryptedApiKey: _key, keyReference: _ref, ...rest } = c;
  return rest as FullProviderCredential;
}

export function createSqliteCredentialStore(): CredentialStore {
  const now = () => new Date().toISOString();

  return {
    list() {
      const rows = getDb().select().from(schema.providerCredentials).all();
      return rows.map((r) =>
        stripSecrets({
          id: r.id,
          userId: "",
          projectId: r.id,
          provider: r.provider,
          displayName: r.displayName,
          status: r.status as FullProviderCredential["status"],
          encryptedApiKey: r.encryptedApiKey,
          keyReference: r.keyReference,
          defaultModel: r.defaultModel,
          modelsAvailable: r.modelsAvailable,
          lastVerifiedAt: r.lastVerifiedAt,
          errorMessage: r.errorMessage,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }),
      );
    },
    get(id) {
      const row = getDb()
        .select()
        .from(schema.providerCredentials)
        .where(eq(schema.providerCredentials.id, id))
        .get();
      if (!row) return undefined;
      return stripSecrets({
        id: row.id,
        userId: "",
        projectId: row.id,
        provider: row.provider,
        displayName: row.displayName,
        status: row.status as FullProviderCredential["status"],
        encryptedApiKey: row.encryptedApiKey,
        keyReference: row.keyReference,
        defaultModel: row.defaultModel,
        modelsAvailable: row.modelsAvailable,
        lastVerifiedAt: row.lastVerifiedAt,
        errorMessage: row.errorMessage,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    },
    getRaw(id) {
      const row = getDb()
        .select()
        .from(schema.providerCredentials)
        .where(eq(schema.providerCredentials.id, id))
        .get();
      if (!row) return undefined;
      return {
        id: row.id,
        userId: "",
        projectId: row.id,
        provider: row.provider,
        displayName: row.displayName,
        status: row.status as FullProviderCredential["status"],
        encryptedApiKey: row.encryptedApiKey,
        keyReference: row.keyReference,
        defaultModel: row.defaultModel,
        modelsAvailable: row.modelsAvailable,
        lastVerifiedAt: row.lastVerifiedAt,
        errorMessage: row.errorMessage,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },
    insert(c) {
      getDb()
        .insert(schema.providerCredentials)
        .values({
          id: c.id,
          provider: c.provider,
          displayName: c.displayName,
          status: c.status,
          encryptedApiKey: c.encryptedApiKey,
          keyReference: c.keyReference,
          defaultModel: c.defaultModel,
          modelsAvailable: c.modelsAvailable,
          lastVerifiedAt: c.lastVerifiedAt,
          errorMessage: c.errorMessage,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })
        .run();
    },
    update(id, partial) {
      const updates: Record<string, unknown> = {};
      if (partial.status !== undefined) updates.status = partial.status;
      if (partial.displayName !== undefined) updates.displayName = partial.displayName;
      if (partial.encryptedApiKey !== undefined) updates.encryptedApiKey = partial.encryptedApiKey;
      if (partial.defaultModel !== undefined) updates.defaultModel = partial.defaultModel;
      if (partial.modelsAvailable !== undefined) updates.modelsAvailable = partial.modelsAvailable;
      if (partial.lastVerifiedAt !== undefined) updates.lastVerifiedAt = partial.lastVerifiedAt;
      if (partial.errorMessage !== undefined) updates.errorMessage = partial.errorMessage;
      updates.updatedAt = now();
      getDb()
        .update(schema.providerCredentials)
        .set(updates)
        .where(eq(schema.providerCredentials.id, id))
        .run();
    },
    remove(id) {
      getDb().delete(schema.providerCredentials).where(eq(schema.providerCredentials.id, id)).run();
    },
  };
}
