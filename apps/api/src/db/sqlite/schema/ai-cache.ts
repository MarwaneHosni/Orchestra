import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const aiCacheEntries = sqliteTable(
  "ai_cache_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cacheKey: text("cache_key").notNull(),
    promptVersion: integer("prompt_version").notNull().default(0),
    schemaVersion: text("schema_version").notNull(),
    model: text("model").notNull(),
    provider: text("provider").notNull(),
    temperature: real("temperature").notNull().default(0.7),
    systemPromptHash: text("system_prompt_hash").notNull(),
    messagesHash: text("messages_hash").notNull(),
    responseContent: text("response_content").notNull(),
    responseModel: text("response_model").notNull(),
    finishReason: text("finish_reason").notNull().default("stop"),
    usagePromptTokens: integer("usage_prompt_tokens").notNull().default(0),
    usageCompletionTokens: integer("usage_completion_tokens").notNull().default(0),
    usageTotalTokens: integer("usage_total_tokens").notNull().default(0),
    hitCount: integer("hit_count").notNull().default(0),
    createdAt: text("created_at").notNull(),
    lastAccessedAt: text("last_accessed_at").notNull(),
  },
  (table) => ({
    cacheKeyIdx: uniqueIndex("idx_ai_cache_key").on(table.cacheKey),
    modelIdx: index("idx_ai_cache_model").on(table.model),
    providerIdx: index("idx_ai_cache_provider").on(table.provider),
    createdAtIdx: index("idx_ai_cache_created").on(table.createdAt),
  }),
);

export const aiCacheInvalidationMarkers = sqliteTable("ai_cache_invalidation_markers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  markerKey: text("marker_key").notNull().unique(),
  promptVersion: integer("prompt_version").notNull(),
  schemaVersion: text("schema_version").notNull(),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
});
