import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const promptStatuses = ["pending", "complete", "failed", "needs_review"] as const;

export const promptArtifacts = sqliteTable(
  "prompt_artifacts",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull(),
    planId: text("plan_id").notNull().default(""),
    planVersion: integer("plan_version").notNull().default(0),
    promptText: text("prompt_text").notNull(),
    sectionsJson: text("sections_json"),
    resultText: text("result_text"),
    version: integer("version").default(1).notNull(),
    status: text("status", { enum: promptStatuses }).default("pending").notNull(),
    failureReason: text("failure_reason"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    taskIdIdx: index("prompt_artifacts_task_id_idx").on(table.taskId),
    planIdIdx: index("prompt_artifacts_plan_id_idx").on(table.planId),
  }),
);
