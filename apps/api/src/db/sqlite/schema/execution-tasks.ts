import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { plans } from "./plans.js";

export const taskStatuses = [
  "pending",
  "blocked",
  "ready",
  "in_progress",
  "complete",
  "needs_review",
] as const;
export const taskPriorities = ["low", "medium", "high", "critical"] as const;
export const taskTypes = [
  "code",
  "config",
  "test",
  "docs",
  "review",
  "deploy",
  "pending_input",
  "other",
] as const;

export const executionTasks = sqliteTable(
  "execution_tasks",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id),
    phaseType: text("phase_type"),
    title: text("title").notNull(),
    description: text("description"),
    type: text("type", { enum: taskTypes }).default("other").notNull(),
    priority: text("priority", { enum: taskPriorities }).default("medium").notNull(),
    status: text("status", { enum: taskStatuses }).default("pending").notNull(),
    order: integer("order").default(0).notNull(),
    version: integer("version").default(1).notNull(),
    supersededByTaskId: text("superseded_by_task_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    planIdIdx: index("exec_tasks_plan_id_idx").on(table.planId),
    statusIdx: index("exec_tasks_status_idx").on(table.status),
  }),
);

export const taskDependencies = sqliteTable(
  "task_dependencies",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => executionTasks.id),
    dependsOnTaskId: text("depends_on_task_id")
      .notNull()
      .references(() => executionTasks.id),
    dependencyType: text("dependency_type", { enum: ["blocks", "triggers", "input_from"] }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    taskIdIdx: index("task_deps_task_id_idx").on(table.taskId),
    dependsOnIdx: index("task_deps_depends_on_idx").on(table.dependsOnTaskId),
  }),
);
