import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { projects } from "./projects.js";

export const usageRecordStatuses = ["estimated", "completed", "failed"] as const;

export const usageRecords = sqliteTable(
  "usage_records",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    taskType: text("task_type"),
    provider: text("provider"),
    model: text("model"),
    estimatedPromptTokens: integer("estimated_prompt_tokens"),
    estimatedCompletionTokens: integer("estimated_completion_tokens"),
    estimatedCost: real("estimated_cost"),
    actualPromptTokens: integer("actual_prompt_tokens"),
    actualCompletionTokens: integer("actual_completion_tokens"),
    actualTotalTokens: integer("actual_total_tokens"),
    actualCost: real("actual_cost"),
    status: text("status", { enum: usageRecordStatuses }).default("estimated").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    projectIdIdx: index("usage_records_project_id_idx").on(table.projectId),
  }),
);
