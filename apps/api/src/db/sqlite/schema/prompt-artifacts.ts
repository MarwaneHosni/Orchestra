import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { executionTasks } from "./execution-tasks.js";

export const promptStatuses = ["pending", "complete", "failed", "needs_review"] as const;

export const promptArtifacts = sqliteTable(
  "prompt_artifacts",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => executionTasks.id),
    promptText: text("prompt_text").notNull(),
    resultText: text("result_text"),
    version: integer("version").default(1).notNull(),
    status: text("status", { enum: promptStatuses }).default("pending").notNull(),
    failureReason: text("failure_reason"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    taskIdIdx: index("prompt_artifacts_task_id_idx").on(table.taskId),
  }),
);
