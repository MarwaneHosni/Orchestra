import { pgTable, uuid, varchar, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { plans } from "./plans.js";
import { phases } from "./phases.js";
import { subphases } from "./subphases.js";

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

export const executionTasks = pgTable(
  "execution_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .references(() => plans.id)
      .notNull(),
    phaseId: uuid("phase_id").references(() => phases.id),
    subphaseId: uuid("subphase_id").references(() => subphases.id),
    parentTaskId: uuid("parent_task_id"),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    type: varchar("type", { length: 20 }).default("other").notNull(),
    priority: varchar("priority", { length: 10 }).default("medium").notNull(),
    status: varchar("status", { length: 15 }).default("pending").notNull(),
    order: integer("order").default(0).notNull(),
    version: integer("version").default(1).notNull(),
    supersededByTaskId: uuid("superseded_by_task_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    planIdIdx: index("exec_tasks_plan_id_idx").on(table.planId),
    phaseIdIdx: index("exec_tasks_phase_id_idx").on(table.phaseId),
    statusIdx: index("exec_tasks_status_idx").on(table.status),
  }),
);
