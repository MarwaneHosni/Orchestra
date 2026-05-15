import { pgTable, uuid, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { executionTasks } from "./execution-tasks.js";

export const dependencyTypes = ["blocks", "triggers", "input_from"] as const;

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .references(() => executionTasks.id)
      .notNull(),
    dependsOnTaskId: uuid("depends_on_task_id")
      .references(() => executionTasks.id)
      .notNull(),
    dependencyType: varchar("dependency_type", { length: 15 }).default("blocks").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    taskIdIdx: index("task_deps_task_id_idx").on(table.taskId),
    dependsOnIdx: index("task_deps_depends_on_idx").on(table.dependsOnTaskId),
  }),
);
