import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { projects } from "./projects.js";

export const providerNames = [
  "openai",
  "anthropic",
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

export const providerCredentials = pgTable(
  "provider_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    projectId: uuid("project_id").references(() => projects.id),
    provider: varchar("provider", { length: 50 }).notNull(),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    status: varchar("status", { length: 20 }).default("unverified").notNull(),
    encryptedApiKey: text("encrypted_api_key"),
    keyReference: text("key_reference"),
    defaultModel: varchar("default_model", { length: 100 }),
    modelsAvailable: text("models_available"),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("provider_creds_user_id_idx").on(table.userId),
    projectIdIdx: index("provider_creds_project_id_idx").on(table.projectId),
    providerIdx: index("provider_creds_provider_idx").on(table.provider),
  }),
);
