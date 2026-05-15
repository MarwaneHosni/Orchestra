import { pgTable, uuid, integer, timestamp, text, index } from "drizzle-orm/pg-core";
import { executionTasks } from "./execution-tasks.js";
import { plans } from "./plans.js";

export const generationVersions = pgTable(
  "generation_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .references(() => executionTasks.id)
      .notNull(),
    planId: uuid("plan_id")
      .references(() => plans.id)
      .notNull(),
    version: integer("version").default(1).notNull(),
    changesSummary: text("changes_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    taskIdIdx: index("gen_versions_task_id_idx").on(table.taskId),
    planIdIdx: index("gen_versions_plan_id_idx").on(table.planId),
  }),
);
