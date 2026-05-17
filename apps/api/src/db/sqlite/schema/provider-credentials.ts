import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const providerNames = [
  "openai",
  "anthropic",
  "openrouter",
  "mock",
  "opencode-go",
  "google",
  "aws_bedrock",
  "azure_openai",
  "custom",
] as const;
export const credentialStatuses = [
  "unverified",
  "valid",
  "invalid",
  "expired",
  "rate_limited",
  "failed",
] as const;

export const providerCredentials = sqliteTable(
  "provider_credentials",
  {
    id: text("id").primaryKey(),
    provider: text("provider", { enum: providerNames }).notNull(),
    displayName: text("display_name").notNull(),
    status: text("status", { enum: credentialStatuses }).default("unverified").notNull(),
    encryptedApiKey: text("encrypted_api_key"),
    keyReference: text("key_reference"),
    defaultModel: text("default_model"),
    modelsAvailable: text("models_available"),
    lastVerifiedAt: text("last_verified_at"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    providerIdx: index("provider_creds_provider_idx").on(table.provider),
  }),
);
