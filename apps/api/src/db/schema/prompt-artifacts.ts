import { pgTable, uuid, integer, timestamp, varchar, text, index } from "drizzle-orm/pg-core";
import { executionTasks } from "./execution-tasks.js";

export const promptStatuses = ["pending", "complete", "failed", "needs_review"] as const;

export const promptArtifacts = pgTable(
  "prompt_artifacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .references(() => executionTasks.id)
      .notNull(),
    promptText: text("prompt_text").notNull(),
    resultText: text("result_text"),
    version: integer("version").default(1).notNull(),
    status: varchar("status", { length: 15 }).default("pending").notNull(),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    taskIdIdx: index("prompt_artifacts_task_id_idx").on(table.taskId),
  }),
);
